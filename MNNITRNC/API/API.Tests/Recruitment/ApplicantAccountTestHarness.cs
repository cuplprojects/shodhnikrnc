using API.Application.Notifications;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace API.Tests.Recruitment;

public class RecordingEmailSender : IEmailSender
{
    public List<RecordedEmail> Sent { get; } = [];

    public Task SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        string? ccAddress = null,
        CancellationToken ct = default)
    {
        Sent.Add(new RecordedEmail(toAddress, subject, htmlBody, ccAddress));
        return Task.CompletedTask;
    }
}

public record RecordedEmail(string To, string Subject, string Body, string? Cc);

/// <summary>Simulates an unconfigured/unreachable SMTP server -- the real
/// SmtpEmailSender throws EmailNotConfiguredException in exactly this
/// situation, deliberately ("fail loudly rather than silently dropping the
/// message"). A caller that lets this exception escape a save that already
/// succeeded turns a completed operation into an apparent failure.</summary>
public class ThrowingEmailSender : IEmailSender
{
    public Task SendAsync(
        string toAddress, string subject, string htmlBody,
        string? ccAddress = null, CancellationToken ct = default) =>
        throw new InvalidOperationException("Email is not configured.");
}

/// <summary>Minimal Identity context: these tests exercise users and roles only.</summary>
public class TestIdentityDbContext(DbContextOptions<TestIdentityDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options);

/// <summary>
/// Builds a real <see cref="UserManager{TUser}"/> over an in-memory store rather
/// than mocking it, so token generation and confirmation run the same code the
/// application does.
/// </summary>
/// <summary>
/// Deterministic stand-in for the data-protector token provider. Produces a
/// token bound to the user and purpose, so a wrong token or a wrong user still
/// fails validation -- which is what the tests assert on.
/// </summary>
public class TestEmailTokenProvider : IUserTwoFactorTokenProvider<ApplicationUser>
{
    public Task<string> GenerateAsync(string purpose, UserManager<ApplicationUser> manager, ApplicationUser user)
        => Task.FromResult($"{purpose}:{user.Id}");

    public Task<bool> ValidateAsync(string purpose, string token, UserManager<ApplicationUser> manager, ApplicationUser user)
        => Task.FromResult(token == $"{purpose}:{user.Id}");

    public Task<bool> CanGenerateTwoFactorTokenAsync(UserManager<ApplicationUser> manager, ApplicationUser user)
        => Task.FromResult(false);
}

public static class ApplicantAccountTestHarness
{
    public const string TestTokenProviderName = "TestEmailTokens";

    public static (UserManager<ApplicationUser> Users, RecordingEmailSender Mail, IOptions<EmailOptions> Options) Create()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddDbContext<TestIdentityDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString()));

        var identity = services
            .AddIdentityCore<ApplicationUser>(o =>
            {
                o.Password.RequiredLength = 8;
                o.Password.RequireNonAlphanumeric = false;
                o.User.RequireUniqueEmail = true;
                o.SignIn.RequireConfirmedEmail = true;

                // The real app uses the data-protector provider via
                // AddDefaultTokenProviders. That needs DataProtection, which a
                // plain test library does not reference, so these tests use
                // Identity's built-in test provider instead. It exercises the
                // same generate/validate contract UserManager calls.
                o.Tokens.EmailConfirmationTokenProvider = TestTokenProviderName;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<TestIdentityDbContext>()
            // Only email confirmation is overridden to the deterministic test
            // provider above; password reset keeps the real Data Protector
            // provider (registered by AddDefaultTokenProviders) since a plain
            // test library CAN reference Microsoft.AspNetCore.DataProtection --
            // it just isn't pulled in automatically the way ASP.NET Core apps do.
            .AddDefaultTokenProviders();

        identity.AddTokenProvider<TestEmailTokenProvider>(TestTokenProviderName);

        var provider = services.BuildServiceProvider();

        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in new[] { "Applicant", "Fellow", "Faculty" })
        {
            roleManager.CreateAsync(new IdentityRole<Guid>(role)).GetAwaiter().GetResult();
        }

        var options = Options.Create(new EmailOptions
        {
            Host = "smtp.test.local",
            FromAddress = "noreply@test.local",
            PortalBaseUrl = "http://localhost:5173",
        });

        return (provider.GetRequiredService<UserManager<ApplicationUser>>(),
                new RecordingEmailSender(),
                options);
    }
}
