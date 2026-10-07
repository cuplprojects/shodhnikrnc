using API.Application.Common;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Application.FacultyUsers;

public class MyProfileService(IApplicationDbContext db, UserManager<ApplicationUser> userManager) : IMyProfileService
{
    public async Task<MyProfileResponse> GetAsync(Guid applicationUserId, CancellationToken ct = default)
    {
        var profile = await db.FacultyProfiles
            .FirstOrDefaultAsync(p => p.ApplicationUserId == applicationUserId, ct);

        var user = await userManager.FindByIdAsync(applicationUserId.ToString());
        var email = user?.Email ?? string.Empty;

        var isComplete = !string.IsNullOrWhiteSpace(profile?.Designation)
            && !string.IsNullOrWhiteSpace(profile?.Department);

        return new MyProfileResponse(
            isComplete,
            profile?.Designation,
            profile?.Department,
            profile?.Gender,
            profile?.Qualification,
            profile?.JoiningDate,
            profile?.ResearchArea,
            profile?.Photo,
            email,
            user?.EmployeeId,
            profile?.PrimaryBankName,
            profile?.PrimaryBankAccountNo,
            profile?.PrimaryBankIfsc,
            profile?.SecondaryBankName,
            profile?.SecondaryBankAccountNo,
            profile?.SecondaryBankIfsc);
    }

    public async Task SaveAsync(Guid applicationUserId, SaveMyProfileRequest request, CancellationToken ct = default)
    {
        var profile = await db.FacultyProfiles
            .FirstOrDefaultAsync(p => p.ApplicationUserId == applicationUserId, ct);

        var user = await userManager.FindByIdAsync(applicationUserId.ToString())
            ?? throw new ArgumentException($"No account found for '{applicationUserId}'.", nameof(applicationUserId));

        if (profile is null)
        {
            // A legacy, admin-created row might already exist under this exact
            // UserId (the primary key) with no ApplicationUserId link yet --
            // adopting it here avoids a primary-key collision on Add below.
            // This can happen if the one-time backfill skipped linking it due
            // to an in-run collision, or if an admin created it after the
            // backfill already ran.
            profile = await db.FacultyProfiles
                .FirstOrDefaultAsync(
                    p => p.UserId == applicationUserId.ToString() && p.ApplicationUserId == null, ct);
        }

        if (profile is null)
        {
            profile = new FacultyProfile
            {
                // The primary key can't be null; a self-completed profile was
                // never admin-provisioned with a real Employee ID, so its own
                // account id is the only identifier available to seed it with.
                UserId = applicationUserId.ToString(),
                ApplicationUserId = applicationUserId,
            };
            db.FacultyProfiles.Add(profile);
        }
        else
        {
            profile.ApplicationUserId = applicationUserId;
        }

        profile.Name = user.FullName;
        profile.Designation = request.Designation;
        profile.Department = request.Department;
        profile.Gender = request.Gender;
        profile.Qualification = request.Qualification;
        profile.JoiningDate = request.JoiningDate;
        profile.ResearchArea = request.ResearchArea;
        
        // Map Bank Details
        profile.PrimaryBankName = request.PrimaryBankName;
        profile.PrimaryBankAccountNo = request.PrimaryBankAccountNo;
        profile.PrimaryBankIfsc = request.PrimaryBankIfsc;
        profile.SecondaryBankName = request.SecondaryBankName;
        profile.SecondaryBankAccountNo = request.SecondaryBankAccountNo;
        profile.SecondaryBankIfsc = request.SecondaryBankIfsc;

        if (request.Photo is not null)
        {
            profile.Photo = request.Photo;
        }
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var trimmedEmail = request.Email.Trim();
            user.Email = trimmedEmail;
            user.NormalizedEmail = trimmedEmail.ToUpperInvariant();
            profile.Email = trimmedEmail;
        }
        else
        {
            profile.Email = user.Email;
        }

        if (request.EmployeeId is not null)
        {
            user.EmployeeId = request.EmployeeId;
        }

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to update user '{user.Id}': {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }

        await db.SaveChangesAsync(ct);
    }
}
