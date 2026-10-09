using API.Application.Common;
using API.Application.Procurement;
using API.Application.Projects;
using API.Authorization;
using API.Contracts.Procurement;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
// Procurement access is configured, not compiled in: a SuperAdmin granting
// this page to another role takes effect without a redeploy.
// GET endpoints are open to any authenticated user; the service layer
// filters results to what the caller is allowed to see.
[Authorize]
public class ConsumableIndentsController(
    ConsumableIndentService indentService,
    IIndentBudgetValidator budgetValidator,
    IApplicationDbContext db,
    IProjectService projectService) : IndentControllerBase(indentService)
{
    [HttpPost("api/projects/{projectId:guid}/consumable-indents")]
    [Consumes("multipart/form-data")]
    [PageAccess("procurement.list")]
    public Task<ActionResult<Guid>> Raise(
        Guid projectId, [FromForm] RaiseIndentRequest request, CancellationToken ct)
        => RaiseCoreAsync(projectId, request, ct);

    [HttpGet("api/projects/{projectId:guid}/consumable-indents")]
    public Task<ActionResult<IReadOnlyList<IndentListItemResponse>>> List(Guid projectId, CancellationToken ct)
        => ListCoreAsync(projectId, ct);

    [HttpGet("api/consumable-indents/{id:guid}")]
    public Task<ActionResult<IndentResponse>> Get(Guid id, CancellationToken ct)
        => GetCoreAsync(id, ct);

    [HttpPost("api/consumable-indents/{id:guid}/process-bill")]
    [PageAccess("procurement.list")]
    public Task<IActionResult> ProcessBill(Guid id, [FromBody] ProcessBillRequest request, CancellationToken ct)
        => ProcessBillCoreAsync(id, request, ct);

    [HttpPost("api/consumable-indents/{id:guid}/forward")]
    public Task<IActionResult> Forward(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ForwardCoreAsync(id, request, ct);

    [HttpPost("api/consumable-indents/{id:guid}/forward-to-director")]
    public Task<IActionResult> ForwardToDirector(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ForwardToDirectorCoreAsync(id, request, ct);

    [HttpPost("api/consumable-indents/{id:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ApproveCoreAsync(id, request, ct);

    [HttpPost("api/consumable-indents/{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => RejectCoreAsync(id, request, ct);

    [HttpPost("api/consumable-indents/{id:guid}/return")]
    public Task<IActionResult> Return(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ReturnCoreAsync(id, request, ct);

    [HttpGet("api/consumable-indents/{id:guid}/market-committee")]
    public Task<ActionResult<MarketCommitteeStepsResponse?>> GetMarketCommitteeSteps(Guid id, CancellationToken ct)
        => GetMarketCommitteeStepsCoreAsync(id, ct);

    [HttpPost("api/consumable-indents/{id:guid}/market-committee")]
    public Task<IActionResult> RecordMarketCommitteeStep(Guid id, [FromBody] RecordMarketCommitteeStepRequest request,
        CancellationToken ct)
        => RecordMarketCommitteeStepCoreAsync(id, request, ct);

    /// <summary>
    /// Budget availability for a head, so the UI can show what is left before the
    /// user submits. Type-agnostic, so it lives here only rather than on all three
    /// controllers.
    /// </summary>
    [HttpGet("api/budget-heads/{budgetHeadId:guid}/indent-budget")]
    public async Task<ActionResult<IndentBudgetSnapshotResponse>> GetBudget(
        Guid budgetHeadId, [FromQuery] OverheadSubHead? subHead, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // The validator keys off the budget head alone, so the ownership check has
        // to happen here -- without it any authenticated user could read another
        // project's sanctioned, committed and paid figures. Reuses
        // ProjectService.GetAsync's full visibility rule (owner, RnC Office
        // roles, HOD of the project's own department, active Fellow) rather
        // than re-deriving a narrower owner-or-Fellow-only check here --
        // GetAsync throws ProjectAccessDeniedException itself when none of
        // those hold, which ProjectExceptionMiddleware maps to 403.
        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == budgetHeadId, ct);
        if (head is null)
        {
            return NotFound();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await projectService.GetAsync(head.ProjectId, userId.Value, User.GetRoles(), ct);

        var snapshot = await budgetValidator.GetSnapshotAsync(budgetHeadId, today, ct, subHead: subHead);

        return Ok(new IndentBudgetSnapshotResponse(
            snapshot.Sanctioned, snapshot.Committed, snapshot.Paid, snapshot.Available));
    }

    /// <summary>
    /// Single API call to retrieve all indents across visible projects for the
    /// Indent Approvals page. Eliminates frontend N+1 project-loop calls.
    /// </summary>
    /// <remarks>
    /// This is IndentApprovalPage's data source (hod.indents, HOD-only,
    /// Department scope) -- so it must be gated the same way, not by the
    /// class-level procurement.list (Faculty/HOD, Own), which would let any
    /// Faculty member pull every visible project's indents. Visibility itself
    /// reuses ProjectService.ListVisibleToAsync, the same institute/department/
    /// own scoping already applied to the project list.
    /// </remarks>
    [HttpGet("api/procurement/all-indents")]
    [Authorize]
    public async Task<ActionResult> GetAllProcurementIndents(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var visibleProjects = await projectService.ListVisibleToAsync(userId.Value, User.GetRoles(), ct);
        var userProjects = visibleProjects.ToDictionary(p => p.Id, p => new { p.ProjectTitle, p.OwnerUserId });

        var projectIds = userProjects.Keys.ToList();

        var consumable = await db.ConsumableIndents
            .Where(i => projectIds.Contains(i.ProjectId))
            .ToListAsync(ct);

        var contingency = await db.ContingencyIndents
            .Where(i => projectIds.Contains(i.ProjectId))
            .ToListAsync(ct);

        var equipment = await db.EquipmentIndents
            .Where(i => projectIds.Contains(i.ProjectId))
            .ToListAsync(ct);

        var dynamicIndents = await db.Indents
            .Include(i => i.Items)
            .Where(i => projectIds.Contains(i.ProjectId))
            .ToListAsync(ct);

        var workflowIds = consumable.Select(i => i.WorkflowInstanceId)
            .Concat(contingency.Select(i => i.WorkflowInstanceId))
            .Concat(equipment.Select(i => i.WorkflowInstanceId))
            .Concat(dynamicIndents.Select(i => i.WorkflowInstanceId))
            .ToHashSet();

        var workflowStages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id) && w.Phase == API.Domain.Enums.WorkflowPhase.Indent)
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var facultyIds = userProjects.Values.Select(p => p.OwnerUserId.ToString()).Distinct().ToList();
        var facultyProfiles = await db.FacultyProfiles
            .Where(f => facultyIds.Contains(f.UserId))
            .ToDictionaryAsync(f => f.UserId, f => f.Name ?? string.Empty, ct);

        var budgetHeadIds = consumable.Select(i => i.BudgetHeadId)
            .Concat(contingency.Select(i => i.BudgetHeadId))
            .Concat(equipment.Select(i => i.BudgetHeadId))
            .Concat(dynamicIndents.Select(i => i.BudgetHeadId))
            .Distinct().ToList();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var budgetSnapshots = new Dictionary<Guid, IndentBudgetSnapshot>();
        foreach (var headId in budgetHeadIds)
        {
            try
            {
                var snap = await budgetValidator.GetSnapshotAsync(headId, today, ct);
                budgetSnapshots[headId] = snap;
            }
            catch
            {
                // Fallback snapshot if budget head not found
            }
        }

        var result = new List<object>();

        foreach (var item in consumable)
        {
            userProjects.TryGetValue(item.ProjectId, out var proj);
            facultyProfiles.TryGetValue(proj?.OwnerUserId.ToString() ?? string.Empty, out var piName);
            workflowStages.TryGetValue(item.WorkflowInstanceId, out var stage);
            budgetSnapshots.TryGetValue(item.BudgetHeadId, out var snap);

            result.Add(new {
                id = item.Id,
                indentType = "Consumable",
                itemCategory = "Consumable",
                itemName = item.Name,
                estimatedCost = item.EstimatedCost,
                indenterName = !string.IsNullOrWhiteSpace(piName) ? piName : "Project PI",
                projectTitle = proj?.ProjectTitle ?? "Research Project",
                projectId = item.ProjectId,
                budgetHeadId = item.BudgetHeadId,
                workflowInstanceId = item.WorkflowInstanceId,
                sanctionedBudget = snap?.Sanctioned ?? 0m,
                committedBudget = snap?.Committed ?? 0m,
                paidBudget = snap?.Paid ?? 0m,
                availableBudget = snap?.Available ?? 0m,
                nonAvailabilityCertificateNumber = item.NonAvailabilityCertificateNumber,
                nonAvailabilityCertificateIssueDate = item.NonAvailabilityCertificateIssueDate,
                nonAvailabilityCertificateValidityDate = item.NonAvailabilityCertificateValidityDate,
                quotationDate = item.QuotationDate,
                eWayBillNumber = item.EWayBillNumber,
                eWayBillPartA = item.EWayBillPartA,
                eWayBillPartB = item.EWayBillPartB,
                paymentRouting = item.PaymentRouting ?? "Party Payment",
                miscellaneousExpenditure = item.MiscellaneousExpenditure ?? 0m,
                biddingNumber = item.BiddingNumber,
                bidPublicationDate = item.BidPublicationDate,
                purchaseOrderNumber = item.PurchaseOrderNumber,
                purchaseOrderDate = item.PurchaseOrderDate,
                bindingLocation = item.BindingLocation ?? "Prayagraj",
                comparativeStatementNumber = item.ComparativeStatementNumber,
                comparativeStatementSigned = item.ComparativeStatementSigned,
                createdAt = item.CreatedAt,
                currentStage = stage.ToString(),
                gemAvailability = item.GemAvailability.ToString()
            });
        }

        foreach (var item in contingency)
        {
            userProjects.TryGetValue(item.ProjectId, out var proj);
            facultyProfiles.TryGetValue(proj?.OwnerUserId.ToString() ?? string.Empty, out var piName);
            workflowStages.TryGetValue(item.WorkflowInstanceId, out var stage);
            budgetSnapshots.TryGetValue(item.BudgetHeadId, out var snap);

            result.Add(new {
                id = item.Id,
                indentType = "Contingency",
                itemCategory = "Consumable",
                itemName = item.Name,
                estimatedCost = item.EstimatedCost,
                indenterName = !string.IsNullOrWhiteSpace(piName) ? piName : "Project PI",
                projectTitle = proj?.ProjectTitle ?? "Research Project",
                projectId = item.ProjectId,
                budgetHeadId = item.BudgetHeadId,
                workflowInstanceId = item.WorkflowInstanceId,
                sanctionedBudget = snap?.Sanctioned ?? 0m,
                committedBudget = snap?.Committed ?? 0m,
                paidBudget = snap?.Paid ?? 0m,
                availableBudget = snap?.Available ?? 0m,
                nonAvailabilityCertificateNumber = item.NonAvailabilityCertificateNumber,
                nonAvailabilityCertificateIssueDate = item.NonAvailabilityCertificateIssueDate,
                nonAvailabilityCertificateValidityDate = item.NonAvailabilityCertificateValidityDate,
                paymentRouting = item.PaymentRouting ?? "Party Payment",
                miscellaneousExpenditure = item.MiscellaneousExpenditure ?? 0m,
                biddingNumber = item.BiddingNumber,
                bidPublicationDate = item.BidPublicationDate,
                purchaseOrderNumber = item.PurchaseOrderNumber,
                purchaseOrderDate = item.PurchaseOrderDate,
                bindingLocation = item.BindingLocation ?? "Prayagraj",
                comparativeStatementNumber = item.ComparativeStatementNumber,
                comparativeStatementSigned = item.ComparativeStatementSigned,
                createdAt = item.CreatedAt,
                currentStage = stage.ToString(),
                gemAvailability = item.GemAvailability.ToString()
            });
        }

        foreach (var item in equipment)
        {
            userProjects.TryGetValue(item.ProjectId, out var proj);
            facultyProfiles.TryGetValue(proj?.OwnerUserId.ToString() ?? string.Empty, out var piName);
            workflowStages.TryGetValue(item.WorkflowInstanceId, out var stage);
            budgetSnapshots.TryGetValue(item.BudgetHeadId, out var snap);

            result.Add(new {
                id = item.Id,
                indentType = "Equipment",
                itemCategory = "Non-Consumable",
                itemName = item.Name,
                estimatedCost = item.EstimatedCost,
                indenterName = !string.IsNullOrWhiteSpace(piName) ? piName : "Project PI",
                projectTitle = proj?.ProjectTitle ?? "Research Project",
                projectId = item.ProjectId,
                budgetHeadId = item.BudgetHeadId,
                workflowInstanceId = item.WorkflowInstanceId,
                sanctionedBudget = snap?.Sanctioned ?? 0m,
                committedBudget = snap?.Committed ?? 0m,
                paidBudget = snap?.Paid ?? 0m,
                availableBudget = snap?.Available ?? 0m,
                nonAvailabilityCertificateNumber = item.NonAvailabilityCertificateNumber,
                nonAvailabilityCertificateIssueDate = item.NonAvailabilityCertificateIssueDate,
                nonAvailabilityCertificateValidityDate = item.NonAvailabilityCertificateValidityDate,
                quotationDate = item.QuotationDate,
                eWayBillNumber = item.EWayBillNumber,
                eWayBillPartA = item.EWayBillPartA,
                eWayBillPartB = item.EWayBillPartB,
                measurementBookNumber = item.MeasurementBookNumber,
                paymentRouting = item.PaymentRouting ?? "Party Payment",
                miscellaneousExpenditure = item.MiscellaneousExpenditure ?? 0m,
                biddingNumber = item.BiddingNumber,
                bidPublicationDate = item.BidPublicationDate,
                purchaseOrderNumber = item.PurchaseOrderNumber,
                purchaseOrderDate = item.PurchaseOrderDate,
                bindingLocation = item.BindingLocation ?? "Prayagraj",
                comparativeStatementNumber = item.ComparativeStatementNumber,
                comparativeStatementSigned = item.ComparativeStatementSigned,
                createdAt = item.CreatedAt,
                currentStage = stage.ToString(),
                gemAvailability = item.GemAvailability.ToString()
            });
        }

        foreach (var item in dynamicIndents)
        {
            userProjects.TryGetValue(item.ProjectId, out var proj);
            facultyProfiles.TryGetValue(proj?.OwnerUserId.ToString() ?? string.Empty, out var piName);
            workflowStages.TryGetValue(item.WorkflowInstanceId, out var stage);
            budgetSnapshots.TryGetValue(item.BudgetHeadId, out var snap);

            var firstItem = item.Items.FirstOrDefault();
            var itemName = firstItem?.Name ?? item.Purpose ?? "Indent Item";
            var totalCost = item.Items.Sum(i => i.EstimatedCostInclTax);

            result.Add(new {
                id = item.Id,
                indentType = item.IndentType.ToString(),
                itemCategory = item.IndentType == IndentType.Equipment ? "Non-Consumable" : "Consumable",
                itemName = itemName,
                estimatedCost = totalCost,
                indenterName = !string.IsNullOrWhiteSpace(piName) ? piName : "Project PI",
                projectTitle = proj?.ProjectTitle ?? "Research Project",
                projectId = item.ProjectId,
                budgetHeadId = item.BudgetHeadId,
                workflowInstanceId = item.WorkflowInstanceId,
                sanctionedBudget = snap?.Sanctioned ?? 0m,
                committedBudget = snap?.Committed ?? 0m,
                paidBudget = snap?.Paid ?? 0m,
                availableBudget = snap?.Available ?? 0m,
                nonAvailabilityCertificateNumber = item.NonAvailabilityCertificateNumber,
                nonAvailabilityCertificateIssueDate = item.NonAvailabilityCertificateIssueDate,
                nonAvailabilityCertificateValidityDate = item.NonAvailabilityCertificateValidityDate,
                quotationDate = item.QuotationDate,
                eWayBillNumber = item.EWayBillNumber,
                eWayBillPartA = item.EWayBillPartA,
                eWayBillPartB = item.EWayBillPartB,
                measurementBookNumber = item.MeasurementBookNumber,
                paymentRouting = item.PaymentRouting ?? "Party Payment",
                miscellaneousExpenditure = item.MiscellaneousExpenditure ?? 0m,
                biddingNumber = item.BiddingNumber,
                bidPublicationDate = item.BidPublicationDate,
                purchaseOrderNumber = item.PurchaseOrderNumber,
                purchaseOrderDate = item.PurchaseOrderDate,
                bindingLocation = item.BindingLocation ?? "Prayagraj",
                comparativeStatementNumber = item.ComparativeStatementNumber,
                comparativeStatementSigned = item.ComparativeStatementSigned,
                createdAt = item.CreatedAt,
                currentStage = stage.ToString(),
                gemAvailability = item.GemAvailability.ToString()
            });
        }

        return Ok(result);
    }
}
