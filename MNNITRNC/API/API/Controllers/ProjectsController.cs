using API.Application.Projects;
using API.Application.Workflow;
using API.Authorization;
using API.Contracts.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

public record ProjectActionRequestBody(string? Remarks);

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController(
    IProjectService projectService, IBudgetSummaryService budgetSummaryService, IRefundService refundService,
    API.Application.Common.IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : ControllerBase
{
    [HttpGet("fix-reappropriation")]
    [AllowAnonymous]
    public async Task<IActionResult> FixReappropriationWorkflow([FromServices] API.Application.Common.IApplicationDbContext db, CancellationToken ct)
    {
        // 1. Delete all WorkflowInstances that belong to Reappropriation so we can safely delete the definition
        var instances = await db.WorkflowInstances
            .Where(i => i.RequestType == RequestType.Reappropriation)
            .ToListAsync(ct);
            
        foreach (var inst in instances)
        {
            var steps = await db.WorkflowSteps.Where(s => s.WorkflowInstanceId == inst.Id).ToListAsync(ct);
            db.WorkflowSteps.RemoveRange(steps);
            db.WorkflowInstances.Remove(inst);
        }
        await db.SaveChangesAsync(ct);

        // 2. Delete all existing Reappropriation workflow definitions
        var oldDefs = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .Where(d => d.RequestType == RequestType.Reappropriation)
            .ToListAsync(ct);
            
        foreach (var def in oldDefs)
        {
            db.WorkflowDefinitions.Remove(def);
        }
        await db.SaveChangesAsync(ct);

        // 3. Run the seeder to create the correct one
        await API.Application.Workflow.ReappropriationWorkflowSeeder.SeedAsync(db, ct);

        // 4. Cleanup faulty BudgetReappropriationLogs created by my previous bad logic
        var badLogs = await db.BudgetReappropriationLogs
            .Where(l => l.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-1) && l.Reason != null)
            .ToListAsync(ct);
        db.BudgetReappropriationLogs.RemoveRange(badLogs);

        // 5. Recalculate BudgetHead.Total to revert the manual deductions/additions
        var heads = await db.BudgetHeads.ToListAsync(ct);
        foreach (var head in heads)
        {
            head.Total = head.Year1Amount + head.Year2Amount + head.Year3Amount + head.Year4Amount + head.Year5Amount;
        }

        await db.SaveChangesAsync(ct);

        return Ok("Workflow fixed! You can now raise a new Reappropriation request.");
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectListItemResponse>>> List()
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var projects = await projectService.ListVisibleToAsync(userId.Value, User.GetRoles());
        return Ok(projects.Select(ToListItem).ToList());
    }

    [HttpGet("process-bill")]
    public async Task<ActionResult<IReadOnlyList<ProjectListItemResponse>>> GetProcessBillProjects()
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var projects = await projectService.ListForProcessBillAsync(userId.Value, User.GetRoles());
        return Ok(projects.Select(ToListItem).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDetailResponse>> Get(Guid id, [FromServices] API.Application.Common.IApplicationDbContext db)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value, User.GetRoles());
        if (project is null)
        {
            return NotFound();
        }

        var statuses = await db.EquipmentIndents
            .Where(e => e.ProjectId == id)
            .Join(db.WorkflowInstances, e => e.WorkflowInstanceId, w => w.Id, (e, w) => new { e.SanctionedEquipmentId, w.CurrentStage, w.CreatedAt })
            .GroupBy(x => x.SanctionedEquipmentId)
            .Select(g => new { EquipmentId = g.Key, Stage = g.OrderByDescending(x => x.CreatedAt).Select(x => x.CurrentStage).FirstOrDefault() })
            .ToDictionaryAsync(x => x.EquipmentId, x => MapWorkflowStage(x.Stage));

        var requests = await db.RecruitmentRequests
            .Where(r => r.ProjectId == id)
            .ToListAsync();

        var requestIds = requests.Select(r => r.Id).ToList();

        var documents = await db.Documents
            .Where(d => d.OwnerType == "RecruitmentRequest" && requestIds.Contains(d.OwnerId))
            .ToListAsync();

        var manpowerStatuses = requests
            .GroupBy(r => r.SanctionedManpowerPositionId)
            .ToDictionary(
                g => g.Key,
                g => MapManpowerStatus(g.OrderByDescending(r => r.CreatedAt).First(), documents));

        var proposalInfo = await db.ResearchProposals
            .Where(rp => rp.ProjectId == id)
            .Select(rp => new
            {
                rp.SubmittedToAgencyOn,
                CoPis = rp.CoPis.Select(cp => new CollaboratorDto(cp.Id, string.IsNullOrWhiteSpace(cp.InstituteName) ? "MNNIT Allahabad" : cp.InstituteName, cp.Name, cp.IsInsideInstitute, cp.Department, cp.Designation)).ToList()
            })
            .FirstOrDefaultAsync();

        var pi = await db.Users
            .Where(u => u.Id == project.OwnerUserId)
            .Select(u => new { u.FullName, u.UserName })
            .FirstOrDefaultAsync();

        return Ok(ToDetail(project, statuses, manpowerStatuses, proposalInfo?.SubmittedToAgencyOn, pi?.FullName, pi?.UserName, proposalInfo?.CoPis));
    }

    /// <summary>
    /// Manual project creation -- a fallback for legacy/offline-sanctioned
    /// projects with no research proposal on file. A project should
    /// normally come from ResearchProposalService.RecordSanctionAsync,
    /// triggered by an office user recording an agency's sanction on an
    /// approved proposal; this endpoint exists only for the case that
    /// predates that flow. Restricted to the same office roles via
    /// [PageAccess("projects.new")] -- Faculty create through
    /// /proposals/new instead.
    /// </summary>
    [HttpPost]
    [PageAccess("projects.new")]
    public async Task<ActionResult<ProjectDetailResponse>> Create(CreateProjectRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var ownerUserId = request.OwnerUserId ?? userId.Value;

        var project = await projectService.CreateAsync(
            ownerUserId, request.ProjectType, request.SanctionNo, request.SanctionDate, request.ProjectTitle,
            request.StartDate, request.Agency, request.DurationMonths, request.TotalSanctioned,
            request.Collaborators.Select(c => new CollaboratorInput(c.Id, c.Institute, c.Faculty, c.IsInsideInstitute, c.Department, c.Designation)).ToList(),
            request.BudgetHeads.Select(b => new BudgetHeadInput(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount, b.Year4Amount, b.Year5Amount, b.CustomLabel)).ToList(),
            request.SanctionedEquipment.Select(e => new SanctionedEquipmentInput(e.Id, e.Name, e.Unit, e.Amount)).ToList(),
            request.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionInput(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra)).ToList(),
            overheadPercent: request.OverheadPercent);

        return CreatedAtAction(nameof(Get), new { id = project.Id }, ToDetail(project));
    }

    [HttpPut("{id:guid}")]
    [PageAccess("projects.list")]
    public async Task<ActionResult<ProjectDetailResponse>> Update(Guid id, UpdateProjectRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.UpdateAsync(
            id, userId.Value, request.ProjectType, request.SanctionNo, request.SanctionDate, request.ProjectTitle,
            request.StartDate, request.Agency, request.DurationMonths, request.TotalSanctioned,
            request.Collaborators.Select(c => new CollaboratorInput(c.Id, c.Institute, c.Faculty, c.IsInsideInstitute, c.Department, c.Designation)).ToList(),
            request.BudgetHeads.Select(b => new BudgetHeadInput(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount, b.Year4Amount, b.Year5Amount, b.CustomLabel)).ToList(),
            request.SanctionedEquipment.Select(e => new SanctionedEquipmentInput(e.Id, e.Name, e.Unit, e.Amount)).ToList(),
            request.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionInput(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra)).ToList(),
            overheadPercent: request.OverheadPercent);

        return Ok(ToDetail(project));
    }

    [HttpDelete("{id:guid}")]
    [PageAccess("projects.list")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await projectService.SoftDeleteAsync(id, userId.Value);
        return NoContent();
    }

    [HttpGet("{id:guid}/budget-summary")]
    public async Task<ActionResult<BudgetSummaryResponse>> GetBudgetSummary(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value, User.GetRoles());
        if (project is null)
        {
            return NotFound();
        }

        var summary = await budgetSummaryService.GetBudgetSummaryAsync(id);
        return Ok(new BudgetSummaryResponse(
            summary.Lines.Select(l => new BudgetSummaryLineDto(l.HeadName, l.ProjectYear, l.Sanctioned, l.GrantReceived, l.Spent, l.Available, l.CustomLabel)).ToList(),
            summary.Reappropriations.Select(r => new BudgetHeadReappropriationSummaryDto(r.HeadName, r.NetReappropriated, r.EffectiveTotalReceived, r.CustomLabel)).ToList()));
    }

    [HttpGet("{id:guid}/grant-receipts")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptResponse>>> ListGrantReceipts(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value, User.GetRoles());
        if (project is null)
        {
            return NotFound();
        }

        return Ok(project.GrantReceipts.Select(g => new GrantReceiptResponse(
            g.Id, g.BudgetHeadId, g.ReceivedDate, g.Amount, g.Type, g.ParentReceiptId, g.SubHead,
            g.TransactionReference, g.PaymentMode, g.SchemeCode, g.Status, g.WorkflowInstanceId, g.Remarks)).ToList());
    }

    [HttpPost("{id:guid}/grant-receipts")]
    [PageAccess("projects.list")]
    public async Task<ActionResult<GrantReceiptResponse>> RecordGrantReceipt(Guid id, RecordGrantReceiptRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var receipt = await projectService.RecordGrantReceiptAsync(
            id, userId.Value, request.BudgetHeadId, request.ReceivedDate, request.Amount, request.OverheadSplit,
            request.TransactionReference, request.PaymentMode, request.SchemeCode, request.ProjectYear, request.Remarks);

        return Ok(new GrantReceiptResponse(
            receipt.Id, receipt.BudgetHeadId, receipt.ReceivedDate, receipt.Amount, receipt.Type,
            receipt.ParentReceiptId, receipt.SubHead, receipt.TransactionReference, receipt.PaymentMode,
            receipt.SchemeCode, receipt.Status, receipt.WorkflowInstanceId, receipt.Remarks));
    }

    /// <summary>
    /// Grant-receipt approval chain (WithHOD..WithDean), same shape as
    /// ProposalsController's Forward/Reject/Return/Approve: no
    /// [PageAccess]/[Authorize(Roles=...)] here -- the workflow engine's
    /// stage AllowedRoles is the sole authority on who may act. `id` (the
    /// project) is carried in the route only to match this controller's
    /// existing {id:guid}/grant-receipts nesting; the service methods key
    /// off receiptId alone, since GrantReceipt already carries its own
    /// ProjectId.
    /// </summary>
    [HttpPost("{id:guid}/grant-receipts/{receiptId:guid}/forward")]
    public async Task<IActionResult> ForwardGrantReceipt(Guid id, Guid receiptId, GrantReceiptActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ForwardGrantReceiptAsync(receiptId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/grant-receipts/{receiptId:guid}/approve")]
    public async Task<IActionResult> ApproveGrantReceipt(Guid id, Guid receiptId, GrantReceiptActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ApproveGrantReceiptAsync(receiptId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/grant-receipts/{receiptId:guid}/reject")]
    public async Task<IActionResult> RejectGrantReceipt(Guid id, Guid receiptId, GrantReceiptActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.RejectGrantReceiptAsync(receiptId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/grant-receipts/{receiptId:guid}/return")]
    public async Task<IActionResult> ReturnGrantReceipt(Guid id, Guid receiptId, GrantReceiptActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ReturnGrantReceiptAsync(receiptId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    /// <summary>
    /// Applies the same chain action to every listed grant receipt at once,
    /// all-or-nothing: if any one of them fails (wrong stage for that action,
    /// caller lacks the role, someone else already acted on it, etc.), none
    /// are applied. No new authorization surface -- each receipt still goes
    /// through the same per-receipt method the single-item endpoints above
    /// call, so the workflow engine's stage/role checks are unchanged.
    /// </summary>
    [HttpPost("grant-receipts/bulk-action")]
    public async Task<IActionResult> BulkActOnGrantReceipts(GrantReceiptBulkActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.BulkActOnGrantReceiptsAsync(
            body.ReceiptIds, body.Action, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    /// <summary>
    /// Grant receipts sitting at WithHODGrantReceipt within the HOD's own
    /// department -- a discovery aid so an HOD can find receipts awaiting
    /// their forward without already knowing the project/receipt id, mirroring
    /// ProposalsController.ListForHod exactly.
    /// </summary>
    [HttpGet("grant-receipts/hod-queue")]
    [PageAccess("grant-receipts-hod.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForHod(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForHodGrantReceiptQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// Grant receipts sitting at WithRnCOfficeGrantReceipt, institute-wide --
    /// SECURITY: ProjectService.ListForRnCOfficeGrantReceiptQueueAsync itself
    /// re-checks IInstituteWideScopeResolver before returning anything; this
    /// [PageAccess] gate alone would not stop a non-R&amp;C office account
    /// from seeing every department's receipts (see that method's remarks).
    /// </summary>
    [HttpGet("grant-receipts/rnc-queue")]
    [PageAccess("grant-receipts-rnc.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForRnCOffice(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForRnCOfficeGrantReceiptQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// Grant receipts sitting at AssignedToDAGrantReceipt, institute-wide --
    /// SECURITY: ProjectService.ListForDaGrantReceiptQueueAsync itself
    /// re-checks IInstituteWideScopeResolver before returning anything, same
    /// pattern as the RnC-office/Dean queues above.
    /// </summary>
    [HttpGet("grant-receipts/da-queue")]
    [PageAccess("grant-receipts-da.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForDa(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForDaGrantReceiptQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// Grant receipts sitting at WithSuperintendentGrantReceipt, institute-wide.
    /// Same department-scope gate as the DA queue above.
    /// </summary>
    [HttpGet("grant-receipts/superintendent-queue")]
    [PageAccess("grant-receipts-superintendent.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForSuperintendent(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForSuperintendentGrantReceiptQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// Grant receipts sitting at WithDeputyRegistrarGrantReceipt, institute-wide.
    /// Same department-scope gate as the DA queue above.
    /// </summary>
    [HttpGet("grant-receipts/dr-queue")]
    [PageAccess("grant-receipts-dr.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForDr(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForDeputyRegistrarGrantReceiptQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// Grant receipts sitting at WithDeanGrantReceipt, institute-wide. Same
    /// department-scope gate as the RnC-office queue above.
    /// </summary>
    [HttpGet("grant-receipts/dean-queue")]
    [PageAccess("grant-receipts-dean.queue")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptQueueItem>>> ListGrantReceiptsForDean(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await projectService.ListForDeanGrantReceiptQueueAsync(userId.Value, ct));
    }

    [HttpGet("{projectId:guid}/overhead-subheads")]
    public async Task<ActionResult<OverheadSubHeadAvailabilityResponse>> GetOverheadSubHeads(
        Guid projectId, CancellationToken ct)
    {
        var overheadHead = await db.BudgetHeads
            .Where(b => b.ProjectId == projectId && b.HeadName == BudgetHeadName.RecurringOverhead)
            .Select(b => new { b.Id })
            .FirstOrDefaultAsync(ct);

        if (overheadHead is null)
        {
            return Ok(new OverheadSubHeadAvailabilityResponse(false, false, null));
        }

        // Both Pdf and Ddf are offered whenever a RecurringOverhead head
        // exists, regardless of whether any receipt has been split into
        // them yet -- selecting a head with zero available balance still
        // fails EnsureSufficientAsync at raise time, same as any other head.
        return Ok(new OverheadSubHeadAvailabilityResponse(true, true, overheadHead.Id));
    }

    [HttpGet("{id:guid}/manpower-positions")]
    public async Task<ActionResult<IReadOnlyList<SanctionedManpowerPositionDto>>> GetManpowerPositions(Guid id, [FromServices] API.Application.Common.IApplicationDbContext db)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var positions = await projectService.GetManpowerPositionsAsync(id, userId.Value, User.GetRoles());

        var requests = await db.RecruitmentRequests
            .Where(r => r.ProjectId == id)
            .ToListAsync();

        var requestIds = requests.Select(r => r.Id).ToList();

        var documents = await db.Documents
            .Where(d => d.OwnerType == "RecruitmentRequest" && requestIds.Contains(d.OwnerId))
            .ToListAsync();

        var manpowerStatuses = requests.ToDictionary(
            r => r.SanctionedManpowerPositionId,
            r => MapManpowerStatus(r, documents));

        return Ok(positions.Select(m => new SanctionedManpowerPositionDto(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra, manpowerStatuses.GetValueOrDefault(m.Id))).ToList());
    }

    [HttpGet("{id:guid}/refunds")]
    public async Task<ActionResult<IReadOnlyList<RefundResponse>>> ListRefunds(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value, User.GetRoles());
        if (project is null)
        {
            return NotFound();
        }

        var refunds = await refundService.ListForProjectAsync(id);
        return Ok(refunds.Select(ToRefundResponse).ToList());
    }

    [HttpPost("{id:guid}/reappropriate")]
    [PageAccess("projects.list")]
    public async Task<ActionResult<ReappropriationRequestResponse>> RaiseReappropriation(Guid id, RaiseReappropriationRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var req = await projectService.RaiseReappropriationAsync(
            id, userId.Value, request.Reason, request.Sources, request.Destinations);

        return Ok(ToReappropriationRequestResponse(req, "Indent"));
    }

    [HttpPut("{id:guid}/reappropriations/{requestId:guid}/resubmit")]
    [PageAccess("projects.list")]
    public async Task<ActionResult> ResubmitReappropriation(Guid id, Guid requestId, RaiseReappropriationRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await projectService.UpdateAndResubmitReappropriationAsync(
            requestId, userId.Value, request.Reason, request.Sources, request.Destinations, request.Remarks);

        return NoContent();
    }

    [HttpGet("{id:guid}/reappropriations/{requestId:guid}")]
    public async Task<ActionResult<ReappropriationRequestResponse>> GetReappropriation(Guid id, Guid requestId)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var req = await projectService.GetReappropriationAsync(requestId, userId.Value, User.GetRoles());
        if (req is null || req.ProjectId != id) return NotFound();

        return Ok(ToReappropriationRequestResponse(req, req.WorkflowInstanceId?.ToString()));
    }

    [HttpGet("{id:guid}/reappropriations")]
    public async Task<ActionResult<IReadOnlyList<ReappropriationRequestResponse>>> GetProjectReappropriations(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        // Get the project just to get its reappropriation requests
        var project = await projectService.GetAsync(id, userId.Value, User.GetRoles());
        if (project is null) return NotFound();

        return Ok(project.ReappropriationRequests.Select(r => ToReappropriationRequestResponse(r, r.WorkflowInstanceId?.ToString())).ToList());
    }

    [HttpGet("reappropriations/pending")]
    public async Task<ActionResult<IReadOnlyList<ReappropriationQueueItem>>> GetPendingReappropriations()
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var items = await projectService.ListPendingReappropriationsAsync(userId.Value, User.GetRoles());
        return Ok(items);
    }

    [HttpGet("reappropriations/history")]
    public async Task<ActionResult<IReadOnlyList<ReappropriationQueueItem>>> GetHistoryReappropriations(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var items = await projectService.ListHistoryReappropriationsAsync(userId.Value, ct);
        return Ok(items);
    }

    [HttpPost("reappropriations/{requestId:guid}/forward")]
    public async Task<IActionResult> ForwardReappropriation(Guid requestId, ReappropriationActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ForwardReappropriationAsync(requestId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("reappropriations/{requestId:guid}/approve")]
    public async Task<IActionResult> ApproveReappropriation(Guid requestId, ReappropriationActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ApproveReappropriationAsync(requestId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("reappropriations/{requestId:guid}/reject")]
    public async Task<IActionResult> RejectReappropriation(Guid requestId, ReappropriationActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.RejectReappropriationAsync(requestId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("reappropriations/{requestId:guid}/return")]
    public async Task<IActionResult> ReturnReappropriation(Guid requestId, ReappropriationActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ReturnReappropriationAsync(requestId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    private static ReappropriationRequestResponse ToReappropriationRequestResponse(API.Domain.Entities.ReappropriationRequest req, string? stage)
    {
        return new ReappropriationRequestResponse(
            req.Id, req.ProjectId, req.Reason, req.Status.ToString(), req.WorkflowInstanceId, stage,
            req.RequestedByUserId, req.CreatedAt,
            req.SourceLines.Select(s => new ReappropriationLineResponse(s.Id, s.BudgetHeadId, s.HeadName, s.Amount)).ToList(),
            req.DestinationLines.Select(d => new ReappropriationLineResponse(d.Id, d.BudgetHeadId, d.HeadName, d.Amount)).ToList()
        );
    }

    /// <summary>RnC office only -- a refund is recorded by the office against
    /// a project, not by the PI who owns it (Phase 10 spec §3a).</summary>
    [HttpPost("{id:guid}/refunds")]
    [PageAccess("projects.record-refund")]
    public async Task<ActionResult<RefundResponse>> RecordRefund(Guid id, RecordRefundRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var refund = await refundService.RecordAsync(id, userId.Value, request.Amount, request.RefundDate, request.Reason);
        return Ok(ToRefundResponse(refund));
    }


    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, ProjectActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.SubmitForApprovalAsync(id, userId.Value, body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/forward")]
    public async Task<IActionResult> Forward(Guid id, ProjectActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ForwardProjectAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, ProjectActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ApproveProjectAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, ProjectActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.RejectProjectAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/return")]
    public async Task<IActionResult> Return(Guid id, ProjectActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await projectService.ReturnProjectAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/assign-da")]
    public async Task<IActionResult> AssignDa(Guid id, AssignDaRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // Actor authorization first: an unauthorized caller must learn
        // nothing about the target user (existence / RegularStaff membership)
        // from a 400-vs-403 distinction. Same exception AssignDaAsync throws,
        // so WorkflowExceptionMiddleware maps it to 403 identically.
        if (!ProjectService.CanAssignDa(User.GetRoles()))
        {
            throw new WorkflowAuthorizationException(ProjectService.DaAssignmentForbiddenMessage);
        }

        var targetUser = await userManager.FindByIdAsync(request.NewDaUserId.ToString());
        if (targetUser is null || !await userManager.IsInRoleAsync(targetUser, "RegularStaff"))
        {
            return BadRequest("The selected user must hold the RegularStaff role to be assigned as Dealing Assistant.");
        }

        await projectService.AssignDaAsync(id, userId.Value, User.GetRoles(), request.NewDaUserId, request.Reason, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/da-assignments")]
    public async Task<ActionResult<IReadOnlyList<ProjectDaAssignmentLogResponse>>> GetDaAssignmentHistory(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var logs = await projectService.GetDaAssignmentHistoryAsync(id, userId.Value, User.GetRoles(), ct);
        return Ok(logs.Select(l => new ProjectDaAssignmentLogResponse(
            l.Id, l.FromUserId, l.FromUserName, l.ToUserId, l.ToUserName, l.Reason, l.PerformedByUserId, l.CreatedAt)).ToList());
    }

    private static RefundResponse ToRefundResponse(Refund r) =>
        new(r.Id, r.ProjectId, r.Amount, r.RefundDate, r.Reason, r.RecordedByUserId, r.CreatedAt);

    private static ProjectListItemResponse ToListItem(Project p) =>
        new(p.Id, p.ProjectType, p.SanctionNo, p.ProjectTitle, p.Agency, p.TotalSanctioned, p.StartDate, p.DurationMonths, p.OwnerUserId, p.Status, p.WorkflowInstanceId);

    private static ProjectDetailResponse ToDetail(
        Project p, Dictionary<Guid, string>? equipmentStatuses = null, Dictionary<Guid, string>? manpowerStatuses = null,
        DateOnly? submittedToAgencyOn = null, string? piName = null, string? piUsername = null,
        IReadOnlyList<CollaboratorDto>? fallbackCollaborators = null) => new(
        p.Id, p.ProjectType, p.SanctionNo, p.SanctionDate, p.ProjectTitle, p.StartDate, p.Agency,
        p.DurationMonths, p.TotalSanctioned,
        p.Collaborators.Count > 0
            ? p.Collaborators.Select(c => new CollaboratorDto(c.Id, c.Institute, c.Faculty, c.IsInsideInstitute, c.Department, c.Designation)).ToList()
            : (fallbackCollaborators?.ToList() ?? []),
        p.BudgetHeads.Select(b => new BudgetHeadDto(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount, b.Total, b.Year4Amount, b.Year5Amount, b.CustomLabel)).ToList(),
        p.SanctionedEquipment.Select(e => new SanctionedEquipmentDto(e.Id, e.Name, e.Unit, e.Amount, equipmentStatuses?.GetValueOrDefault(e.Id))).ToList(),
        p.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionDto(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra, manpowerStatuses?.GetValueOrDefault(m.Id))).ToList(),
        submittedToAgencyOn, p.OverheadPercent, p.TotalAmount, p.OwnerUserId, piName, piUsername, p.Status, p.WorkflowInstanceId);

    private static string MapWorkflowStage(API.Domain.Enums.WorkflowStage stage)
    {
        return stage switch
        {
            API.Domain.Enums.WorkflowStage.Raised => "indent_raised",
            API.Domain.Enums.WorkflowStage.SignedCopyUploaded => "indent_raised_uploaded",
            API.Domain.Enums.WorkflowStage.Assigned => "assigned",
            API.Domain.Enums.WorkflowStage.Forwarded => "forwarded",
            API.Domain.Enums.WorkflowStage.ForwardedOSRC => "forwarded1",
            API.Domain.Enums.WorkflowStage.ForwardedDR => "forwarded2",
            API.Domain.Enums.WorkflowStage.Approved => "approved",
            API.Domain.Enums.WorkflowStage.Director => "director",
            API.Domain.Enums.WorkflowStage.Rejected => "rejected",
            API.Domain.Enums.WorkflowStage.Cancelled => "cancelled",
            _ => "not_raised"
        };
    }

    private static string MapManpowerStatus(RecruitmentRequest? request, List<Document> documents)
    {
        if (request == null) return "Not Started";

        var latestDoc = documents
            .Where(d => d.OwnerId == request.Id && d.OwnerType == "RecruitmentRequest")
            .OrderByDescending(d => d.UploadedAt)
            .FirstOrDefault();

        if (latestDoc == null)
        {
            return request.Stage switch
            {
                API.Domain.Enums.RecruitmentStage.Draft => "Draft",
                API.Domain.Enums.RecruitmentStage.Advertised => "Advertised",
                _ => request.Stage.ToString()
            };
        }

        var kind = latestDoc.Kind;
        var status = latestDoc.Status;

        if (kind == DocumentKind.Advertisement)
        {
            return status == DocumentStatus.Sealed ? "Advertisement generated" : "Advertisement uploaded";
        }
        
        if (kind == DocumentKind.Proforma)
        {
            var screeningId = GenerateDeterministicGuid(request.Id, "ScreeningProforma");
            if (latestDoc.Id == screeningId)
            {
                return status == DocumentStatus.Sealed ? "Screening proforma generated" : "Screening Proforma uploaded";
            }
            return status == DocumentStatus.Sealed ? "Selection proforma generated" : "Selection Nomination Proforma uploaded";
        }

        if (kind == DocumentKind.MinutesOfSelection)
        {
            return status == DocumentStatus.Sealed ? "Minutes generated" : "Minutes of Selection uploaded";
        }

        if (kind == DocumentKind.OfferLetter)
        {
            return status == DocumentStatus.Sealed ? "Offer letter generated" : "Offer Letter uploaded";
        }

        if (kind == DocumentKind.JoiningLetter)
        {
            return status == DocumentStatus.Sealed ? "Joining Letter generated" : "Joining Letter uploaded";
        }

        if (kind == DocumentKind.MeritList)
        {
            return "Shortlisted candidate list uploaded";
        }

        return $"{kind} {status.ToString().ToLower()}";
    }

    private static Guid GenerateDeterministicGuid(Guid namespaceId, string name)
    {
        using var algorithm = System.Security.Cryptography.MD5.Create();
        var namespaceBytes = namespaceId.ToByteArray();
        var nameBytes = System.Text.Encoding.UTF8.GetBytes(name);
        var input = new byte[namespaceBytes.Length + nameBytes.Length];
        Buffer.BlockCopy(namespaceBytes, 0, input, 0, namespaceBytes.Length);
        Buffer.BlockCopy(nameBytes, 0, input, namespaceBytes.Length, nameBytes.Length);
        var hash = algorithm.ComputeHash(input);
        return new Guid(hash);
    }
}
