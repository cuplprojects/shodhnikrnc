namespace API.Application.Fellowship;

public interface IFellowshipService
{
    /// <summary>Raised by the fellow. Blocked until their ID card is issued.</summary>
    Task<Guid> RaiseClaimAsync(
        RaiseClaimInput input, Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// Edit a rejected fellowship claim to resubmit it.
    /// </summary>
    Task EditRejectedClaimAsync(
        EditRejectedClaimInput input, Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// Dean or Director only, with a reason, and refused once the claim is
    /// approved (spec D1).
    /// </summary>
    Task OverrideHraAsync(
        OverrideHraInput input, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        CancellationToken ct = default);

    /// <summary>
    /// The PI's recommended amount. Entered, never computed from leave -- the
    /// portal reports absence and a human decides what to pay (spec D2).
    /// </summary>
    Task RecommendAmountAsync(
        RecommendAmountInput input, Guid piUserId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    Task ApproveAsync(
        Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    Task RejectAsync(
        Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string remarks, CancellationToken ct = default);

    Task CancelAsync(
        Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string remarks, CancellationToken ct = default);

    Task ReturnAsync(
        Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string remarks, CancellationToken ct = default);

    /// <summary>
    /// Applies the same action to every listed claim in one transaction.
    /// All-or-nothing: if any claim fails (wrong stage, caller not the
    /// claim's assigned DA, etc.), nothing is applied -- matching
    /// ProjectService.BulkActOnGrantReceiptsAsync's own guarantee.
    /// </summary>
    Task BulkActOnClaimsAsync(
        IReadOnlyCollection<Guid> claimIds, FellowshipClaimBulkAction action,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    Task<IReadOnlyList<FellowshipClaimSummary>> ListOwnClaimsAsync(
        Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// Readable by the fellow it belongs to, by the PI who owns the
    /// project, or -- so the DA's voucher/noting-selection pages can
    /// populate a claim's own display fields -- by a caller holding one of
    /// the four office roles (RegularStaff/Superintendent/DeputyRegistrar/
    /// Dean) that already have institute-wide access to Approved,
    /// unvouchered claims via ListReadyToVoucherClaimsAsync.
    /// </summary>
    Task<FellowshipClaimSummary> GetAsync(
        Guid claimId, Guid requestingUserId,
        IReadOnlyCollection<string>? actorRoles = null, CancellationToken ct = default);

    Task<IReadOnlyList<FellowshipClaimSummary>> ListForProjectAsync(
        Guid projectId, Guid piUserId, CancellationToken ct = default);

    Task<Guid> GetMyAppointmentIdAsync(Guid fellowUserId, CancellationToken ct = default);

    Task<IReadOnlyList<FellowshipClaimSummary>> ListAllClaimsAsync(
        CancellationToken ct = default);

    /// <summary>
    /// The claim form, rendered on demand rather than stored -- it reflects the
    /// live state of the claim, including any HRA override and the PI's
    /// recommended amount, so a copy saved at raise time would go stale.
    /// </summary>
    Task<GeneratedFellowshipDocument> GenerateStipendFormAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default);

    Task<StipendFormModel> GetStipendFormDataAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default);

    Task<StipendFormModel> GetMyStipendFormDraftAsync(
        Guid fellowUserId, int claimYear, int claimMonth, CancellationToken ct = default);

    /// <summary>
    /// Returns the ordered workflow history for a claim. Every step is stored
    /// by the engine; this projects them to a UI-friendly summary that includes
    /// the actor's display name.
    /// Return steps carry remarks that the PI must see before revising the claim.
    /// </summary>
    Task<IReadOnlyList<WorkflowStepSummary>> GetClaimStepsAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default);

    /// <summary>
    /// Aggregates fellowship claims across ALL projects owned by the given PI.
    /// Used by the Approval Page when the actor holds the Faculty role so they
    /// only see their own fellows' claims, not the entire institute's data.
    /// </summary>
    Task<IReadOnlyList<FellowshipClaimSummary>> ListPIClaimsAsync(
        Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// The dashboard's "pending my action" panel for fellowship claims. Built
    /// on <see cref="API.Application.Workflow.IWorkflowPendingQueryService"/>
    /// (Task 1's stage-matching primitive) plus this service's own
    /// department scoping, matching <see cref="ListPendingClaimsForCallerAsync"/>'s
    /// sibling implementations for other request types.
    /// </summary>
    Task<IReadOnlyList<FellowshipClaimSummary>> ListPendingClaimsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    /// <summary>
    /// Claims at WorkflowStage.Approved that have not yet been linked to a
    /// PaymentVoucherItem -- the DA's "ready to turn into payment" list.
    /// </summary>
    Task<IReadOnlyList<FellowshipClaimSummary>> ListReadyToVoucherClaimsAsync(
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default);

    /// <summary>
    /// Creates one PaymentVoucher covering every listed claim, each item
    /// linked back to its claim and charged against that claim's own
    /// project's RecurringManpower budget head -- a single voucher may span
    /// several different projects. Records one Expenditure row per claim at
    /// creation time, matching every other voucher type's existing
    /// create-time deduction (not approval-time). Every claim is validated
    /// (Approved, not already vouchered, enough manpower balance) before
    /// anything is staged, so a failure persists nothing.
    /// </summary>
    /// <returns>The new PaymentVoucher's id.</returns>
    Task<Guid> CreateVoucherFromClaimsAsync(
        IReadOnlyCollection<Guid> claimIds, CreateFellowshipVoucherInput input,
        Guid actorUserId, CancellationToken ct = default);
}

public record GeneratedFellowshipDocument(byte[] Content, string FileName);
