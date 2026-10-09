namespace API.Application.Procurement;

/// <summary>
/// Aggregates pending-for-caller indents across all four indent request
/// types (Consumable, Contingency, Equipment, DynamicIndent) into one call,
/// for the dashboard's pending-actions panel.
/// </summary>
public interface IIndentPendingQueryService
{
    Task<IReadOnlyList<IndentSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
}
