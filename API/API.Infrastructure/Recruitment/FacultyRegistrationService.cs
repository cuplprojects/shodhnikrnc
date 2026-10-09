using API.Application.Access;
using API.Application.Common;
using API.Application.Recruitment;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Recruitment;

public class FacultyRegistrationService(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    IUserDepartmentProvider userDepartment) : IFacultyRegistrationService
{
    private const string PendingRole = "Pending";
    private const string FacultyRole = "Faculty";

    private static readonly HashSet<string> ReviewerOfficeRoles =
        new(StringComparer.OrdinalIgnoreCase) { "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff", "SuperAdmin" };

    public async Task<RegistrationResult> RegisterAsync(
        FacultyRegistrationInput input, CancellationToken ct = default)
    {
        var existing = await userManager.FindByEmailAsync(input.Email);
        if (existing is not null)
        {
            return new RegistrationResult(RegistrationOutcome.AlreadyRegistered, null);
        }

        // Unvalidated, an anonymous caller could post any GUID: the account would still
        // be created and could still sign in, but would match no HOD's department and
        // would sit in the review queue showing no department at all, permanently
        // invisible to the reviewer it was supposed to route to.
        var departmentExists = await db.Departments
            .AnyAsync(d => d.Id == input.DepartmentId && d.IsActive, ct);
        if (!departmentExists)
        {
            throw new InvalidOperationException("Faculty registration failed: department not found.");
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = input.Email,
            Email = input.Email,
            FullName = input.FullName,
            EmailConfirmed = true,
            IsActive = true,
            DepartmentId = input.DepartmentId,
        };

        var created = await userManager.CreateAsync(user, input.Password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(
                "Faculty registration failed: " +
                string.Join("; ", created.Errors.Select(e => e.Description)));
        }

        await userManager.AddToRoleAsync(user, PendingRole);

        return new RegistrationResult(RegistrationOutcome.Created, user.Id);
    }

    public async Task ApproveAsync(
        Guid userId, Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return;

        await EnsureCallerMayActOnAsync(user, callerUserId, callerRoles, ct);

        if (await userManager.IsInRoleAsync(user, PendingRole))
        {
            await userManager.RemoveFromRoleAsync(user, PendingRole);
        }
        if (!await userManager.IsInRoleAsync(user, FacultyRole))
        {
            await userManager.AddToRoleAsync(user, FacultyRole);
        }
        if (!user.IsActive)
        {
            user.IsActive = true;
            await userManager.UpdateAsync(user);
        }
    }

    public async Task RejectAsync(
        Guid userId, Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || !user.IsActive) return;

        await EnsureCallerMayActOnAsync(user, callerUserId, callerRoles, ct);

        user.IsActive = false;
        await userManager.UpdateAsync(user);
    }

    /// <summary>
    /// An Office-tier reviewer may act on any department. An HOD may act only on their
    /// own department -- [PageAccess("faculty-registrations.review")] only checks that
    /// the caller holds a role allowed onto the page at all, it never compares
    /// departments, so that check has to happen here (mirrors
    /// ListPendingFacultyRegistrationsAsync's own department resolution below).
    /// </summary>
    private async Task EnsureCallerMayActOnAsync(
        ApplicationUser target, Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct)
    {
        if (callerRoles.Any(ReviewerOfficeRoles.Contains))
        {
            return;
        }

        var callerDepartmentId = await userDepartment.GetDepartmentIdAsync(callerUserId, ct)
            ?? throw new ReviewerHasNoDepartmentException(callerUserId);

        if (target.DepartmentId != callerDepartmentId)
        {
            throw new ReviewerCannotActOutsideOwnDepartmentException(callerUserId, target.Id);
        }
    }

    public async Task<IReadOnlyList<PendingFacultyRegistrationSummary>> ListPendingFacultyRegistrationsAsync(
        Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default)
    {
        // IsActive excludes rejected registrations: RejectAsync deliberately leaves the
        // Pending role in place (see its own remarks), so without this filter a rejected
        // row would never leave the queue and Approve could silently resurrect it.
        var pendingUsers = (await userManager.GetUsersInRoleAsync(PendingRole))
            .Where(u => u.IsActive)
            .ToList();

        var isOffice = callerRoles.Any(ReviewerOfficeRoles.Contains);
        if (!isOffice)
        {
            var isHod = callerRoles.Contains("HOD", StringComparer.OrdinalIgnoreCase);
            if (!isHod)
            {
                return [];
            }

            var hodDepartmentId = await userDepartment.GetDepartmentIdAsync(callerUserId, ct)
                ?? throw new ReviewerHasNoDepartmentException(callerUserId);

            pendingUsers = pendingUsers.Where(u => u.DepartmentId == hodDepartmentId).ToList();
        }

        var departmentIds = pendingUsers.Select(u => u.DepartmentId).Where(id => id.HasValue).Select(id => id!.Value).ToList();
        var departmentNamesById = await db.Departments
            .Where(d => departmentIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        return pendingUsers
            .OrderBy(u => u.CreatedAt)
            .Select(u => new PendingFacultyRegistrationSummary(
                u.Id, u.FullName, u.Email!,
                u.DepartmentId.HasValue && departmentNamesById.TryGetValue(u.DepartmentId.Value, out var name) ? name : null,
                u.CreatedAt))
            .ToList();
    }
}
