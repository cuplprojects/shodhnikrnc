using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

/// <summary>
/// Seeds <see cref="PageCatalogue"/> into modules, pages and role access.
/// </summary>
/// <remarks>
/// Idempotent on each key, so an operator who has since edited a role's access
/// does not have it reset on the next start -- the same rule the workflow
/// definition seeder follows.
///
/// Role access is seeded only for roles that exist. A catalogue entry naming a
/// role the deployment does not have is skipped rather than failing: the
/// alternative would make the whole seed depend on every role being present,
/// and HOD in particular is created without page access on purpose.
/// </remarks>
public static class PageAccessSeeder
{
    public static async Task SeedAsync(
        IApplicationDbContext db,
        IReadOnlyDictionary<string, Guid> roleIdsByName,
        CancellationToken ct = default)
    {
        var existingModulesByKey = await db.Modules
            .Select(m => new { m.Id, m.Key })
            .ToDictionaryAsync(m => m.Key, m => m.Id, StringComparer.OrdinalIgnoreCase, ct);

        // Pages already seeded, keyed by their own Key -- checked regardless
        // of which module they live under, since a page's Key is the seed's
        // real identity (PageKeysAndRoutesAreUnique already requires it be
        // globally unique).
        var existingPageKeys = (await db.Pages.Select(p => p.Key).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var existingPageKeysAtStart = existingPageKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var order = 0;
        foreach (var moduleSeed in PageCatalogue.Modules)
        {
            order++;

            if (existingModulesByKey.TryGetValue(moduleSeed.Key, out var existingModuleId))
            {
                // The module itself already exists -- but the catalogue may
                // have grown a page since (e.g. an 8th report added to the
                // already-live "reports" module). Reconcile just the missing
                // pages rather than skipping the module outright, or a page
                // added after go-live would never appear on a reused database.
                var pageOrder = await db.Pages.CountAsync(p => p.ModuleId == existingModuleId, ct);

                // Also load existing pages so we can patch IsNavigable/Route when
                // the catalogue entry changes (e.g. a page that was non-navigable
                // is later promoted to appear in the sidebar).
                var existingPages = await db.Pages
                    .Where(p => p.ModuleId == existingModuleId)
                    .ToListAsync(ct);
                var existingPageByKey = existingPages.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);

                foreach (var pageSeed in moduleSeed.Pages)
                {
                    if (!existingPageKeys.Add(pageSeed.Key))
                    {
                        // Page exists — patch navigability and route if catalogue changed.
                        if (existingPageByKey.TryGetValue(pageSeed.Key, out var existing) &&
                            (existing.IsNavigable != pageSeed.IsNavigable || existing.Route != pageSeed.Route || existing.Name != pageSeed.Name))
                        {
                            existing.IsNavigable = pageSeed.IsNavigable;
                            existing.Route = pageSeed.Route;
                            existing.Name = pageSeed.Name;
                        }
                        continue;
                    }

                    pageOrder++;
                    db.Pages.Add(new Page
                    {
                        Id = Guid.NewGuid(),
                        ModuleId = existingModuleId,
                        Key = pageSeed.Key,
                        Name = pageSeed.Name,
                        Route = pageSeed.Route,
                        IsNavigable = pageSeed.IsNavigable,
                        DisplayOrder = pageOrder,
                    });
                }

                continue;
            }

            var module = new Module
            {
                Id = Guid.NewGuid(),
                Key = moduleSeed.Key,
                Name = moduleSeed.Name,
                Group = moduleSeed.Group,
                DisplayOrder = order,
            };

            var newPageOrder = 0;
            foreach (var pageSeed in moduleSeed.Pages)
            {
                newPageOrder++;
                module.Pages.Add(new Page
                {
                    Id = Guid.NewGuid(),
                    ModuleId = module.Id,
                    Key = pageSeed.Key,
                    Name = pageSeed.Name,
                    Route = pageSeed.Route,
                    IsNavigable = pageSeed.IsNavigable,
                    DisplayOrder = newPageOrder,
                });
                existingPageKeys.Add(pageSeed.Key);
            }

            db.Modules.Add(module);
        }

        await db.SaveChangesAsync(ct);

        // Role access is applied after the pages exist, so the page ids are real.
        var pageIdsByKey = await db.Pages
            .Select(p => new { p.Key, p.Id })
            .ToDictionaryAsync(p => p.Key, p => p.Id, ct);

        var existingAccess = await db.RolePageAccess
            .Select(a => new { a.RoleId, a.PageId })
            .ToListAsync(ct);

        var seen = existingAccess.Select(a => (a.RoleId, a.PageId)).ToHashSet();

        var added = false;
        foreach (var moduleSeed in PageCatalogue.Modules)
        {
            foreach (var pageSeed in moduleSeed.Pages)
            {
                if (!pageIdsByKey.TryGetValue(pageSeed.Key, out var pageId))
                {
                    continue;
                }

                if (existingPageKeysAtStart.Contains(pageSeed.Key))
                {
                    // The page already existed before this seeder run. We assume its access
                    // is fully managed in the database now, so we skip seeding roles here.
                    // This prevents the seeder from overwriting manual admin UI revocations.
                    continue;
                }

                // An empty role list means "everyone signed in". Rather than
                // inventing a pseudo-role, every real role is granted it, so the
                // admin UI shows the truth and a SuperAdmin can narrow it later.
                var roles = pageSeed.Roles.Length == 0
                    ? roleIdsByName.Keys.ToArray()
                    : pageSeed.Roles;

                foreach (var roleName in roles)
                {
                    if (!roleIdsByName.TryGetValue(roleName, out var roleId) ||
                        !seen.Add((roleId, pageId)))
                    {
                        continue;
                    }

                    db.RolePageAccess.Add(new RolePageAccess
                    {
                        RoleId = roleId,
                        PageId = pageId,
                        Scope = pageSeed.Scope,
                    });
                    added = true;
                }
            }
        }

        if (added)
        {
            await db.SaveChangesAsync(ct);
        }

        // Commented out to prevent the seeder from forcefully granting all pages to SuperAdmin,
        // which was overwriting manual permission revocations made via the admin UI.
        // await GrantSuperAdminEveryPageAsync(db, roleIdsByName, pageIdsByKey, ct);
    }

    /// <summary>
    /// SuperAdmin reaches every page, at Institute scope, regardless of what
    /// each PageSeed.Roles lists -- deliberately separate from the per-page
    /// grants above so the documented, page-specific reasoning already on
    /// each PageCatalogue entry (e.g. why SuperAdmin is or isn't listed
    /// alongside a given page) is not disturbed by this blanket rule.
    /// Additive and idempotent like the rest of this seeder: narrows nothing,
    /// and a database already holding every grant finds nothing new to add.
    /// </summary>
    private static async Task GrantSuperAdminEveryPageAsync(
        IApplicationDbContext db,
        IReadOnlyDictionary<string, Guid> roleIdsByName,
        IReadOnlyDictionary<string, Guid> pageIdsByKey,
        CancellationToken ct)
    {
        if (!roleIdsByName.TryGetValue("SuperAdmin", out var superAdminRoleId))
        {
            return;
        }

        var existingSuperAdminPageIds = await db.RolePageAccess
            .Where(a => a.RoleId == superAdminRoleId)
            .Select(a => a.PageId)
            .ToListAsync(ct);
        var covered = existingSuperAdminPageIds.ToHashSet();

        var added = false;
        foreach (var pageId in pageIdsByKey.Values)
        {
            if (!covered.Add(pageId))
            {
                continue;
            }

            db.RolePageAccess.Add(new RolePageAccess
            {
                RoleId = superAdminRoleId,
                PageId = pageId,
                Scope = AccessScope.Institute,
            });
            added = true;
        }

        if (added)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
