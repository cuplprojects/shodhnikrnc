using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using API.Application.Notifications;
using API.Application.Recruitment;
using API.Controllers;
using API.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace API.Tests.Controllers;

public class FacultyRegistrationsControllerTests
{
    private static Mock<UserManager<ApplicationUser>> CreateMockUserManager(ApplicationUser callerUser, IList<string> callerRoles)
    {
        var store = new Mock<IUserStore<ApplicationUser>>();
        var mgr = new Mock<UserManager<ApplicationUser>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        mgr.Setup(m => m.FindByIdAsync(callerUser.Id.ToString())).ReturnsAsync(callerUser);
        mgr.Setup(m => m.GetRolesAsync(callerUser)).ReturnsAsync(callerRoles);
        return mgr;
    }

    private static FacultyRegistrationsController CreateController(
        IFacultyRegistrationService service, Guid callerId, IList<string> callerRoles,
        IApprovalNotificationService? notifications = null)
    {
        var callerUser = new ApplicationUser { Id = callerId, FullName = "Caller", UserName = "caller@test.edu" };
        var userManager = CreateMockUserManager(callerUser, callerRoles).Object;
        var emailOptions = Options.Create(new EmailOptions { PortalBaseUrl = "https://portal.test" });
        var controller = new FacultyRegistrationsController(
            service, userManager, notifications ?? new Mock<IApprovalNotificationService>().Object, emailOptions);

        var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, callerId.ToString()) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal },
        };

        return controller;
    }

    [Fact]
    public async Task Approve_CallsServiceWithCallerContextAndReturnsNoContent()
    {
        var svc = new Mock<IFacultyRegistrationService>();
        var userId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var controller = CreateController(svc.Object, callerId, ["HOD"]);

        var result = await controller.Approve(userId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        svc.Verify(s => s.ApproveAsync(
            userId, callerId, It.Is<IReadOnlyCollection<string>>(r => r.Contains("HOD")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reject_CallsServiceWithCallerContextAndReturnsNoContent()
    {
        var svc = new Mock<IFacultyRegistrationService>();
        var userId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var controller = CreateController(svc.Object, callerId, ["RegularStaff"]);

        var result = await controller.Reject(userId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        svc.Verify(s => s.RejectAsync(
            userId, callerId, It.Is<IReadOnlyCollection<string>>(r => r.Contains("RegularStaff")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Approve_WhenServiceRefusesCrossDepartmentAction_ReturnsForbidden()
    {
        var svc = new Mock<IFacultyRegistrationService>();
        var userId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        svc.Setup(s => s.ApproveAsync(userId, callerId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ReviewerCannotActOutsideOwnDepartmentException(callerId, userId));
        var controller = CreateController(svc.Object, callerId, ["HOD"]);

        var result = await controller.Approve(userId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task Reject_WhenServiceRefusesCrossDepartmentAction_ReturnsForbidden()
    {
        var svc = new Mock<IFacultyRegistrationService>();
        var userId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        svc.Setup(s => s.RejectAsync(userId, callerId, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ReviewerCannotActOutsideOwnDepartmentException(callerId, userId));
        var controller = CreateController(svc.Object, callerId, ["HOD"]);

        var result = await controller.Reject(userId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }
}
