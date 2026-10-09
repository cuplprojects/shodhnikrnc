using API.Application.Notifications;
using API.Domain.Entities;
using API.Infrastructure.Notifications;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace API.Tests.Notifications;

public class ApprovalNotificationServiceTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static ApplicationUser TestUser() => new()
    {
        Id = Guid.NewGuid(),
        UserName = "pi@test.edu",
        Email = "pi@test.edu",
        FullName = "Test PI",
        IsActive = true,
    };

    [Fact]
    public async Task NotifyAsync_RendersAndSends_LogsSuccess()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(), Key = "proposal.approved", Name = "Proposal Approved",
            Subject = "Approved: {{ProposalTitle}}", HtmlBody = "<p>Hi {{RequesterName}}, {{ProposalTitle}} is approved.</p>",
            IsSystemDefault = true, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var sender = new Mock<IEmailSender>();
        var svc = new ApprovalNotificationService(db, sender.Object);
        var user = TestUser();
        var proposalId = Guid.NewGuid();

        await svc.NotifyAsync("proposal.approved", user,
            new Dictionary<string, string> { ["RequesterName"] = "Test PI", ["ProposalTitle"] = "AI Research", ["PortalLink"] = "https://portal/proposals/1" },
            "ResearchProposal", proposalId);

        sender.Verify(s => s.SendAsync(
            "pi@test.edu", "Approved: AI Research",
            It.Is<string>(b => b.Contains("Hi Test PI") && b.Contains("AI Research is approved")),
            null, It.IsAny<CancellationToken>()), Times.Once);

        var log = await db.EmailLogs.FirstAsync();
        Assert.True(log.Succeeded);
        Assert.Null(log.ErrorMessage);
        Assert.Equal("proposal.approved", log.TemplateKey);
        Assert.Equal("pi@test.edu", log.ToAddress);
        Assert.Equal("ResearchProposal", log.RelatedEntityType);
        Assert.Equal(proposalId, log.RelatedEntityId);
        Assert.Contains("AI Research is approved", log.RenderedBody);
    }

    [Fact]
    public async Task NotifyAsync_HtmlEncodesSubstitutedValues_ButNotPortalLink()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(), Key = "proposal.approved", Name = "Proposal Approved",
            Subject = "Approved: {{ProposalTitle}}",
            HtmlBody = "<p>Hi {{RequesterName}}, see <a href=\"{{PortalLink}}\">{{ProposalTitle}}</a></p>",
            IsSystemDefault = true, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var sender = new Mock<IEmailSender>();
        var svc = new ApprovalNotificationService(db, sender.Object);
        var user = TestUser();

        // A title containing '"' and '<' could otherwise break out of the
        // href attribute or inject markup into the body.
        await svc.NotifyAsync("proposal.approved", user,
            new Dictionary<string, string>
            {
                ["RequesterName"] = "O'Brien & Co.",
                ["ProposalTitle"] = "<script>alert(1)</script> \"quoted\"",
                ["PortalLink"] = "https://portal/proposals/1?ref=email&x=1",
            },
            "ResearchProposal", Guid.NewGuid());

        var log = await db.EmailLogs.FirstAsync();
        Assert.DoesNotContain("<script>", log.RenderedBody);
        Assert.Contains("&lt;script&gt;", log.RenderedBody);
        Assert.Contains("O&#39;Brien &amp; Co.", log.RenderedBody);
        // PortalLink itself is left unescaped -- it's a URL, not display text.
        Assert.Contains("href=\"https://portal/proposals/1?ref=email&x=1\"", log.RenderedBody);
    }

    [Fact]
    public async Task NotifyAsync_WhenSendThrows_LogsFailureAndDoesNotRethrow()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(), Key = "proposal.rejected", Name = "Proposal Rejected",
            Subject = "Rejected", HtmlBody = "<p>Sorry {{RequesterName}}.</p>",
            IsSystemDefault = true, UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var sender = new Mock<IEmailSender>();
        sender.Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP down"));
        var svc = new ApprovalNotificationService(db, sender.Object);
        var user = TestUser();

        var ex = await Record.ExceptionAsync(() => svc.NotifyAsync(
            "proposal.rejected", user, new Dictionary<string, string> { ["RequesterName"] = "Test PI" },
            "ResearchProposal", Guid.NewGuid()));

        Assert.Null(ex);
        var log = await db.EmailLogs.FirstAsync();
        Assert.False(log.Succeeded);
        Assert.Contains("SMTP down", log.ErrorMessage);
    }

    [Fact]
    public async Task NotifyAsync_UnknownTemplateKey_DoesNotThrow_LeavesNoLogRow()
    {
        // NotifyAsync's contract (see its own interface doc comment) is that
        // it never throws -- every caller invokes it after an
        // approval/rejection has already been committed, so a missing
        // template row must degrade to "notification lost", not surface as
        // an exception that could turn a successful approval into a 500.
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var sender = new Mock<IEmailSender>();
        var svc = new ApprovalNotificationService(db, sender.Object);

        var ex = await Record.ExceptionAsync(() =>
            svc.NotifyAsync("no-such-key", TestUser(), new Dictionary<string, string>(), "X", Guid.NewGuid()));

        Assert.Null(ex);
        Assert.Empty(db.EmailLogs);
    }
}
