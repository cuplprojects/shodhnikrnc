using System.Net;
using API.Application.Notifications;
using API.Application.Recruitment;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace API.Infrastructure.Recruitment;

/// <summary>
/// Applicant self-registration and email verification.
/// </summary>
/// <remarks>
/// Lives in infrastructure rather than the application layer because it depends
/// on ASP.NET Identity's <see cref="UserManager{TUser}"/> directly, the same way
/// the JWT token service does.
/// </remarks>
public class ApplicantAccountService(
    UserManager<ApplicationUser> userManager,
    IEmailSender emailSender,
    IOptions<EmailOptions> emailOptions) : IApplicantAccountService
{
    private const string ApplicantRole = "Applicant";

    public async Task<RegistrationResult> RegisterAsync(
        string email, string fullName, string password, CancellationToken ct = default)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            // Not an error. Someone reapplying to a different project is expected
            // to hit this path; they log in and apply again rather than
            // registering twice.
            return new RegistrationResult(RegistrationOutcome.AlreadyRegistered, null);
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            FullName = fullName,
            EmailConfirmed = false,
            IsActive = true,
        };

        var created = await userManager.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(
                "Registration failed: " +
                string.Join("; ", created.Errors.Select(e => e.Description)));
        }

        await userManager.AddToRoleAsync(user, ApplicantRole);
        await SendVerificationAsync(user, ct);

        return new RegistrationResult(RegistrationOutcome.Created, user.Id);
    }

    public async Task<bool> ConfirmEmailAsync(
        Guid userId, string token, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return false;
        }

        // Idempotent: a second click on the same link is a success, not an error.
        if (user.EmailConfirmed)
        {
            return true;
        }

        var result = await userManager.ConfirmEmailAsync(user, token);
        return result.Succeeded;
    }

    public async Task ResendVerificationAsync(string email, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(email);

        // Silent for unknown and already-confirmed addresses. Reporting either
        // would turn this endpoint into an oracle for which addresses exist.
        if (user is null || user.EmailConfirmed)
        {
            return;
        }

        await SendVerificationAsync(user, ct);
    }

    private async Task SendVerificationAsync(ApplicationUser user, CancellationToken ct)
    {
        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);

        var link =
            $"{emailOptions.Value.PortalBaseUrl.TrimEnd('/')}/verify-email" +
            $"?userId={user.Id}&token={WebUtility.UrlEncode(token)}";

        var body = $"""
            <p>Dear {WebUtility.HtmlEncode(user.FullName)},</p>
            <p>Confirm your email address to complete registration with the
            MNNIT Research &amp; Consultancy portal. You will not be able to apply
            for a position until this address is confirmed.</p>
            <p><a href="{link}">Confirm my email address</a></p>
            <p>If you did not register on the portal, no action is needed.</p>
            """;

        await emailSender.SendAsync(
            user.Email!, "Confirm your MNNIT R&C portal registration", body, null, ct);
    }
}
