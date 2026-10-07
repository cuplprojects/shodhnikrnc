using API.Application.Notifications;
using API.Application.Recruitment;
using API.Authorization;
using API.Contracts.Auth;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace API.Controllers;

[ApiController]
[Route("api/faculty-registrations")]
[PageAccess("faculty-registrations.review")]
public class FacultyRegistrationsController(
    IFacultyRegistrationService facultyRegistrations,
    UserManager<ApplicationUser> userManager,
    IApprovalNotificationService notifications,
    IOptions<EmailOptions> emailOptions) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<PendingFacultyRegistrationResponse>>> ListPending(CancellationToken ct)
    {
        var (callerId, callerRoles) = await ResolveCallerAsync();
        if (callerId is null) return Unauthorized();

        var result = await facultyRegistrations.ListPendingFacultyRegistrationsAsync(callerId.Value, callerRoles, ct);

        return Ok(result.Select(r => new PendingFacultyRegistrationResponse(
            r.UserId, r.FullName, r.Email, r.Department, r.CreatedAt)).ToList());
    }

    [HttpPost("{userId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid userId, CancellationToken ct)
    {
        var (callerId, callerRoles) = await ResolveCallerAsync();
        if (callerId is null) return Unauthorized();

        try
        {
            await facultyRegistrations.ApproveAsync(userId, callerId.Value, callerRoles, ct);
        }
        catch (ReviewerCannotActOutsideOwnDepartmentException)
        {
            return Forbid();
        }

        var registrant = await userManager.FindByIdAsync(userId.ToString());
        if (registrant is not null)
        {
            await notifications.NotifyAsync(
                "faculty-registration.approved", registrant,
                new Dictionary<string, string> { ["RegistrantName"] = registrant.FullName, ["PortalLink"] = emailOptions.Value.PortalBaseUrl },
                "ApplicationUser", userId, ct);
        }

        return NoContent();
    }

    [HttpPost("{userId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid userId, CancellationToken ct)
    {
        var (callerId, callerRoles) = await ResolveCallerAsync();
        if (callerId is null) return Unauthorized();

        try
        {
            await facultyRegistrations.RejectAsync(userId, callerId.Value, callerRoles, ct);
        }
        catch (ReviewerCannotActOutsideOwnDepartmentException)
        {
            return Forbid();
        }

        var registrant = await userManager.FindByIdAsync(userId.ToString());
        if (registrant is not null)
        {
            await notifications.NotifyAsync(
                "faculty-registration.rejected", registrant,
                new Dictionary<string, string> { ["RegistrantName"] = registrant.FullName, ["PortalLink"] = emailOptions.Value.PortalBaseUrl },
                "ApplicationUser", userId, ct);
        }

        return NoContent();
    }

    private async Task<(Guid? CallerId, IReadOnlyCollection<string> Roles)> ResolveCallerAsync()
    {
        var callerId = User.GetUserId();
        if (callerId is null) return (null, []);

        var callerUser = await userManager.FindByIdAsync(callerId.Value.ToString());
        if (callerUser is null) return (null, []);

        var roles = await userManager.GetRolesAsync(callerUser);
        return (callerId, roles.ToList());
    }
}
