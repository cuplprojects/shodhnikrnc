using API.Application.Recruitment;
using API.Infrastructure.Recruitment;
using FluentAssertions;
using Xunit;

namespace API.Tests.Recruitment;

public class ApplicantAccountServiceTests
{
    private static (ApplicantAccountService Service, RecordingEmailSender Mail,
                    Microsoft.AspNetCore.Identity.UserManager<API.Domain.Entities.ApplicationUser> Users) Create()
    {
        var (users, mail, options) = ApplicantAccountTestHarness.Create();
        return (new ApplicantAccountService(users, mail, options), mail, users);
    }

    [Fact]
    public async Task RegisterAsync_CreatesUnconfirmedApplicantAndSendsMail()
    {
        var (service, mail, users) = Create();

        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");

        result.Outcome.Should().Be(RegistrationOutcome.Created);
        result.UserId.Should().NotBeNull();

        var user = await users.FindByEmailAsync("ana@example.com");
        user.Should().NotBeNull();
        user!.EmailConfirmed.Should().BeFalse();
        user.IsActive.Should().BeTrue();
        (await users.IsInRoleAsync(user, "Applicant")).Should().BeTrue();

        mail.Sent.Should().ContainSingle();
        mail.Sent[0].To.Should().Be("ana@example.com");
    }

    /// <summary>
    /// The reapplication path: a known address must not error and must not create
    /// a second account.
    /// </summary>
    [Fact]
    public async Task RegisterAsync_ExistingAddress_CreatesNoSecondAccount()
    {
        var (service, mail, users) = Create();
        await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");

        var second = await service.RegisterAsync("ana@example.com", "Ana Rao", "Different1!");

        second.Outcome.Should().Be(RegistrationOutcome.AlreadyRegistered);
        second.UserId.Should().BeNull();
        users.Users.Count(u => u.Email == "ana@example.com").Should().Be(1);

        // No second verification mail either -- that would be a way to spam a
        // known address by repeatedly "registering" it.
        mail.Sent.Should().ContainSingle();
    }

    [Fact]
    public async Task ConfirmEmailAsync_WithValidToken_Confirms()
    {
        var (service, _, users) = Create();
        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");
        var user = await users.FindByIdAsync(result.UserId!.Value.ToString());
        var token = await users.GenerateEmailConfirmationTokenAsync(user!);

        var confirmed = await service.ConfirmEmailAsync(result.UserId!.Value, token);

        confirmed.Should().BeTrue();
        (await users.FindByEmailAsync("ana@example.com"))!.EmailConfirmed.Should().BeTrue();
    }

    [Fact]
    public async Task ConfirmEmailAsync_IsIdempotent()
    {
        var (service, _, users) = Create();
        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");
        var user = await users.FindByIdAsync(result.UserId!.Value.ToString());
        var token = await users.GenerateEmailConfirmationTokenAsync(user!);
        await service.ConfirmEmailAsync(result.UserId!.Value, token);

        // A second click on the same link should not read as a failure.
        var again = await service.ConfirmEmailAsync(result.UserId!.Value, token);

        again.Should().BeTrue();
    }

    [Fact]
    public async Task ConfirmEmailAsync_WithBadToken_Fails()
    {
        var (service, _, _) = Create();
        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");

        var confirmed = await service.ConfirmEmailAsync(result.UserId!.Value, "not-a-real-token");

        confirmed.Should().BeFalse();
    }

    [Fact]
    public async Task ConfirmEmailAsync_UnknownUser_Fails()
    {
        var (service, _, _) = Create();

        var confirmed = await service.ConfirmEmailAsync(Guid.NewGuid(), "token");

        confirmed.Should().BeFalse();
    }

    [Fact]
    public async Task ResendVerificationAsync_ResendsForUnconfirmedAddress()
    {
        var (service, mail, _) = Create();
        await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");
        mail.Sent.Clear();

        await service.ResendVerificationAsync("ana@example.com");

        mail.Sent.Should().ContainSingle();
    }

    /// <summary>
    /// Silence is the point: a response that differed for unknown addresses would
    /// let anyone test which addresses are registered.
    /// </summary>
    [Fact]
    public async Task ResendVerificationAsync_UnknownAddress_IsSilent()
    {
        var (service, mail, _) = Create();

        var act = () => service.ResendVerificationAsync("nobody@example.com");

        await act.Should().NotThrowAsync();
        mail.Sent.Should().BeEmpty();
    }

    [Fact]
    public async Task ResendVerificationAsync_AlreadyConfirmed_SendsNothing()
    {
        var (service, mail, users) = Create();
        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");
        var user = await users.FindByIdAsync(result.UserId!.Value.ToString());
        var token = await users.GenerateEmailConfirmationTokenAsync(user!);
        await service.ConfirmEmailAsync(result.UserId!.Value, token);
        mail.Sent.Clear();

        await service.ResendVerificationAsync("ana@example.com");

        mail.Sent.Should().BeEmpty();
    }

    [Fact]
    public async Task RegisterAsync_VerificationLinkCarriesUserIdAndToken()
    {
        var (service, mail, _) = Create();

        var result = await service.RegisterAsync("ana@example.com", "Ana Rao", "Passw0rd!");

        var body = mail.Sent.Single().Body;
        body.Should().Contain($"userId={result.UserId}");
        body.Should().Contain("token=");
        body.Should().Contain("/verify-email");
    }
}
