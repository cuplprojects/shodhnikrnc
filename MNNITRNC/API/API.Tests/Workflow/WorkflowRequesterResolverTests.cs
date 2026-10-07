// API.Tests/Workflow/WorkflowRequesterResolverTests.cs
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowRequesterResolverTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task ResolveRequesterUserIdAsync_ResearchProposal_ReturnsOwnerUserId()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var ownerId = Guid.NewGuid();
        var proposalId = Guid.NewGuid();
        db.ResearchProposals.Add(new ResearchProposal { Id = proposalId, OwnerUserId = ownerId, Title = "Test", Agency = "Test Agency" });
        await db.SaveChangesAsync();
        var resolver = new WorkflowRequesterResolver(db);

        var result = await resolver.ResolveRequesterUserIdAsync(RequestType.ResearchProposal, proposalId);

        Assert.Equal(ownerId, result);
    }

    [Fact]
    public async Task ResolveRequesterUserIdAsync_ConsumableIndent_ResolvesViaProject()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var ownerId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var indentId = Guid.NewGuid();
        db.Projects.Add(new Project { Id = projectId, OwnerUserId = ownerId, ProjectTitle = "Test Project", SanctionNo = "SANC/001", Agency = "Test Agency" });
        db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = indentId, ProjectId = projectId, Name = "Item", Purpose = "Purpose",
            TechnicalSpecs = "N/A", UnitOfMeasurement = "unit",
        });
        await db.SaveChangesAsync();
        var resolver = new WorkflowRequesterResolver(db);

        var result = await resolver.ResolveRequesterUserIdAsync(RequestType.Consumable, indentId);

        Assert.Equal(ownerId, result);
    }

    [Fact]
    public async Task ResolveRequesterUserIdAsync_FellowshipClaim_ResolvesViaManpowerSelection()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var fellowUserId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var claimId = Guid.NewGuid();
        db.ManpowerSelections.Add(new ManpowerSelection { Id = appointmentId, ApplicationUserId = fellowUserId, CandidateId = Guid.NewGuid(), SanctionedManpowerPositionId = Guid.NewGuid() });
        db.FellowshipClaims.Add(new FellowshipClaim { Id = claimId, FellowAppointmentId = appointmentId });
        await db.SaveChangesAsync();
        var resolver = new WorkflowRequesterResolver(db);

        var result = await resolver.ResolveRequesterUserIdAsync(RequestType.FellowshipClaim, claimId);

        Assert.Equal(fellowUserId, result);
    }

    [Fact]
    public async Task ResolveRequesterUserIdAsync_ManpowerDocument_ReturnsNull_RecruitmentIsOutOfScope()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var resolver = new WorkflowRequesterResolver(db);

        var result = await resolver.ResolveRequesterUserIdAsync(RequestType.ManpowerDocument, Guid.NewGuid());

        Assert.Null(result);
    }

    [Theory]
    [InlineData(RequestType.ResearchProposal, "proposal")]
    [InlineData(RequestType.Consumable, "indent")]
    [InlineData(RequestType.DynamicIndent, "indent")]
    [InlineData(RequestType.Travel, "travel")]
    [InlineData(RequestType.FellowshipClaim, "fellowship-claim")]
    [InlineData(RequestType.LeaveRequest, "leave-request")]
    [InlineData(RequestType.GrantReceipt, "grant-receipt")]
    [InlineData(RequestType.ManpowerDocument, null)]
    [InlineData(RequestType.Advertisement, null)]
    public void ResolveTemplateKeyPrefix_ReturnsExpectedPrefix(RequestType requestType, string? expected)
    {
        var db = BuildDb();
        var resolver = new WorkflowRequesterResolver(db);

        Assert.Equal(expected, resolver.ResolveTemplateKeyPrefix(requestType));
    }
}
