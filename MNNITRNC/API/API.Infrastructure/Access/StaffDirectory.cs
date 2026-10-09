using API.Application.Access;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Access;

/// <inheritdoc cref="IStaffDirectory"/>
public class StaffDirectory(
    UserManager<ApplicationUser> userManager, RoleManager<IdentityRole<Guid>> roleManager) : IStaffDirectory
{
    public async Task<IReadOnlyList<StaffMember>> GetAllAsync(CancellationToken ct = default)
    {
        var users = await userManager.Users
            .Where(u => u.IsActive)
            .Select(u => new { u.Id, u.DepartmentId })
            .ToListAsync(ct);

        var roles = await roleManager.Roles
            .Where(r => r.Name != null)
            .ToListAsync(ct);

        var result = new List<StaffMember>();
        foreach (var role in roles)
        {
            var usersInRole = await userManager.GetUsersInRoleAsync(role.Name!);
            var idsInRole = usersInRole.Select(u => u.Id).ToHashSet();

            result.AddRange(users
                .Where(u => idsInRole.Contains(u.Id))
                .Select(u => new StaffMember(u.Id, role.Name!, u.DepartmentId)));
        }

        return result;
    }
}
