using API.Application.Common;
using API.Domain.Enums;

namespace API.Application.Proposals;

public interface IResearchProposalService
{
    /// <summary>Raised by the PI. Not yet in the approval chain.</summary>
    Task<Guid> CreateDraftAsync(CreateProposalDraftInput input, Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// Draft -> UnderApproval. Raises the workflow instance, which is what
    /// starts the eight-stage chain. <paramref name="remarks"/> is the PI's
    /// own note travelling with the auto-generated Draft-to-WithHOD forward
    /// step; falls back to a fixed system message when left blank.
    /// </summary>
    Task SubmitForApprovalAsync(Guid proposalId, Guid piUserId, string? remarks = null, CancellationToken ct = default);

    /// <summary>Thin wrapper over <c>IWorkflowEngineService.ForwardAsync</c>.</summary>
    Task ForwardAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// The R&amp;C office names a specific RegularStaff person as the Dealing
    /// Assistant at WithRnCOffice, instead of leaving the proposal open to
    /// whichever RegularStaff account acts on it first. Thin wrapper over
    /// <c>IWorkflowEngineService.AssignAndForwardAsync</c>.
    /// </summary>
    Task AssignToDealingAssistantAsync(
        Guid proposalId, Guid assigneeUserId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Refuses the proposal outright. UnderApproval -> Rejected. Permitted only
    /// where the route's CanReject is true (Superintendent, DR, Dean).
    /// </summary>
    Task RejectAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Sends the proposal back for correction rather than concluding it.
    /// Re-enters at the Dealing Assistant stage (spec §4), not the Dean, and the
    /// PI resubmits from there via <see cref="ForwardAsync"/> -- Status stays
    /// UnderApproval throughout, since a returned proposal has not left the
    /// internal chain, only moved backward within it.
    /// </summary>
    Task ReturnAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// The Dean's sign-off. UnderApproval -> Approved. This is internal
    /// endorsement only -- it does not create a Project and does not commit any
    /// funding.
    /// </summary>
    Task ApproveAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Records that the proposal has been sent to the funding agency. Approved
    /// -> SubmittedToAgency. Outside the workflow engine: the internal chain
    /// has already concluded by this point. Callable by the RnC office for any
    /// proposal, or by the PI for their own -- a PI sometimes handles the
    /// agency submission themselves.
    /// </summary>
    Task RecordAgencySubmissionAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        DateOnly submittedOn, CancellationToken ct = default);

    /// <summary>
    /// The agency funded it. SubmittedToAgency -> Sanctioned, and this is the
    /// only method anywhere in this service -- or, so far as this phase adds,
    /// anywhere in the application -- that may create a Project. Every budget
    /// line becomes a BudgetHead row. Same office-or-owner reach as
    /// RecordAgencySubmissionAsync.
    /// </summary>
    Task<Guid> RecordSanctionAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        RecordSanctionInput input, CancellationToken ct = default);

    /// <summary>
    /// The agency declined, or did not respond. SubmittedToAgency -> NotFunded.
    /// Same office-or-owner reach as RecordAgencySubmissionAsync.
    /// </summary>
    Task RecordNotFundedAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default);

    /// <summary>
    /// Replaces title/agency/advertisement reference/duration/budget lines
    /// wholesale. Allowed at any non-terminal status (Draft, UnderApproval,
    /// Approved, SubmittedToAgency) -- a funding agency can revise the ask
    /// even after internal approval -- and locked at Sanctioned/NotFunded/
    /// Rejected/Withdrawn. Office-or-owner reach, same as
    /// RecordAgencySubmissionAsync. Does not touch WorkflowInstanceId,
    /// CurrentStage, or any workflow-engine state: a purely data-level edit,
    /// silent to the approval chain.
    /// </summary>
    Task UpdateAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        UpdateProposalInput input, CancellationToken ct = default);

    /// <summary>
    /// The PI withdraws their own proposal. Permitted prior to internal approval
    /// (Draft or UnderApproval).
    /// </summary>
    Task WithdrawAsync(Guid proposalId, Guid piUserId, CancellationToken ct = default);

    /// <summary>Extends workflow countdown timer (e.g. from 21 days to 42 days on special request per BRD §A1).</summary>
    Task ExtendExpiryAsync(Guid proposalId, Guid actorUserId, int additionalDays = 21, CancellationToken ct = default);

    Task<ResearchProposalSummary> GetAsync(Guid proposalId, Guid requestingUserId, CancellationToken ct = default);

    /// <summary>
    /// Cheap (OwnerUserId, DepartmentId) lookup for a proposal, without the
    /// full budget-line/equipment/manpower graph GetAsync loads. Used by
    /// workflow-step visibility filtering, which only needs to know who the
    /// PI and department are.
    /// </summary>
    Task<(Guid OwnerUserId, Guid DepartmentId)?> GetOwnershipAsync(Guid proposalId, CancellationToken ct = default);

    Task<PagedResult<ResearchProposalSummary>> ListOwnAsync(Guid piUserId, int page = 1, int pageSize = 10, CancellationToken ct = default);

    /// <summary>
    /// The HOD's queue, scoped to the requesting HOD's own department --
    /// Phase 8's IPageAccessService/IUserDepartmentProvider widening applies
    /// here exactly as it does for any other Department-scoped page.
    /// </summary>
    Task<IReadOnlyList<ResearchProposalSummary>> ListForHodAsync(Guid hodUserId, CancellationToken ct = default);

    /// <summary>
    /// The R&amp;C office queue: proposals sitting at any of the office-chain
    /// stages (WithRnCOffice, AssignedToDealingAssistant, WithSuperintendent,
    /// WithDeputyRegistrar, WithDean), across every department -- not just the
    /// caller's own. Office staff act institute-wide, unlike an HOD who is
    /// genuinely department-bound, so this checks the same thing
    /// PageAccessService.IsInstituteWideAsync does directly (the caller's own
    /// department is flagged IsInstituteWide) rather than filtering by a
    /// department that would not mean anything here. A caller whose own
    /// department is not institute-wide -- not R&amp;C staff, or a
    /// misconfigured account -- sees nothing, the same as
    /// PageAccessService.GetScopeAsync would have refused them the page grant
    /// on the real request.
    /// </summary>
    Task<IReadOnlyList<ResearchProposalSummary>> ListForRnCOfficeAsync(Guid officeUserId, CancellationToken ct = default);

    /// <summary>
    /// Every proposal currently at a stage the caller's own roles may act on,
    /// scoped to the caller's department (HOD-like roles) or institute-wide via
    /// R&amp;C membership (Office-like roles) -- exactly like
    /// <see cref="ListForHodAsync"/>/<see cref="ListForRnCOfficeAsync"/>'s own
    /// scoping, but strictly stage-matched rather than status-matched, for the
    /// dashboard's "pending my action" panel.
    /// </summary>
    Task<IReadOnlyList<ResearchProposalSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    /// <summary>
    /// Undoes the actor's own most recent action on this proposal. For every
    /// status except Sanctioned, this delegates to the workflow engine's own
    /// undo. For Sanctioned, RecordSanctionAsync's Project-creation is
    /// reversed directly (no WorkflowStep exists for it to undo at the engine
    /// level) -- but ONLY if the created Project has no GrantReceipt/
    /// BudgetReappropriationLog rows yet (i.e. genuinely untouched since
    /// sanction); otherwise this throws rather than silently leaving a
    /// half-unwound state.
    /// </summary>
    Task UndoLastActionAsync(Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default);
}

public record ProposalEquipmentInput(string Name, string Unit, decimal Amount);
public record ProposalManpowerPositionInput(
    string Designation, int Positions, decimal HraPercent, IReadOnlyList<decimal> StipendByYear);
public record ProposalCoPiInput(string Name, string Department, string Designation, bool IsInsideInstitute = false, string? InstituteName = null);

public record CreateProposalDraftInput(
    string Title,
    ProposalType ProposalType,
    string Agency,
    string? AdvertisementReference,
    int DurationMonths,
    decimal OverheadPercent,
    IReadOnlyList<ProposalBudgetLineInput> BudgetLines,
    IReadOnlyList<ProposalEquipmentInput> Equipment = null!,
    IReadOnlyList<ProposalManpowerPositionInput> Manpower = null!,
    IReadOnlyList<ProposalCoPiInput> CoPis = null!)
{
    public IReadOnlyList<ProposalEquipmentInput> Equipment { get; init; } = Equipment ?? [];
    public IReadOnlyList<ProposalManpowerPositionInput> Manpower { get; init; } = Manpower ?? [];
    public IReadOnlyList<ProposalCoPiInput> CoPis { get; init; } = CoPis ?? [];
}

/// <summary>
/// <paramref name="YearAmounts"/> must have exactly ceil(DurationMonths / 12)
/// entries, 1-indexed by position (index 0 is Year 1) -- checked by
/// CreateDraftAsync/UpdateAsync, not by this record itself.
/// </summary>
public record ProposalBudgetLineInput(
    BudgetHeadName HeadName, IReadOnlyList<decimal> YearAmounts, bool IncludeInOverhead = true, string? CustomLabel = null);

/// <summary>
/// Same shape as <see cref="CreateProposalDraftInput"/> -- editing a proposal
/// replaces its title/agency/advertisement reference/duration/budget lines
/// wholesale, matching the create form's own fields.
/// </summary>
public record UpdateProposalInput(
    string Title,
    ProposalType ProposalType,
    string Agency,
    string? AdvertisementReference,
    int DurationMonths,
    decimal OverheadPercent,
    IReadOnlyList<ProposalBudgetLineInput> BudgetLines,
    IReadOnlyList<ProposalEquipmentInput> Equipment = null!,
    IReadOnlyList<ProposalManpowerPositionInput> Manpower = null!,
    IReadOnlyList<ProposalCoPiInput> CoPis = null!)
{
    public IReadOnlyList<ProposalEquipmentInput> Equipment { get; init; } = Equipment ?? [];
    public IReadOnlyList<ProposalManpowerPositionInput> Manpower { get; init; } = Manpower ?? [];
    public IReadOnlyList<ProposalCoPiInput> CoPis { get; init; } = CoPis ?? [];
}

/// <summary>
/// What the funding agency's sanction letter carries -- mirrors the fields
/// <c>ProjectService.CreateAsync</c> requires, since this is what feeds it.
/// </summary>
public record RecordSanctionInput(
    string SanctionNo,
    DateOnly SanctionDate,
    DateOnly? ProjectStartDate,
    decimal TotalSanctioned);

public record ProposalBudgetLineSummary(
    BudgetHeadName HeadName, IReadOnlyList<decimal> YearAmounts, bool IncludeInOverhead, string? CustomLabel);

public record ProposalEquipmentSummary(string Name, string Unit, decimal Amount);
public record ProposalManpowerPositionSummary(
    string Designation, int Positions, decimal HraPercent,
    IReadOnlyList<decimal> StipendByYear, IReadOnlyList<decimal> HraByYear);
public record ProposalCoPiSummary(string Name, string Department, string Designation, bool IsInsideInstitute, string? InstituteName);

public record ResearchProposalSummary(
    Guid Id,
    Guid OwnerUserId,
    Guid DepartmentId,
    string Title,
    ProposalType ProposalType,
    string Agency,
    decimal ProposedAmount,
    decimal OverheadAmount,
    decimal OverheadPercent,
    int DurationMonths,
    ProposalStatus Status,
    Guid? WorkflowInstanceId,
    WorkflowStage? CurrentStage,
    DateTimeOffset? ExpiresAt,
    DateOnly? SubmittedToAgencyOn,
    DateOnly? AgencyDecisionOn,
    Guid? ProjectId,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ProposalBudgetLineSummary> BudgetLines,
    IReadOnlyList<ProposalEquipmentSummary> Equipment,
    IReadOnlyList<ProposalManpowerPositionSummary> Manpower,
    decimal TotalAmount,
    IReadOnlyList<ProposalCoPiSummary> CoPis);

