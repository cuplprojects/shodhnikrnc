namespace API.Application.Travel;

public interface ITravelRequestService
{
    Task<Guid> RaiseAsync(RaiseTravelInput input, Guid requestingUserId, CancellationToken ct = default);

    Task<IReadOnlyList<TravelSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    Task<TravelDetail> GetAsync(Guid travelRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    Task ProcessBillAsync(
        Guid travelRequestId, ProcessTravelBillInput input, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    /// <summary>
    /// Every travel request currently at a stage the caller's own roles may
    /// act on (the generic ShippedRoute's approval chain, WorkflowPhase.Indent),
    /// scoped to the projects <see cref="Projects.IProjectService.ListVisibleToAsync"/>
    /// says the caller may see -- for the dashboard's "pending my action" panel.
    /// The separate Bill-phase instance raised by ProcessBillAsync is out of
    /// scope here: bill processing is an office action reachable via its own
    /// queue, not a per-role approval-chain stage.
    /// </summary>
    Task<IReadOnlyList<TravelSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
}
