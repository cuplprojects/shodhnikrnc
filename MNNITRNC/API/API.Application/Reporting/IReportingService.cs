namespace API.Application.Reporting;

/// <summary>
/// Seven reports (BRD Prompt 6 / A10). Scope is resolved from
/// <paramref name="requestingUserRoles"/> exactly as
/// <see cref="API.Application.Projects.IProjectService.GetAsync"/> already
/// resolves office-role widening -- roles passed in from the controller
/// (<c>User.GetRoles()</c>), not re-derived here: Faculty/Fellow -> Own
/// (their own projects only, per the BRD's "one PI cannot view another PI's
/// data"); HOD -> Department (their own department's); Dean/DeputyRegistrar/
/// Superintendent/RegularStaff -> Institute if their department is R&amp;C
/// (via <see cref="API.Application.Access.IInstituteWideScopeResolver"/>),
/// Department otherwise -- the same rule that already widens page access and
/// the proposal/indent queues, not a new one invented for reporting.
///
/// <paramref name="from"/>/<paramref name="to"/> filter on the report's own
/// natural date -- a project's <c>CreatedAt</c> for the project-count
/// report, but the underlying transaction/receipt/refund date for the ones
/// reporting on activity across a project's lifetime, not the project's own
/// creation.
/// </summary>
public interface IReportingService
{
    Task<IReadOnlyList<NumberOfProjectsRow>> GetNumberOfProjectsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    Task<IReadOnlyList<GrantSanctionedRow>> GetGrantSanctionedAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    Task<IReadOnlyList<ProjectExpenditureRow>> GetProjectExpenditureAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    Task<IReadOnlyList<ProjectOverheadRow>> GetProjectOverheadAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    Task<IReadOnlyList<RefundRow>> GetRefundsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    /// <summary>Not date-filtered -- a staff headcount is a snapshot of who
    /// holds what role today, not an activity log with a natural date.
    /// Faculty/Fellow (Own scope) get an empty list rather than an error --
    /// the BRD gives a PI no institute-wide view of anything, and this report
    /// has no "my own staff count" to fall back to.</summary>
    Task<IReadOnlyList<StaffCountRow>> GetStaffCountAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles, CancellationToken ct = default);

    Task<IReadOnlyList<ProjectEquipmentRow>> GetProjectEquipmentAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    Task<IReadOnlyList<TransactionDetailRow>> GetTransactionDetailsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        Guid? projectId = null, DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

    /// <summary>Date-filtered on the recruitment drive's own
    /// <c>CreatedAt</c>, same convention as the project-count report.</summary>
    Task<IReadOnlyList<RecruitmentFunnelRow>> GetRecruitmentFunnelAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default);

}
