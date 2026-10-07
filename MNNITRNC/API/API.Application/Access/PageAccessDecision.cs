namespace API.Application.Access;

/// <summary>
/// Decides whether a caller may open a page, independent of ASP.NET.
/// </summary>
/// <remarks>
/// The authorization handler in the web project is a thin adapter over this.
/// The split is deliberate: <c>API.Application</c> carries no ASP.NET
/// reference, and adding one for an authorization type would erode the layer
/// boundary the project maintains everywhere else. Keeping the decision here
/// means it is unit-testable without a web host.
/// </remarks>
public class PageAccessDecision(IPageAccessService pageAccess)
{
    /// <summary>
    /// True when the subject may open the page.
    /// </summary>
    /// <param name="subjectClaim">
    /// The raw JWT subject. Null, empty or unparseable fails closed -- succeeding
    /// on a missing identity would make the check bypassable by presenting none.
    /// </param>
    public async Task<bool> IsAllowedAsync(
        string? subjectClaim, string pageKey, CancellationToken ct = default)
    {
        if (!Guid.TryParse(subjectClaim, out var userId))
        {
            return false;
        }

        return await pageAccess.CanAccessAsync(userId, pageKey, ct);
    }
}
