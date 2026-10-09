using System.Security.Claims;
using API.Application.Recruitment;
using API.Contracts.Auth;
using API.Controllers;
using API.Domain.Entities;
using API.Infrastructure.Auth;
using API.Tests.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Xunit;

namespace API.Tests.Auth;

public class AuthControllerTests
{
    private sealed record Fixture(
        TestProcurementDbContext Db, AuthController Controller, Guid UserId, RecordingEmailSender Mail);

    private static async Task<Fixture> CreateAsync(string role = "Faculty", string userName = "faculty1@test.local")
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, mail, emailOptions) = ApplicantAccountTestHarness.Create();

        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = userName, Email = userName, FullName = "Faculty Member One" };
        (await userManager.CreateAsync(user, "Password@12345")).Succeeded.Should().BeTrue();
        (await userManager.AddToRoleAsync(user, role)).Succeeded.Should().BeTrue();

        var jwtOptions = Options.Create(new JwtOptions
        {
            SigningKey = "this-is-a-test-signing-key-that-is-long-enough-256-bits",
            Issuer = "mnnitrnc-tests",
            Audience = "mnnitrnc-tests",
            ExpiryMinutes = 60,
        });
        var jwtTokenService = new JwtTokenService(jwtOptions);

        // Login never calls applicantAccounts or facultyRegistrations --
        // only Register/RegisterFaculty do -- so null service references
        // are safe here; real instances are unnecessary for these tests.
        var controller = new AuthController(userManager, jwtTokenService, applicantAccounts: null!, facultyRegistrations: null!, db, mail, emailOptions);

        return new Fixture(db, controller, user.Id, mail);
    }

    private static void SetUser(AuthController controller, Guid userId)
    {
        var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()) };
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) };
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    [Fact]
    public async Task Login_WithNoLinkedFacultyProfile_ReturnsProfileCompleteFalse()
    {
        var f = await CreateAsync();

        var result = await f.Controller.Login(new LoginRequest("faculty1@test.local", "Password@12345"));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<LoginResponse>().Subject;
        response.ProfileComplete.Should().BeFalse();
    }

    [Fact]
    public async Task Login_WithLinkedCompleteFacultyProfile_ReturnsProfileCompleteTrue()
    {
        var f = await CreateAsync();
        f.Db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = f.UserId.ToString(),
            ApplicationUserId = f.UserId,
            Designation = "Professor",
            Department = "Physics",
        });
        await f.Db.SaveChangesAsync();

        var result = await f.Controller.Login(new LoginRequest("faculty1@test.local", "Password@12345"));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<LoginResponse>().Subject;
        response.ProfileComplete.Should().BeTrue();
    }

    [Fact]
    public async Task Login_WithLinkedButIncompleteFacultyProfile_ReturnsProfileCompleteFalse()
    {
        var f = await CreateAsync();
        f.Db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = f.UserId.ToString(),
            ApplicationUserId = f.UserId,
            Designation = "Professor",
            Department = null, // Department never filled in
        });
        await f.Db.SaveChangesAsync();

        var result = await f.Controller.Login(new LoginRequest("faculty1@test.local", "Password@12345"));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<LoginResponse>().Subject;
        response.ProfileComplete.Should().BeFalse();
    }

    [Fact]
    public async Task Login_WithOnlyApplicantRole_ReturnsProfileCompleteTrueEvenWithNoFacultyProfile()
    {
        var f = await CreateAsync(role: "Applicant", userName: "applicant1@test.local");

        var result = await f.Controller.Login(new LoginRequest("applicant1@test.local", "Password@12345"));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<LoginResponse>().Subject;
        response.ProfileComplete.Should().BeTrue();
    }

    [Fact]
    public async Task Login_WithOnlyFellowRole_ReturnsProfileCompleteTrueEvenWithNoFacultyProfile()
    {
        var f = await CreateAsync(role: "Fellow", userName: "fellow1@test.local");

        var result = await f.Controller.Login(new LoginRequest("fellow1@test.local", "Password@12345"));

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<LoginResponse>().Subject;
        response.ProfileComplete.Should().BeTrue();
    }

    [Fact]
    public async Task ChangePassword_WithCorrectCurrentPassword_SucceedsAndAllowsLoginWithTheNewOne()
    {
        var f = await CreateAsync();
        SetUser(f.Controller, f.UserId);

        var result = await f.Controller.ChangePassword(
            new ChangePasswordRequest("Password@12345", "NewPassword@6789"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();

        var loginResult = await f.Controller.Login(new LoginRequest("faculty1@test.local", "NewPassword@6789"));
        loginResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_ReturnsBadRequestAndLeavesThePasswordUnchanged()
    {
        var f = await CreateAsync();
        SetUser(f.Controller, f.UserId);

        var result = await f.Controller.ChangePassword(
            new ChangePasswordRequest("WrongPassword@000", "NewPassword@6789"), CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();

        var loginResult = await f.Controller.Login(new LoginRequest("faculty1@test.local", "Password@12345"));
        loginResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ForgotPassword_ForARegisteredAddress_SendsAResetEmail()
    {
        var f = await CreateAsync();

        var result = await f.Controller.ForgotPassword(new ForgotPasswordRequest("faculty1@test.local"), CancellationToken.None);

        result.Should().BeOfType<AcceptedResult>();
        f.Mail.Sent.Should().ContainSingle();
        f.Mail.Sent[0].To.Should().Be("faculty1@test.local");
        f.Mail.Sent[0].Body.Should().Contain("/reset-password?userId=");
    }

    [Fact]
    public async Task ForgotPassword_ForAnUnknownAddress_StillReturnsAcceptedAndSendsNoEmail()
    {
        var f = await CreateAsync();

        var result = await f.Controller.ForgotPassword(new ForgotPasswordRequest("unknown@test.local"), CancellationToken.None);

        result.Should().BeOfType<AcceptedResult>();
        f.Mail.Sent.Should().BeEmpty();
    }

    [Fact]
    public async Task ResetPassword_WithAValidToken_ChangesThePassword()
    {
        var f = await CreateAsync();
        await f.Controller.ForgotPassword(new ForgotPasswordRequest("faculty1@test.local"), CancellationToken.None);
        var link = f.Mail.Sent[0].Body;
        var token = link.Split("token=")[1].Split('"')[0];

        var result = await f.Controller.ResetPassword(
            new ResetPasswordRequest(f.UserId, Uri.UnescapeDataString(token), "BrandNewPassword@999"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();

        var loginResult = await f.Controller.Login(new LoginRequest("faculty1@test.local", "BrandNewPassword@999"));
        loginResult.Result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ResetPassword_WithAnInvalidToken_ReturnsBadRequestAndLeavesThePasswordUnchanged()
    {
        var f = await CreateAsync();

        var result = await f.Controller.ResetPassword(
            new ResetPasswordRequest(f.UserId, "not-a-real-token", "BrandNewPassword@999"), CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();

        var loginResult = await f.Controller.Login(new LoginRequest("faculty1@test.local", "Password@12345"));
        loginResult.Result.Should().BeOfType<OkObjectResult>();
    }
}
