namespace API.Application.Dashboard;

/// <summary>
/// One row in the dashboard's cross-request-type "pending my action" panel.
/// </summary>
/// <param name="CurrentStage">
/// The workflow stage's <c>.ToString()</c>, not the <c>WorkflowStage</c> enum
/// itself -- the frontend has no need to know the enum type and a string is
/// simpler to serialize/display directly.
/// </param>
public record PendingActionItem(
    string RequestType,
    Guid Id,
    string Title,
    string CurrentStage,
    DateTimeOffset CreatedAt,
    string Route);

public interface IDashboardService
{
    /// <summary>
    /// Merges every request type's own "pending my action" query
    /// (ResearchProposal, Indent, Travel, FellowshipClaim, LeaveRequest,
    /// Advertisement/Recruitment, GrantReceipt) into one list, sorted by
    /// CreatedAt ascending (oldest first). A single request type's query
    /// failing does not blank the whole panel -- that type's rows are simply
    /// omitted from the result.
    /// </summary>
    Task<IReadOnlyList<PendingActionItem>> ListPendingActionsAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
}
