using API.Domain.Entities;
using API.Infrastructure.Recruitment;
using FluentAssertions;
using Xunit;

namespace API.Tests.Recruitment;

public class ApplicantRoleServiceTests
{
    [Fact]
    public async Task IsEmailConfirmedAsync_UnconfirmedUser_ReturnsFalseAndDoesNotConfirmIt()
    {
        // RecruitmentService.ApplyAsync relies on this to reject an applicant
        // who never verified their email (see IApplicantRoleService's own doc
        // comment: "Verification gates applying, so the service checks it
        // before accepting one"). A version that force-confirms on read would
        // let every application through regardless of verification status --
        // exactly the live bug this pins.
        var (users, _, _) = ApplicantAccountTestHarness.Create();
        var service = new ApplicantRoleService(users);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "unverified@example.com",
            Email = "unverified@example.com",
            FullName = "Unverified Applicant",
            EmailConfirmed = false,
            IsActive = true,
        };
        await users.CreateAsync(user, "Passw0rd!");

        var result = await service.IsEmailConfirmedAsync(user.Id);

        result.Should().BeFalse();

        var reloaded = await users.FindByIdAsync(user.Id.ToString());
        reloaded!.EmailConfirmed.Should().BeFalse();
    }

    [Fact]
    public async Task IsEmailConfirmedAsync_ConfirmedUser_ReturnsTrue()
    {
        var (users, _, _) = ApplicantAccountTestHarness.Create();
        var service = new ApplicantRoleService(users);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "verified@example.com",
            Email = "verified@example.com",
            FullName = "Verified Applicant",
            EmailConfirmed = true,
            IsActive = true,
        };
        await users.CreateAsync(user, "Passw0rd!");

        var result = await service.IsEmailConfirmedAsync(user.Id);

        result.Should().BeTrue();
    }
}
