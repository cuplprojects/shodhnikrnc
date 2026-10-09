using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Contracts.Access;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

/// <summary>
/// The SuperAdmin surface for roles and page access.
/// </summary>
/// <remarks>
/// SuperAdmin only. This decides who may open what, so it is deliberately not
/// available to Dean or Director: those roles decide individual requests, and
/// someone who may approve a claim should not thereby be able to grant
/// themselves the pages that approve claims.
/// </remarks>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "SuperAdmin")]
public class AdminAccessController(
    IApplicationDbContext db,
    RoleManager<IdentityRole<Guid>> roleManager,
    UserManager<ApplicationUser> userManager,
    RoleDeletionGuard deletionGuard,
    IAuditService audit) : ControllerBase
{
    private Guid? ActorId => User.GetUserId();

    // ---- roles --------------------------------------------------------------

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleResponse>>> GetRoles(CancellationToken ct)
    {
        var roles = await roleManager.Roles
            .Where(r => r.Name != null)
            .OrderBy(r => r.Name)
            .Select(r => new { r.Id, r.Name })
            .ToListAsync(ct);

        var result = new List<RoleResponse>(roles.Count);
        foreach (var role in roles)
        {
            var users = await userManager.GetUsersInRoleAsync(role.Name!);
            result.Add(new RoleResponse(
                role.Id, role.Name!, RoleProtection.IsProtected(role.Name!), users.Count));
        }

        return Ok(result);
    }

    [HttpPost("roles")]
    public async Task<ActionResult<RoleResponse>> CreateRole(CreateRoleRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();

        if (await roleManager.RoleExistsAsync(name))
        {
            return Conflict(new { detail = $"A role named '{name}' already exists." });
        }

        var result = await roleManager.CreateAsync(new IdentityRole<Guid>(name));
        if (!result.Succeeded)
        {
            return BadRequest(new { detail = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        var created = await roleManager.FindByNameAsync(name);
        if (ActorId is { } actorId)
        {
            await audit.LogAsync(nameof(IdentityRole<Guid>), created!.Id, "RoleCreated", actorId, name, ct);
        }

        return Ok(new RoleResponse(created!.Id, name, RoleProtection.IsProtected(name), 0));
    }

    [HttpPut("roles/{id:guid}")]
    public async Task<IActionResult> RenameRole(Guid id, RenameRoleRequest request, CancellationToken ct)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role?.Name is null)
        {
            return NotFound();
        }

        // Workflow stages store role names, so a rename would orphan every stage
        // granting this one -- silently, since the engine would simply refuse
        // them with no pointer back at the cause.
        if (RoleProtection.IsProtected(role.Name))
        {
            return BadRequest(new
            {
                detail = $"'{role.Name}' is a built-in role and cannot be renamed. "
                       + "Workflow stages reference roles by name, so renaming it would "
                       + "silently break every stage that grants it.",
            });
        }

        var name = request.Name.Trim();
        var stages = await deletionGuard.StagesGrantingAsync(role.Name, ct);
        if (stages > 0)
        {
            return BadRequest(new
            {
                detail = $"'{role.Name}' is granted by {stages} workflow stage(s). "
                       + "Renaming it would leave those stages granting a role that no longer exists.",
            });
        }

        var oldName = role.Name;
        role.Name = name;
        var result = await roleManager.UpdateAsync(role);
        if (!result.Succeeded)
        {
            return BadRequest(new { detail = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        if (ActorId is { } actorId)
        {
            await audit.LogAsync(nameof(IdentityRole<Guid>), id, "RoleRenamed", actorId, $"{oldName} -> {name}", ct);
        }

        return NoContent();
    }

    [HttpDelete("roles/{id:guid}")]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken ct)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role?.Name is null)
        {
            return NotFound();
        }

        if (RoleProtection.IsProtected(role.Name))
        {
            return BadRequest(new
            {
                detail = $"'{role.Name}' is a built-in role and cannot be deleted.",
            });
        }

        var stages = await deletionGuard.StagesGrantingAsync(role.Name, ct);
        if (stages > 0)
        {
            return BadRequest(new
            {
                detail = $"Cannot delete '{role.Name}': {stages} workflow stage(s) grant it, "
                       + "and would be left granting a role that no longer exists.",
            });
        }

        var users = await userManager.GetUsersInRoleAsync(role.Name);
        if (users.Count > 0)
        {
            return BadRequest(new
            {
                detail = $"Cannot delete '{role.Name}': {users.Count} user(s) hold it.",
            });
        }

        // The role's page access goes with it; leaving orphaned rows would let a
        // recreated role of the same name silently inherit the old permissions.
        var access = await db.RolePageAccess.Where(a => a.RoleId == id).ToListAsync(ct);
        db.RolePageAccess.RemoveRange(access);
        await db.SaveChangesAsync(ct);

        var deletedName = role.Name;
        var result = await roleManager.DeleteAsync(role);
        if (!result.Succeeded)
        {
            return BadRequest(new { detail = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        if (ActorId is { } actorId)
        {
            await audit.LogAsync(nameof(IdentityRole<Guid>), id, "RoleDeleted", actorId, deletedName, ct);
        }

        return NoContent();
    }

    // ---- role page access ---------------------------------------------------

    [HttpGet("roles/{id:guid}/access")]
    public async Task<ActionResult<RoleAccessResponse>> GetRoleAccess(Guid id, CancellationToken ct)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role?.Name is null)
        {
            return NotFound();
        }

        var granted = await db.RolePageAccess
            .Where(a => a.RoleId == id)
            .ToDictionaryAsync(a => a.PageId, a => a.Scope, ct);

        var modules = await db.Modules
            .Include(m => m.Pages)
            .OrderBy(m => m.DisplayOrder)
            .ToListAsync(ct);

        // The whole tree is returned, not just what is granted: the editor shows
        // every page with a checkbox, and needs the ungranted ones to draw them.
        var response = modules.Select(m => new AccessModuleResponse(
            m.Key, m.Name, m.Group,
            m.Pages.OrderBy(p => p.DisplayOrder)
                .Select(p => new AccessPageResponse(
                    p.Key, p.Name, p.Route, p.IsNavigable,
                    granted.ContainsKey(p.Id),
                    granted.TryGetValue(p.Id, out var scope) ? scope : AccessScope.Own))
                .ToList()))
            .ToList();

        return Ok(new RoleAccessResponse(
            role.Id, role.Name, RoleProtection.IsProtected(role.Name), response));
    }

    [HttpPut("roles/{id:guid}/access")]
    public async Task<IActionResult> UpdateRoleAccess(
        Guid id, UpdateRoleAccessRequest request, CancellationToken ct)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null)
        {
            return NotFound();
        }

        var pageIdsByKey = await db.Pages.ToDictionaryAsync(p => p.Key, p => p.Id, ct);

        var unknown = request.Pages
            .Where(p => !pageIdsByKey.ContainsKey(p.PageKey))
            .Select(p => p.PageKey)
            .ToList();

        if (unknown.Count > 0)
        {
            return BadRequest(new { detail = $"Unknown page(s): {string.Join(", ", unknown)}." });
        }

        // Replaced wholesale in one SaveChanges, which EF sends as a single
        // transaction -- so a failed update cannot leave a role with its old
        // access deleted and no new access in place.
        var existing = await db.RolePageAccess.Where(a => a.RoleId == id).ToListAsync(ct);
        db.RolePageAccess.RemoveRange(existing);

        foreach (var page in request.Pages)
        {
            db.RolePageAccess.Add(new RolePageAccess
            {
                RoleId = id,
                PageId = pageIdsByKey[page.PageKey],
                Scope = page.Scope,
            });
        }

        await db.SaveChangesAsync(ct);
        if (ActorId is { } actorId)
        {
            await audit.LogAsync(
                "RolePageAccess", id, "RoleAccessUpdated", actorId,
                $"{request.Pages.Count} page grant(s) set", ct);
        }

        return NoContent();
    }

    // ---- per-user grants ----------------------------------------------------

    [HttpGet("users/{userId:guid}/grants")]
    public async Task<ActionResult<IReadOnlyList<UserGrantResponse>>> GetUserGrants(
        Guid userId, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return NotFound();
        }

        var grants = await db.UserPageGrants
            .Where(g => g.UserId == userId)
            .Include(g => g.Page)
            .OrderByDescending(g => g.GrantedAt)
            .ToListAsync(ct);

        return Ok(grants.Select(g => new UserGrantResponse(
            g.UserId, user.UserName ?? string.Empty,
            g.Page!.Key, g.Page.Name,
            g.Effect, g.Scope, g.Reason, g.GrantedAt)).ToList());
    }

    [HttpPost("users/{userId:guid}/grants")]
    public async Task<IActionResult> CreateUserGrant(
        Guid userId, CreateUserGrantRequest request, CancellationToken ct)
    {
        var actorId = User.GetUserId();
        if (actorId is null)
        {
            return Unauthorized();
        }

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return NotFound();
        }

        var page = await db.Pages.FirstOrDefaultAsync(p => p.Key == request.PageKey, ct);
        if (page is null)
        {
            return BadRequest(new { detail = $"Unknown page '{request.PageKey}'." });
        }

        var existing = await db.UserPageGrants
            .FirstOrDefaultAsync(g => g.UserId == userId && g.PageId == page.Id, ct);

        if (existing is not null)
        {
            db.UserPageGrants.Remove(existing);
        }

        db.UserPageGrants.Add(new UserPageGrant
        {
            UserId = userId,
            PageId = page.Id,
            Effect = request.Effect,
            Scope = request.Scope,
            Reason = request.Reason.Trim(),
            GrantedByUserId = actorId.Value,
            GrantedAt = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            "UserPageGrant", userId, "UserGrantCreated", actorId.Value,
            $"Page={request.PageKey};Effect={request.Effect}", ct);
        return NoContent();
    }

    [HttpDelete("users/{userId:guid}/grants/{pageKey}")]
    public async Task<IActionResult> DeleteUserGrant(Guid userId, string pageKey, CancellationToken ct)
    {
        var actorId = User.GetUserId();
        if (actorId is null)
        {
            return Unauthorized();
        }

        var page = await db.Pages.FirstOrDefaultAsync(p => p.Key == pageKey, ct);
        if (page is null)
        {
            return NotFound();
        }

        var grant = await db.UserPageGrants
            .FirstOrDefaultAsync(g => g.UserId == userId && g.PageId == page.Id, ct);

        if (grant is null)
        {
            return NotFound();
        }

        db.UserPageGrants.Remove(grant);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync("UserPageGrant", userId, "UserGrantDeleted", actorId.Value, $"Page={pageKey}", ct);
        return NoContent();
    }

    // ---- users, for the grant panel ----------------------------------------

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetUsers(CancellationToken ct)
    {
        var users = await userManager.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.UserName)
            .Select(u => new { u.Id, u.UserName, u.FullName })
            .ToListAsync(ct);

        return Ok(users);
    }
}
