using API.Application.Proposals;
using API.Authorization;
using API.Contracts.Proposals;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Research proposals, BRD Prompt 1. The eight-stage internal chain
/// (Draft..WithDean) is enforced by the workflow engine reading the roles on
/// each stage of the stored route, not by attributes here -- the same shape
/// <see cref="WorkflowController"/> uses. Ownership (a PI acting on someone
/// else's draft) and department scope (an HOD's own queue) are enforced by
/// <see cref="IResearchProposalService"/> itself.
/// </summary>
/// <remarks>
/// Do not add <c>[Authorize(Roles = ...)]</c> or <c>[PageAccess]</c> to the
/// chain actions (Forward/Reject/Return/Approve): a static role/page gate
/// would silently override the configured route the same way a hardcoded
/// role list did before Phase 7, and a SuperAdmin editing who may act at a
/// stage would appear to do nothing.
///
/// RecordAgencySubmission, RecordSanction, RecordNotFunded and ExtendExpiry
/// are the exception -- they happen after the internal chain has already
/// concluded (Status = Approved / SubmittedToAgency), so no workflow stage
/// protects them. ExtendExpiry stays RnC-office-only, gated via
/// <c>[PageAccess("proposals-rnc.agency-actions")]</c> -- a database-backed
/// permission a SuperAdmin can widen or narrow from /admin/roles. The other
/// three are also reachable by the PI for their own proposal (they sometimes
/// handle the agency submission/outcome themselves), so they carry no
/// [PageAccess] and are instead gated inside
/// <see cref="IResearchProposalService"/> by RequireOfficeOrOwnerAsync.
/// </remarks>
[ApiController]
[Route("api/proposals")]
[Authorize]
public class ProposalsController(
    IResearchProposalService proposals, UserManager<ApplicationUser> userManager) : ControllerBase
{

    [HttpPost]
    public async Task<ActionResult<Guid>> CreateDraft(
        CreateProposalDraftRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var id = await proposals.CreateDraftAsync(
            new CreateProposalDraftInput(
                body.Title, body.ProposalType, body.Agency, body.AdvertisementReference, body.DurationMonths, body.OverheadPercent,
                body.BudgetLines.Select(l => new ProposalBudgetLineInput(l.HeadName, l.YearAmounts, l.IncludeInOverhead, l.CustomLabel)).ToList(),
                (body.Equipment ?? []).Select(e => new ProposalEquipmentInput(e.Name, e.Unit, e.Amount)).ToList(),
                (body.Manpower ?? []).Select(m => new ProposalManpowerPositionInput(m.Designation, m.Positions, m.HraPercent, m.StipendByYear)).ToList(),
                (body.CoPis ?? []).Select(c => new ProposalCoPiInput(c.Name, c.Department, c.Designation, c.IsInsideInstitute, c.InstituteName)).ToList()),
            userId.Value, ct);

        return CreatedAtAction(nameof(Get), new { id }, id);
    }

    /// <summary>
    /// Editing at any non-terminal status -- the funding agency can revise
    /// the ask even after internal approval. No [PageAccess]: office-or-owner
    /// reach is enforced inside IResearchProposalService.UpdateAsync, same
    /// pattern as RecordAgencySubmission above.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateProposalRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.UpdateAsync(
            id, userId.Value, User.GetRoles(),
            new UpdateProposalInput(
                body.Title, body.ProposalType, body.Agency, body.AdvertisementReference, body.DurationMonths, body.OverheadPercent,
                body.BudgetLines.Select(l => new ProposalBudgetLineInput(l.HeadName, l.YearAmounts, l.IncludeInOverhead, l.CustomLabel)).ToList(),
                (body.Equipment ?? []).Select(e => new ProposalEquipmentInput(e.Name, e.Unit, e.Amount)).ToList(),
                (body.Manpower ?? []).Select(m => new ProposalManpowerPositionInput(m.Designation, m.Positions, m.HraPercent, m.StipendByYear)).ToList(),
                (body.CoPis ?? []).Select(c => new ProposalCoPiInput(c.Name, c.Department, c.Designation, c.IsInsideInstitute, c.InstituteName)).ToList()),
            ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, ProposalActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.SubmitForApprovalAsync(id, userId.Value, body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/forward")]
    public async Task<IActionResult> Forward(Guid id, ProposalActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.ForwardAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    /// <summary>
    /// The R&amp;C office's WithRnCOffice-stage action: names a specific
    /// RegularStaff person as the Dealing Assistant instead of leaving the
    /// proposal open to whichever RegularStaff account acts on it first.
    /// </summary>
    [HttpPost("{id:guid}/assign-dealing-assistant")]
    public async Task<IActionResult> AssignToDealingAssistant(
        Guid id, AssignToDealingAssistantRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.AssignToDealingAssistantAsync(
            id, body.AssigneeUserId, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, ProposalActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.RejectAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/return")]
    public async Task<IActionResult> Return(Guid id, ProposalActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.ReturnAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, ProposalActionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.ApproveAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    /// <summary>
    /// No [PageAccess] here, unlike RecordSanction/RecordNotFunded's sibling
    /// gate below on ExtendExpiry: a PI sometimes submits their own approved
    /// proposal to the agency, not only the RnC office, so
    /// RequireOfficeOrOwnerAsync (inside RecordAgencySubmissionAsync) is the
    /// real gate -- Office roles may act on any proposal, a PI only their own.
    /// </summary>
    [HttpPost("{id:guid}/record-agency-submission")]
    public async Task<IActionResult> RecordAgencySubmission(
        Guid id, RecordAgencySubmissionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.RecordAgencySubmissionAsync(id, userId.Value, User.GetRoles(), body.SubmittedOn, ct);
        return NoContent();
    }

    /// <summary>
    /// Records the funding agency's sanction. The only endpoint that can create
    /// a Project -- see <c>ResearchProposalService.RecordSanctionAsync</c>.
    /// Same office-or-owner reach as RecordAgencySubmission above.
    /// </summary>
    [HttpPost("{id:guid}/record-sanction")]
    public async Task<ActionResult<Guid>> RecordSanction(
        Guid id, RecordSanctionRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var projectId = await proposals.RecordSanctionAsync(
            id, userId.Value, User.GetRoles(),
            new RecordSanctionInput(body.SanctionNo, body.SanctionDate, body.ProjectStartDate, body.TotalSanctioned),
            ct);

        return Ok(projectId);
    }

    /// <summary>Same office-or-owner reach as RecordAgencySubmission above.</summary>
    [HttpPost("{id:guid}/record-not-funded")]
    public async Task<IActionResult> RecordNotFunded(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.RecordNotFundedAsync(id, userId.Value, User.GetRoles(), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/withdraw")]
    public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.WithdrawAsync(id, userId.Value, ct);
        return NoContent();
    }

    /// <summary>RnC office only -- like RecordAgencySubmission/RecordSanction/
    /// RecordNotFunded above, this happens outside the internal workflow chain,
    /// so no stage protects it and it must be gated here explicitly.</summary>
    [HttpPost("{id:guid}/extend-expiry")]
    [PageAccess("proposals-rnc.agency-actions")]
    public async Task<IActionResult> ExtendExpiry(Guid id, [FromQuery] int additionalDays = 21, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await proposals.ExtendExpiryAsync(id, userId.Value, additionalDays, ct);
        return NoContent();
    }

    /// <summary>
    /// Undoes the actor's own most recent action on this proposal, provided
    /// nothing has happened since -- see IResearchProposalService.UndoLastActionAsync.
    /// Same office-or-owner reach as RecordAgencySubmission above.
    /// </summary>
    [HttpPost("{id:guid}/undo")]
    public async Task<IActionResult> Undo(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await proposals.UndoLastActionAsync(id, userId.Value, User.GetRoles());
        return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProposalResponse>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(ToResponse(await proposals.GetAsync(id, userId.Value, ct)));
    }

    [HttpGet("mine")]
    public async Task<ActionResult<object>> ListOwn(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var paged = await proposals.ListOwnAsync(userId.Value, page, pageSize, ct);
        return Ok(new
        {
            items = paged.Items.Select(ToResponse).ToList(),
            totalCount = paged.TotalCount,
            page = paged.Page,
            pageSize = paged.PageSize,
            totalPages = paged.TotalPages,
            hasPreviousPage = paged.HasPreviousPage,
            hasNextPage = paged.HasNextPage,
        });
    }

    /// <summary>
    /// The HOD's queue -- department-scoped by <c>IResearchProposalService</c>
    /// against the requesting HOD's own department.
    /// </summary>
    [HttpGet("for-hod")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<ProposalResponse>>> ListForHod(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok((await proposals.ListForHodAsync(userId.Value, ct)).Select(ToResponse).ToList());
    }

    /// <summary>
    /// The R&amp;C office queue -- institute-wide, unlike ListForHod, since
    /// office staff act across every department. Gated to the same roles as
    /// the agency actions below: an office account whose own department is
    /// not R&amp;C sees an empty list rather than an error, matching
    /// IResearchProposalService.ListForRnCOfficeAsync's own refusal.
    /// </summary>
    [HttpGet("for-rnc-office")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<ProposalResponse>>> ListForRnCOffice(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok((await proposals.ListForRnCOfficeAsync(userId.Value, ct)).Select(ToResponse).ToList());
    }

    /// <summary>
    /// Who the office can assign as Dealing Assistant -- every account holding
    /// RegularStaff, active only. Same audience as ListForRnCOffice: this is the
    /// dropdown behind AssignToDealingAssistant, which only makes sense to the
    /// people who would call it.
    /// </summary>
    [HttpGet("dealing-assistant-options")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<DealingAssistantOptionResponse>>> GetDealingAssistantOptions()
    {
        var staff = await userManager.GetUsersInRoleAsync("RegularStaff");
        return Ok(staff
            .Where(u => u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new DealingAssistantOptionResponse(u.Id, u.FullName, u.UserName ?? u.Id.ToString()))
            .ToList());
    }

    private static ProposalResponse ToResponse(ResearchProposalSummary s) => new(
        s.Id, s.OwnerUserId, s.DepartmentId, s.Title, s.ProposalType, s.Agency, s.ProposedAmount, s.OverheadAmount, s.OverheadPercent,
        s.DurationMonths, s.Status, s.WorkflowInstanceId, s.CurrentStage, s.ExpiresAt, s.SubmittedToAgencyOn,
        s.AgencyDecisionOn, s.ProjectId, s.CreatedAt,
        s.BudgetLines.Select(l => new ProposalBudgetLineResponse(l.HeadName, l.YearAmounts, l.IncludeInOverhead, l.CustomLabel)).ToList(),
        s.Equipment.Select(e => new ProposalEquipmentResponse(e.Name, e.Unit, e.Amount)).ToList(),
        s.Manpower.Select(m => new ProposalManpowerPositionResponse(m.Designation, m.Positions, m.HraPercent, m.StipendByYear, m.HraByYear)).ToList(),
        s.TotalAmount,
        s.CoPis.Select(c => new ProposalCoPiResponse(c.Name, c.Department, c.Designation, c.IsInsideInstitute, c.InstituteName)).ToList());

}
