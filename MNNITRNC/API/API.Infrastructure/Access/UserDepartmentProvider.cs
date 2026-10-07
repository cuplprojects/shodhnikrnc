using API.Application.Access;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace API.Infrastructure.Access;

/// <inheritdoc cref="IUserDepartmentProvider"/>
public class UserDepartmentProvider(UserManager<ApplicationUser> userManager) : IUserDepartmentProvider
{
    public async Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        return user?.DepartmentId;
    }
}
