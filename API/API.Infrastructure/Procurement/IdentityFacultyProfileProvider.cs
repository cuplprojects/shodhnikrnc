using API.Application.Common;
using API.Application.Procurement;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Procurement;

/// <summary>
/// Resolves a PI's name, designation, and department from the linked
/// <see cref="FacultyProfile"/> for their <see cref="ApplicationUser"/>.
/// </summary>
public class IdentityFacultyProfileProvider(
    UserManager<ApplicationUser> userManager, IApplicationDbContext db) : IFacultyProfileProvider
{
    public async Task<FacultyProfileInfo> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());

        var profile = await db.FacultyProfiles
            .FirstOrDefaultAsync(p => p.ApplicationUserId == userId, ct);

        return new FacultyProfileInfo(
            user?.FullName ?? string.Empty,
            profile?.Designation ?? string.Empty,
            profile?.Department ?? string.Empty);
    }
}
