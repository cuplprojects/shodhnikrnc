using API.Application.Recruitment;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace API.Infrastructure.Recruitment;

public class ApplicantRoleService(UserManager<ApplicationUser> userManager) : IApplicantRoleService
{
    private const string ApplicantRole = "Applicant";
    private const string FellowRole = "Fellow";

    public async Task<bool> IsEmailConfirmedAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        return user?.EmailConfirmed ?? false;
    }

    public async Task DeactivateAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || !user.IsActive)
        {
            return;
        }

        user.IsActive = false;
        await userManager.UpdateAsync(user);
    }

    public async Task ReactivateAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || user.IsActive)
        {
            return;
        }

        user.IsActive = true;
        await userManager.UpdateAsync(user);
    }

    public async Task PromoteToFellowAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return;
        }

        // Remove Applicant as well as adding Fellow: leaving both would let a
        // fellow keep applicant-only access.
        if (await userManager.IsInRoleAsync(user, ApplicantRole))
        {
            await userManager.RemoveFromRoleAsync(user, ApplicantRole);
        }

        if (!await userManager.IsInRoleAsync(user, FellowRole))
        {
            await userManager.AddToRoleAsync(user, FellowRole);
        }

        // A fellow who was soft-deleted as an applicant must be able to sign in.
        if (!user.IsActive)
        {
            user.IsActive = true;
            await userManager.UpdateAsync(user);
        }
    }
}
