namespace API.Application.Fellowship;

public interface ILeaveService
{
    /// <summary>Raised by the fellow. Blocked until their ID card is issued.</summary>
    Task<Guid> RaiseLeaveAsync(
        RaiseLeaveInput input, Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// Advances <c>ConsumedDays</c>. Called when a leave request's workflow
    /// reaches Approved -- never at raise, or a rejected request would
    /// permanently reduce the balance.
    /// </summary>
    Task ConsumeOnApprovalAsync(Guid leaveRequestId, CancellationToken ct = default);
    
    Task<Guid> RaiseCancellationAsync(Guid leaveRequestId, List<DateOnly> datesToCancel, string reason, Guid fellowUserId, CancellationToken ct = default);
    Task RefundOnCancellationApprovalAsync(Guid cancellationRequestId, CancellationToken ct = default);

    Task CancelLeaveAsync(Guid leaveRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string remarks, CancellationToken ct = default);

    Task<IReadOnlyList<LeaveRequestSummary>> ListOwnRequestsAsync(
        Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// Entitled, consumed, pending and remaining per leave type for the fellow's
    /// current project year.
    /// </summary>
    Task<IReadOnlyList<LeaveBalance>> GetBalanceAsync(
        Guid fellowUserId, CancellationToken ct = default);

    /// <summary>
    /// All leave requests with scholar, project, and workflow details for HOD,
    /// Dean, and Office review -- scoped to the caller: Faculty/HOD see only
    /// their own department's requests, and the Office-group roles
    /// (RegularStaff, Superintendent, DeputyRegistrar, Dean, Director,
    /// SuperAdmin) see institute-wide when their own department is flagged
    /// institute-wide (<see cref="API.Application.Access.IInstituteWideScopeResolver"/>),
    /// matching every other office-facing queue in this codebase.
    /// </summary>
    Task<IReadOnlyList<LeaveRequestDetail>> ListRequestsAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    /// <summary>
    /// The dashboard's "pending my action" panel for leave requests. Built on
    /// <see cref="API.Application.Workflow.IWorkflowPendingQueryService"/>
    /// (Task 1's stage-matching primitive) plus this service's own department
    /// scoping, matching the fellowship claim's sibling implementation.
    /// </summary>
    Task<IReadOnlyList<LeaveRequestSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
}
