using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

/// <inheritdoc cref="IPageAccessService"/>
/// <remarks>
/// Registered scoped, and the cache is per instance -- so it spans one request.
/// A single request checks access several times (the sidebar, the route guard,
/// the API policy) and re-querying for each would be wasteful; caching longer
/// would mean a permission change did not take effect until the process
/// recycled, which would defeat the point of making access editable.
/// </remarks>
public class PageAccessService(
    IApplicationDbContext db,
    IUserRoleProvider userRoles,
    IInstituteWideScopeResolver instituteWideScope) : IPageAccessService
{
    private readonly Dictionary<Guid, IReadOnlyList<AccessiblePage>> _cache = [];

    public async Task<IReadOnlyList<AccessiblePage>> GetPagesForUserAsync(
        Guid userId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(userId, out var cached))
        {
            return cached;
        }

        var roleIds = await userRoles.GetRoleIdsAsync(userId, ct);

        // Role access first, widest scope per page. A user holding two roles
        // that both reach a page gets the wider of the two -- taking the
        // narrower would mean gaining a role lost them access.
        var fromRoles = await db.RolePageAccess
            .Where(a => roleIds.Contains(a.RoleId))
            .Select(a => new { a.PageId, a.Scope })
            .ToListAsync(ct);

        var scopeByPage = fromRoles
            .GroupBy(a => a.PageId)
            .ToDictionary(g => g.Key, g => g.Max(a => a.Scope));

        var grants = await db.UserPageGrants
            .Where(g => g.UserId == userId)
            .Select(g => new { g.PageId, g.Effect, g.Scope })
            .ToListAsync(ct);

        // Grants widen or add; a deny removes outright. Deny is applied last so
        // it wins regardless of what a role or another grant gave.
        foreach (var grant in grants.Where(g => g.Effect == GrantEffect.Grant))
        {
            scopeByPage[grant.PageId] = scopeByPage.TryGetValue(grant.PageId, out var existing)
                ? (AccessScope)Math.Max((int)existing, (int)grant.Scope)
                : grant.Scope;
        }

        foreach (var deny in grants.Where(g => g.Effect == GrantEffect.Deny))
        {
            scopeByPage.Remove(deny.PageId);
        }

        if (scopeByPage.Count == 0)
        {
            return _cache[userId] = [];
        }

        // Institute-wide sight comes from belonging to R&C, not from role rank.
        // A Dean of Civil Engineering sees Civil Engineering; the same role held
        // in R&C sees every department.
        //
        // Only Department widens. Own means "rows this user owns", and widening
        // that would hand an R&C clerk everyone's personal claims -- which is
        // not what a department-wide view means. An explicit Institute grant is
        // already at the top and unaffected.
        if (await instituteWideScope.IsInstituteWideAsync(userId, ct))
        {
            foreach (var pageId in scopeByPage.Keys.ToList())
            {
                if (scopeByPage[pageId] == AccessScope.Department)
                {
                    scopeByPage[pageId] = AccessScope.Institute;
                }
            }
        }

        var pageIds = scopeByPage.Keys.ToList();
        var pages = await db.Pages
            .Where(p => pageIds.Contains(p.Id))
            .Include(p => p.Module)
            .ToListAsync(ct);

        var result = pages
            .Select(p => new AccessiblePage(
                p.Key, p.Name, p.Route,
                p.Module!.Key, p.Module.Name, p.Module.Group,
                p.IsNavigable, scopeByPage[p.Id],
                p.Module.DisplayOrder, p.DisplayOrder))
            .OrderBy(p => p.ModuleOrder).ThenBy(p => p.PageOrder)
            .ToList();

        return _cache[userId] = result;
    }

    public async Task<bool> CanAccessAsync(Guid userId, string pageKey, CancellationToken ct = default)
    {
        var pages = await GetPagesForUserAsync(userId, ct);
        return pages.Any(p => p.PageKey == pageKey);
    }

    public async Task<AccessScope?> GetScopeAsync(Guid userId, string pageKey, CancellationToken ct = default)
    {
        var pages = await GetPagesForUserAsync(userId, ct);
        return pages.FirstOrDefault(p => p.PageKey == pageKey)?.Scope;
    }
}
