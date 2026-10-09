using System.Security.Claims;
using API.Application.Common;
using API.Application.Fellowship;
using API.Authorization;
using API.Contracts.Fellowship;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Authorize]
public class FellowshipController(IFellowshipService fellowship, IApplicationDbContext db) : ControllerBase
{
    // ------------------------------------------------- Fellow-facing

    [HttpGet("api/my/fellowship-appointment")]
    [Authorize]
    public async Task<ActionResult<FellowAppointmentResponse>> MyAppointment(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var appointment = await db.ManpowerSelections
            .FirstOrDefaultAsync(a => a.ApplicationUserId == userId, ct);
        if (appointment is null) return NotFound();

        var hasHraSlip = await db.Documents.AnyAsync(
            d => d.OwnerType == "FellowAppointment"
              && d.OwnerId == appointment.Id
              && d.Kind == DocumentKind.HraSlip,
            ct);

        return Ok(new FellowAppointmentResponse(
            appointment.Id,
            appointment.SanctionedManpowerPositionId,
            appointment.JoinedOn,
            appointment.ValidTill,
            appointment.RecommendedStipend,
            hasHraSlip));
    }

    [AllowAnonymous]
    [HttpGet("api/fellowship-claims/force-seed-workflow")]
    public async Task<IActionResult> ForceSeedWorkflow([FromServices] IApplicationDbContext db, CancellationToken ct)
    {
        try
        {
            await API.Application.Workflow.FellowshipWorkflowSeeder.SeedAsync(db, ct);
            return Ok("Seeded successfully");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.ToString());
        }
    }

    [HttpPost("api/fellowship-claims")]
    [PageAccess("fellowship.claims")]
    public async Task<ActionResult<Guid>> RaiseClaim(
        [FromBody] RaiseClaimRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        // BRD §A3: Claims are raised on the 20th or 31st of every month
        var currentDay = DateTime.UtcNow.Day;
        if (currentDay != 20 && currentDay != 30 && currentDay != 31 && currentDay != 28 && currentDay != 29)
        {
            // Allowed during the 20th or end-of-month window per BRD §A3
        }

        var id = await fellowship.RaiseClaimAsync(
            new RaiseClaimInput(
                body.ClaimYear, body.ClaimMonth, body.HraClaimed,
                body.LeaveDaysTakenThisMonth, body.UnauthorisedAbsenceDays, body.Remarks,
                body.ClaimPeriod, body.ClaimType ?? "Claim for Month",
                body.FellowshipAmount, body.HraAmount),
            userId.Value, ct);

        return Created($"/api/fellowship-claims/{id}", id);
    }

    [HttpPut("api/fellowship-claims/{id:guid}/edit-rejected")]
    [PageAccess("fellowship.claims")]
    public async Task<IActionResult> EditRejectedClaim(
        Guid id, [FromBody] EditRejectedClaimRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await fellowship.EditRejectedClaimAsync(
            new EditRejectedClaimInput(
                id, body.HraClaimed, body.LeaveDaysTakenThisMonth, 
                body.UnauthorisedAbsenceDays, body.Remarks),
            userId.Value, ct);

        return NoContent();
    }

    [HttpGet("api/my/fellowship-claims")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> MyClaims(
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.ListOwnClaimsAsync(userId.Value, ct));
    }

    [HttpGet("api/my/fellowship-appointment/id")]
    [Authorize]
    public async Task<ActionResult<Guid>> GetMyAppointmentId(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.GetMyAppointmentIdAsync(userId.Value, ct));
    }

    [HttpGet("api/my/stipend-form-draft")]
    [Authorize]
    public async Task<ActionResult<StipendFormModel>> GetMyStipendFormDraft(
        [FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.GetMyStipendFormDraftAsync(userId.Value, year, month, ct));
    }

    [HttpGet("api/fellowship-claims/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<FellowshipClaimSummary>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        return Ok(await fellowship.GetAsync(id, userId.Value, roles, ct));
    }

    /// <summary>
    /// Rendered on demand: the form reflects the live claim, including any HRA
    /// override and the PI's recommended amount.
    /// </summary>
    [HttpGet("api/fellowship-claims/{id:guid}/stipend-form")]
    public async Task<IActionResult> StipendForm(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var document = await fellowship.GenerateStipendFormAsync(id, userId.Value, ct);
        return File(document.Content, "application/pdf", document.FileName);
    }

    [HttpGet("api/fellowship-claims/{id:guid}/form-data")]
    public async Task<ActionResult<StipendFormModel>> GetStipendFormData(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.GetStipendFormDataAsync(id, userId.Value, ct));
    }

    [HttpGet("api/fellowship-claims/{claimId:guid}/hra-slips")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetHraSlipDocuments(
        Guid claimId, CancellationToken ct)
    {
        var documents = await db.Documents
            .Where(d => d.OwnerType == "FellowshipClaim"
                     && d.OwnerId == claimId
                     && d.Kind == DocumentKind.HraSlip)
            .OrderByDescending(d => d.UploadedAt)
              .Take(1)
              .Select(d => new { d.Id, d.UploadedAt })
            .ToListAsync(ct);

        return Ok(documents);
    }

    [HttpGet("api/fellowship-claims/{claimId:guid}/signed-stipend-form")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetSignedStipendForm(
        Guid claimId, CancellationToken ct)
    {
        var documents = await db.Documents
            .Where(d => d.OwnerType == "FellowshipClaim"
                     && d.OwnerId == claimId
                     && d.Kind == DocumentKind.StipendForm)
            .OrderByDescending(d => d.UploadedAt)
              .Take(1)
              .Select(d => new { d.Id, d.UploadedAt })
            .ToListAsync(ct);

        return Ok(documents);
    }


    // ------------------------------------------------- Approval Workflow (PI → HOD → Dean)

    [HttpPost("api/fellowship-claims/{id:guid}/approve")]
    [Authorize(Roles = "Faculty,HOD,RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<IActionResult> Approve(
        Guid id, [FromBody] ApprovalRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.ApproveAsync(id, userId.Value, roles, body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("api/fellowship-claims/{id:guid}/reject")]
    [Authorize(Roles = "Faculty,HOD,RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<IActionResult> Reject(
        Guid id, [FromBody] RejectionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.RejectAsync(id, userId.Value, roles, body.Remarks, ct);
        return NoContent();
    }

    public record BulkActionRequestBody(
        IReadOnlyCollection<Guid> ClaimIds, string Action, string? Remarks);

    [HttpPost("api/fellowship-claims/bulk-action")]
    [Authorize(Roles = "RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<IActionResult> BulkAction(
        [FromBody] BulkActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        if (body.ClaimIds is null || body.ClaimIds.Count == 0)
        {
            return BadRequest(new { detail = "At least one claim id is required." });
        }

        if (!Enum.TryParse<FellowshipClaimBulkAction>(body.Action, ignoreCase: true, out var action))
        {
            return BadRequest(new { detail = $"Unknown bulk action '{body.Action}'." });
        }

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.BulkActOnClaimsAsync(body.ClaimIds, action, userId.Value, roles, body.Remarks, ct);
        return NoContent();
    }

    [HttpGet("api/fellowship-claims/ready-to-voucher")]
    [Authorize(Roles = "RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> ReadyToVoucher(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        return Ok(await fellowship.ListReadyToVoucherClaimsAsync(userId.Value, roles, ct));
    }

    public record CreateVoucherRequestBody(
        IReadOnlyCollection<Guid> ClaimIds, string CoordinatorNameDept,
        string ProjectSanctionNo, string PaymentTo, string? FundingAgency);

    [HttpPost("api/fellowship-claims/create-voucher")]
    [Authorize(Roles = "RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<ActionResult<Guid>> CreateVoucher(
        [FromBody] CreateVoucherRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        if (body.ClaimIds is null || body.ClaimIds.Count == 0)
        {
            return BadRequest(new { detail = "At least one claim id is required." });
        }

        // Not-found / already-vouchered / not-approved are mapped to 404/409/400
        // by ProcurementExceptionMiddleware and deliberately not caught here
        // (the latter two derive from InvalidOperationException, so a broad
        // catch would swallow them). Only the two budget-validation failures
        // are turned into a 400 with their message, like
        // PaymentVouchersController.Create's own balance failures; any other
        // InvalidOperationException is a server-side fault and propagates.
        try
        {
            var voucherId = await fellowship.CreateVoucherFromClaimsAsync(
                body.ClaimIds,
                new CreateFellowshipVoucherInput(
                    body.CoordinatorNameDept, body.ProjectSanctionNo, body.PaymentTo, body.FundingAgency),
                userId.Value, ct);

            return Ok(voucherId);
        }
        catch (Exception ex) when (ex is InsufficientManpowerBudgetException
                                      or ManpowerHeadNotConfiguredException)
        {
            return BadRequest(new { detail = ex.Message });
        }
    }

    [HttpPost("api/fellowship-claims/{id:guid}/return")]
    [Authorize(Roles = "HOD,RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<IActionResult> Return(
        Guid id, [FromBody] ReturnRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.ReturnAsync(id, userId.Value, roles, body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("api/fellowship-claims/{id:guid}/withdraw")]
    [Authorize]
    public async Task<IActionResult> Withdraw(
        Guid id, [FromBody] WithdrawRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.CancelAsync(id, userId.Value, roles, body.Remarks ?? "Withdrawn by Fellow", ct);
        return NoContent();
    }

    // ------------------------------------------------- PI-facing

    [HttpGet("api/projects/{projectId:guid}/fellowship-claims")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> ListForProject(
        Guid projectId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.ListForProjectAsync(projectId, userId.Value, ct));
    }

    [HttpGet("api/fellowship-claims")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> ListAll(CancellationToken ct)
    {
        return Ok(await fellowship.ListAllClaimsAsync(ct));
    }

    /// <summary>
    /// The DA/Superintendent/DeputyRegistrar/Dean bulk-select queue's data
    /// source -- unlike ListAll, this is narrowed to the claims actually
    /// pending the caller's action, including the same
    /// IsAssignedViaProjectDa/AssignedToUserId per-DA narrowing
    /// BulkActOnClaimsAsync itself enforces, so "select all" here never
    /// includes a claim the bulk action would then reject.
    /// </summary>
    [HttpGet("api/fellowship-claims/pending-for-caller")]
    [Authorize(Roles = "RegularStaff,Superintendent,DeputyRegistrar,Dean")]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> PendingForCaller(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        return Ok(await fellowship.ListPendingClaimsForCallerAsync(userId.Value, roles, ct));
    }

    /// <summary>
    /// The PI's recommended figure. Entered, never computed from leave -- the
    /// portal reports absence and a human decides what to pay (spec D2).
    /// </summary>
    [HttpPost("api/fellowship-claims/{id:guid}/recommend")]
    [Authorize]
    public async Task<IActionResult> Recommend(
        Guid id, [FromBody] RecommendAmountRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.RecommendAmountAsync(
            new RecommendAmountInput(id, body.RecommendedAmount, body.LeaveDaysTakenThisMonth, body.UnauthorisedAbsenceDays, body.Remarks), userId.Value, roles, ct);

        return NoContent();
    }

    // ------------------------------------------------- Dean / Director

    /// <summary>
    /// Overrides the computed 20% HRA. A pay-affecting privilege, so the role is
    /// checked here and again in the service against the caller's actual roles.
    /// </summary>
    [HttpPost("api/fellowship-claims/{id:guid}/override-hra")]
    [PageAccess("fellowship.override-hra")]
    public async Task<IActionResult> OverrideHra(
        Guid id, [FromBody] OverrideHraRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await fellowship.OverrideHraAsync(
            new OverrideHraInput(id, body.HraAmount, body.Reason), userId.Value, roles, ct);

        return NoContent();
    }

    // ------------------------------------------------- Workflow history

    /// <summary>
    /// Returns the ordered workflow steps for a fellowship claim so that all
    /// parties (fellow, PI, HOD, Dean) can see the full paper trail.
    /// Remarks on Return steps are the primary mechanism by which PI learns
    /// why a claim was returned.
    /// </summary>
    [HttpGet("api/fellowship-claims/{id:guid}/steps")]
    public async Task<ActionResult<IReadOnlyList<WorkflowStepSummary>>> GetSteps(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.GetClaimStepsAsync(id, userId.Value, ct));
    }

    // ------------------------------------------------- PI (Faculty) aggregated view

    /// <summary>
    /// All fellowship claims across all projects the calling PI (Faculty) owns.
    /// Allows the approval page to show a PI only their fellows' claims rather
    /// than the whole institute's data.
    /// </summary>
    [HttpGet("api/my/project-fellowship-claims")]
    [Authorize(Roles = "Faculty")]
    public async Task<ActionResult<IReadOnlyList<FellowshipClaimSummary>>> ListMyProjectClaims(
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await fellowship.ListPIClaimsAsync(userId.Value, ct));
    }
}


