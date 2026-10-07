namespace API.Application.Common;

/// <summary>
/// Generic paged result wrapper used by list endpoints that support
/// server-side pagination.
/// </summary>
/// <typeparam name="T">The item type of the page.</typeparam>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}
