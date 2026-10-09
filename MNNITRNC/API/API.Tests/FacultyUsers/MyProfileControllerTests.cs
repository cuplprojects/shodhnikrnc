using System.Security.Claims;
using API.Application.FacultyUsers;
using API.Controllers;
using API.Domain.Entities;
using API.Tests.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.FacultyUsers;

public class MyProfileControllerTests
{
    private sealed record Fixture(TestProcurementDbContext Db, MyProfileController Controller, Guid UserId);

    private static async Task<Fixture> CreateAsync()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "prof1", Email = "prof1@test.local", FullName = "Prof One" };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();

        var service = new MyProfileService(db, userManager);
        var controller = new MyProfileController(service, new StubWebHostEnvironment());

        var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, user.Id.ToString()) };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role)),
            },
        };

        return new Fixture(db, controller, user.Id);
    }

    [Fact]
    public async Task Get_WithNoProfile_ReturnsIncomplete()
    {
        var f = await CreateAsync();

        var result = await f.Controller.Get(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<MyProfileResponse>().Subject;
        response.IsComplete.Should().BeFalse();
    }

    [Fact]
    public async Task Save_ThenGet_ReturnsTheSavedProfile()
    {
        var f = await CreateAsync();

        var saveResult = await f.Controller.Save(
            new SaveMyProfileRequest("Professor", "Physics", "Male", "Ph.D.", null, null, null, null, "Test Bank", "0000000000", "TEST0000001", null, null, null),
            CancellationToken.None);
        saveResult.Should().BeOfType<NoContentResult>();

        var getResult = await f.Controller.Get(CancellationToken.None);
        var ok = getResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<MyProfileResponse>().Subject;
        response.IsComplete.Should().BeTrue();
        response.Designation.Should().Be("Professor");
    }

    [Fact]
    public async Task UploadPhoto_WithValidPngBytes_ReturnsUrlUnderUploadsPath()
    {
        var f = await CreateAsync();

        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 };
        var stream = new MemoryStream(pngBytes);
        var formFile = new FormFile(stream, 0, pngBytes.Length, "file", "photo.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png",
        };

        var result = await f.Controller.UploadPhoto(formFile, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<MyProfilePhotoUploadResponse>().Subject;
        response.Url.Should().StartWith("/uploads/profile-photos/");
        response.Url.Should().EndWith(".png");
    }

    [Fact]
    public async Task UploadPhoto_WithNonImageMagicBytes_ReturnsBadRequest()
    {
        var f = await CreateAsync();

        var notAnImage = System.Text.Encoding.UTF8.GetBytes("this is not an image");
        var stream = new MemoryStream(notAnImage);
        var formFile = new FormFile(stream, 0, notAnImage.Length, "file", "fake.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png",
        };

        var result = await f.Controller.UploadPhoto(formFile, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }
}
