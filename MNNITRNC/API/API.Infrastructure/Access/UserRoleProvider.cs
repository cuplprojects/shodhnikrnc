using API.Application.Access;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Access;

/// <inheritdoc cref="IUserRoleProvider"/>
/// <remarks>
/// Reads through Identity's own tables rather than the JWT's role claims. The
/// token reflects the roles held when it was issued, so a permission change
/// would not take effect until the user signed in again -- which would make the
/// admin UI look broken.
/// </remarks>
public class UserRoleProvider(
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager) : IUserRoleProvider
{
    public async Task<IReadOnlyCollection<Guid>> GetRoleIdsAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return [];
        }

        var names = await userManager.GetRolesAsync(user);
        if (names.Count == 0)
        {
            return [];
        }

        return await roleManager.Roles
            .Where(r => r.Name != null && names.Contains(r.Name))
            .Select(r => r.Id)
            .ToListAsync(ct);
    }
}
