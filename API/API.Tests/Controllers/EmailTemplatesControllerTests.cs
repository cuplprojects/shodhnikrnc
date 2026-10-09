using System.Security.Claims;
using API.Contracts.Notifications;
using API.Controllers;
using API.Domain.Entities;
using API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Controllers;

public class EmailTemplatesControllerTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Gives the controller an empty (unauthenticated) ClaimsPrincipal so
    /// User.GetUserId() inside the action returns null instead of throwing --
    /// ControllerBase.User dereferences HttpContext.User directly and blows up
    /// with no ControllerContext at all, unlike GetUserId's own
    /// null-safe handling of a *missing claim* on a real principal.
    /// </summary>
    private static void AttachAnonymousUser(ControllerBase controller)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity()),
            },
        };
    }

    [Fact]
    public async Task Update_ValidPlaceholders_Saves()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var id = Guid.NewGuid();
        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = id, Key = "proposal.approved", Name = "Proposal Approved",
            Subject = "Old subject", HtmlBody = "<p>Old body</p>", IsSystemDefault = true, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        var controller = new EmailTemplatesController(db);
        AttachAnonymousUser(controller);

        var result = await controller.Update(id, new UpdateEmailTemplateRequest(
            "New: {{ProposalTitle}}", "<p>Dear {{RequesterName}}</p>"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<EmailTemplateResponse>(ok.Value);
        Assert.False(response.IsSystemDefault);
        Assert.Equal("New: {{ProposalTitle}}", response.Subject);
    }

    [Fact]
    public async Task Update_UnknownPlaceholder_ReturnsBadRequest()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var id = Guid.NewGuid();
        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = id, Key = "proposal.approved", Name = "Proposal Approved",
            Subject = "Old subject", HtmlBody = "<p>Old body</p>", IsSystemDefault = true, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        var controller = new EmailTemplatesController(db);
        AttachAnonymousUser(controller);

        var result = await controller.Update(id, new UpdateEmailTemplateRequest(
            "Subject with {{TotallyMadeUp}}", "<p>Body</p>"), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(badRequest.Value);
        Assert.Contains("TotallyMadeUp", problem.Detail);

        var reloaded = await db.EmailTemplates.FirstAsync(t => t.Id == id);
        Assert.Equal("Old subject", reloaded.Subject);
        Assert.True(reloaded.IsSystemDefault);
    }
}
