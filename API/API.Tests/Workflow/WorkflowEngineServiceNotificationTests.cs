// API.Tests/Workflow/WorkflowEngineServiceNotificationTests.cs
using API.Application.Notifications;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowEngineServiceNotificationTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    // Seeds a minimal single-stage ResearchProposal route (Dean approves ->
    // terminal) so ApproveAsync's next-stage lookup resolves to null on the
    // very first approval, matching the "Dean is the last stage" scenario
    // the spec's own data-flow example describes.
    private static async Task SeedSingleStageProposalRouteAsync(ApplicationDbContext db)
    {
        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.ResearchProposal, Phase = WorkflowPhase.Indent, Name = "Proposal Route", IsActive = true,
        });
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.WithDean,
            Sequence = 1, CanApprove = true, CanReject = true, AllowedRoles = "Dean",
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ApproveAsync_TerminalApproval_NotifiesRequester()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        await SeedSingleStageProposalRouteAsync(db);

        var ownerId = Guid.NewGuid();
        var proposalId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = ownerId, UserName = "owner@test.local", FullName = "Proposal Owner" });
        db.ResearchProposals.Add(new ResearchProposal { Id = proposalId, OwnerUserId = ownerId, Title = "AI Research", Agency = "Test Agency" });

        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.ResearchProposal, RequestId = proposalId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithDean, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var notifications = new Mock<IApprovalNotificationService>();
        var resolver = new WorkflowRequesterResolver(db);
        var engine = new WorkflowEngineService(db, notifications: notifications.Object, requesterResolver: resolver);

        await engine.ApproveAsync(instanceId, Guid.NewGuid(), ["Dean"], "Looks good");

        notifications.Verify(n => n.NotifyAsync(
            "proposal.approved",
            It.Is<ApplicationUser>(u => u.Id == ownerId),
            It.IsAny<IReadOnlyDictionary<string, string>>(),
            "ResearchProposal", proposalId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectAsync_AlwaysNotifiesRequester()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        await SeedSingleStageProposalRouteAsync(db);

        var ownerId = Guid.NewGuid();
        var proposalId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = ownerId, UserName = "owner@test.local", FullName = "Proposal Owner" });
        db.ResearchProposals.Add(new ResearchProposal { Id = proposalId, OwnerUserId = ownerId, Title = "AI Research", Agency = "Test Agency" });

        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.ResearchProposal, RequestId = proposalId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithDean, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var notifications = new Mock<IApprovalNotificationService>();
        var resolver = new WorkflowRequesterResolver(db);
        var engine = new WorkflowEngineService(db, notifications: notifications.Object, requesterResolver: resolver);

        await engine.RejectAsync(instanceId, Guid.NewGuid(), ["Dean"], "Not viable");

        notifications.Verify(n => n.NotifyAsync(
            "proposal.rejected",
            It.Is<ApplicationUser>(u => u.Id == ownerId),
            It.IsAny<IReadOnlyDictionary<string, string>>(),
            "ResearchProposal", proposalId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveAsync_DirectorApprovedIndent_NotifiesRequester()
    {
        // Indents that go all the way to the Director (>1L) terminate at
        // WorkflowStage.IndentApproved, not the generic Approved every other
        // route uses -- IndentServiceBase's own two guards already treat
        // both as "approved". A notification check for Approved alone would
        // silently never fire for this path (a real bug this test guards
        // against -- caught in final review, see the fix in ApproveAsync).
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();

        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.DynamicIndent, Phase = WorkflowPhase.Indent, Name = "Indent Route", IsActive = true,
        });
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.Director,
            Sequence = 1, CanApprove = true, CanReject = true, AllowedRoles = "Director",
        });
        // A second stage after Director so GetNextStageAsync resolves to a
        // real row (IndentApproved) instead of falling back to next==null,
        // which ApproveAsync's own fallback would otherwise hardcode to the
        // generic Approved -- masking exactly the bug this test targets.
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.IndentApproved,
            Sequence = 2, CanApprove = false, CanReject = false, AllowedRoles = "",
        });

        var ownerId = Guid.NewGuid();
        var indentId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = ownerId, UserName = "owner2@test.local", FullName = "Indent Owner" });
        db.Indents.Add(new Indent { Id = indentId, OwnerUserId = ownerId, IndentNumber = "MNIT/RNC/IND/2026-27/0001", Purpose = "Lab equipment" });

        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.DynamicIndent, RequestId = indentId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.Director, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var notifications = new Mock<IApprovalNotificationService>();
        var resolver = new WorkflowRequesterResolver(db);
        var engine = new WorkflowEngineService(db, notifications: notifications.Object, requesterResolver: resolver);

        await engine.ApproveAsync(instanceId, Guid.NewGuid(), ["Director"], "Approved");

        var instance = await db.WorkflowInstances.FirstAsync(w => w.Id == instanceId);
        Assert.Equal(WorkflowStage.IndentApproved, instance.CurrentStage);

        notifications.Verify(n => n.NotifyAsync(
            "indent.approved",
            It.Is<ApplicationUser>(u => u.Id == ownerId),
            It.IsAny<IReadOnlyDictionary<string, string>>(),
            "DynamicIndent", indentId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApproveAsync_ManpowerDocument_NeverNotifies_RecruitmentIsOutOfScope()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();

        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.ManpowerDocument, Phase = WorkflowPhase.Indent, Name = "Merit List Route", IsActive = true,
        });
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.WithDean,
            Sequence = 1, CanApprove = true, CanReject = true, AllowedRoles = "Dean",
        });

        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.ManpowerDocument, RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithDean, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var notifications = new Mock<IApprovalNotificationService>();
        var resolver = new WorkflowRequesterResolver(db);
        var engine = new WorkflowEngineService(db, notifications: notifications.Object, requesterResolver: resolver);

        await engine.ApproveAsync(instanceId, Guid.NewGuid(), ["Dean"], null);

        notifications.Verify(n => n.NotifyAsync(
            It.IsAny<string>(), It.IsAny<ApplicationUser>(), It.IsAny<IReadOnlyDictionary<string, string>>(),
            It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
