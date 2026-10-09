using API.Application.Notifications;
using API.Controllers;
using API.Domain.Entities;
using API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace API.Tests.Controllers;

public class EmailLogControllerTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task List_FiltersBySucceeded()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        db.EmailLogs.Add(new EmailLog { Id = Guid.NewGuid(), TemplateKey = "a", ToAddress = "x@y.com", Subject = "S", RenderedBody = "B", Succeeded = true, SentAt = DateTimeOffset.UtcNow, RelatedEntityType = "X", RelatedEntityId = Guid.NewGuid() });
        db.EmailLogs.Add(new EmailLog { Id = Guid.NewGuid(), TemplateKey = "b", ToAddress = "x@y.com", Subject = "S2", RenderedBody = "B2", Succeeded = false, ErrorMessage = "boom", SentAt = DateTimeOffset.UtcNow, RelatedEntityType = "X", RelatedEntityId = Guid.NewGuid() });
        await db.SaveChangesAsync();
        var sender = new Mock<IEmailSender>();
        var controller = new EmailLogController(db, sender.Object);

        var result = await controller.List(succeeded: false, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<API.Contracts.Notifications.EmailLogResponse>>(ok.Value);
        Assert.Single(list);
        Assert.Equal("boom", list[0].ErrorMessage);
    }

    [Fact]
    public async Task Resend_Success_WritesNewLogRow_LeavesOriginalUnchanged()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var originalId = Guid.NewGuid();
        db.EmailLogs.Add(new EmailLog
        {
            Id = originalId, TemplateKey = "proposal.approved", ToAddress = "pi@test.edu",
            Subject = "Approved", RenderedBody = "<p>Approved</p>", Succeeded = false, ErrorMessage = "SMTP down",
            SentAt = DateTimeOffset.UtcNow.AddHours(-1), RelatedEntityType = "ResearchProposal", RelatedEntityId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();
        var sender = new Mock<IEmailSender>();
        var controller = new EmailLogController(db, sender.Object);

        var result = await controller.Resend(originalId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var resent = Assert.IsType<API.Contracts.Notifications.EmailLogResponse>(ok.Value);
        Assert.True(resent.Succeeded);
        Assert.NotEqual(originalId, resent.Id);

        sender.Verify(s => s.SendAsync("pi@test.edu", "Approved", "<p>Approved</p>", null, It.IsAny<CancellationToken>()), Times.Once);

        var original = await db.EmailLogs.FirstAsync(l => l.Id == originalId);
        Assert.False(original.Succeeded);
        Assert.Equal("SMTP down", original.ErrorMessage);

        var totalLogs = await db.EmailLogs.CountAsync();
        Assert.Equal(2, totalLogs);
    }
}
