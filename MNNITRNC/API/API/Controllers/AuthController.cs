using System.Net;
using API.Application.Auth;
using API.Application.Common;
using API.Application.Notifications;
using API.Application.Recruitment;
using API.Contracts.Auth;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    IJwtTokenService jwtTokenService,
    IApplicantAccountService applicantAccounts,
    IFacultyRegistrationService facultyRegistrations,
    IApplicationDbContext db,
    IEmailSender emailSender,
    IOptions<EmailOptions> emailOptions) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var input = request.UserName.Trim();
        var user = await userManager.FindByNameAsync(input)
                   ?? await userManager.FindByEmailAsync(input);

        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized();
        }

        // A soft-deleted applicant cannot sign in until they reapply, which
        // reactivates the account. Same 401 as bad credentials -- distinguishing
        // them would disclose that the address is registered.
        if (!user.IsActive)
        {
            return Unauthorized();
        }

        var roles = await userManager.GetRolesAsync(user);
        var token = jwtTokenService.GenerateToken(user, roles);

        // The profile-completion gate exists for genuinely internal roles
        // (Faculty, Dean, HOD, Office staff, etc.) whose recruitment documents
        // need a real Designation/Department. Applicant and Fellow accounts
        // never have (and never should have) a FacultyProfile row, so the gate
        // must never apply to an account that holds only those external roles.
        var profileComplete = !IsGatedRole(roles)
            || await db.FacultyProfiles.AnyAsync(
                p => p.ApplicationUserId == user.Id
                    && p.Designation != null && p.Designation != ""
                    && p.Department != null && p.Department != "");

        return Ok(new LoginResponse(token, user.FullName, roles.ToList(), profileComplete));
    }

    // True when the account holds at least one role the profile-completion
    // gate is meant for -- i.e. any role other than the external/candidate-
    // facing Applicant and Fellow roles. An account whose roles are entirely
    // (or exclusively) Applicant/Fellow -- or that holds no roles at all --
    // is never gated.
    private static bool IsGatedRole(IList<string> roles) =>
        roles.Any(r => r != "Applicant" && r != "Fellow");

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<RegisterResponse>> Register(
        RegisterRequest request, CancellationToken ct)
    {
        var result = await applicantAccounts.RegisterAsync(
            request.Email, request.FullName, request.Password, ct);

        return result.Outcome == RegistrationOutcome.AlreadyRegistered
            ? Ok(new RegisterResponse(
                true,
                "An account already exists for this address. Sign in to apply — " +
                "you can reuse details from a previous application."))
            : Ok(new RegisterResponse(
                false,
                "Registration received. Check your email for a confirmation link; " +
                "you must confirm the address before you can apply."));
    }

    [HttpPost("register-faculty")]
    [AllowAnonymous]
    public async Task<ActionResult<RegisterResponse>> RegisterFaculty(
        RegisterFacultyRequest request, CancellationToken ct)
    {
        var result = await facultyRegistrations.RegisterAsync(
            new FacultyRegistrationInput(request.FullName, request.Email, request.Password, request.DepartmentId), ct);

        return result.Outcome == RegistrationOutcome.AlreadyRegistered
            ? Ok(new RegisterResponse(
                true,
                "An account already exists for this address. Sign in instead."))
            : Ok(new RegisterResponse(
                false,
                "Registration received. You can sign in now; your account will be reviewed " +
                "by your HOD or the R&C office before you get full access."));
    }

    [HttpPost("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailRequest request, CancellationToken ct)
    {
        var confirmed = await applicantAccounts.ConfirmEmailAsync(
            request.UserId, request.Token, ct);

        return confirmed
            ? NoContent()
            : BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Confirmation failed",
                Detail = "The confirmation link is invalid or has expired. " +
                         "Request a new one from the sign-in page.",
            });
    }

    [HttpPost("resend-verification")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendVerification(
        ResendVerificationRequest request, CancellationToken ct)
    {
        await applicantAccounts.ResendVerificationAsync(request.Email, ct);

        // Always the same response: revealing whether the address existed would
        // make this endpoint an enumeration oracle.
        return Accepted();
    }

    /// <summary>
    /// Self-service password change for a signed-in user who knows their
    /// current password. Every internal and external role uses this same
    /// endpoint -- there is nothing role-specific about changing your own
    /// password.
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        if (user is null) return Unauthorized();

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Password change failed",
                Detail = string.Join(" ", result.Errors.Select(e => e.Description)),
            });
        }

        return NoContent();
    }

    /// <summary>
    /// Always returns 202 whether or not the address is registered --
    /// otherwise this endpoint would let a caller enumerate real accounts,
    /// the same reasoning as <see cref="ResendVerification"/>.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is not null && user.IsActive)
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);

            var link =
                $"{emailOptions.Value.PortalBaseUrl.TrimEnd('/')}/reset-password" +
                $"?userId={user.Id}&token={WebUtility.UrlEncode(token)}";

            var body = $"""
                <p>Dear {WebUtility.HtmlEncode(user.FullName)},</p>
                <p>We received a request to reset your MNNIT Research &amp; Consultancy
                portal password. Click the link below to choose a new one.</p>
                <p><a href="{link}">Reset my password</a></p>
                <p>If you did not request this, no action is needed -- your password
                will not change.</p>
                """;

            await emailSender.SendAsync(user.Email!, "Reset your MNNIT R&C portal password", body, null, ct);
        }

        return Accepted();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Reset failed",
                Detail = "This reset link is invalid or has expired. Request a new one from the sign-in page.",
            });
        }

        var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Reset failed",
                Detail = "This reset link is invalid or has expired. Request a new one from the sign-in page.",
            });
        }

        return NoContent();
    }
}
