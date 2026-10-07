using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

public class AdminUsersService(UserManager<ApplicationUser> userManager) : IAdminUsersService
{
    public async Task<IReadOnlyList<AdminUserListItemResponse>> GetAllAsync(CancellationToken ct = default)
    {
        return await userManager.Users
            .Select(u => new AdminUserListItemResponse(u.Id, u.FullName, u.Email, u.EmployeeId, u.IsActive))
            .ToListAsync(ct);
    }

    public async Task SetEmployeeIdAsync(Guid userId, string? employeeId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString())
            ?? throw new ArgumentException($"No account found for '{userId}'.", nameof(userId));

        user.EmployeeId = employeeId;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to update user '{user.Id}': {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }
    }
}
