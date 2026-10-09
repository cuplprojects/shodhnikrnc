using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// Lookup of the stored route. The missing-stage case is the one that matters:
/// a SuperAdmin can remove a stage that live instances are sitting on, and the
/// engine must say so rather than stall an instance silently.
/// </summary>
public class WorkflowDefinitionServiceTests
{
    private static async Task<(WorkflowDefinitionService Service, TestDbContext Db)> CreateSeededAsync()
    {
        var db = new TestDbContext(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        await WorkflowDefinitionSeeder.SeedAsync(db);
        return (new WorkflowDefinitionService(db), db);
    }

    [Fact]
    public async Task GetAsync_ReturnsTheRouteForTheRequestTypeAndPhase()
    {
        var (service, _) = await CreateSeededAsync();

        // ManpowerDocument (Recruitment's merit-list route), not Consumable:
        // Consumable/Equipment/Contingency/DynamicIndent are deliberately
        // excluded from WorkflowDefinitionSeeder.SeedAsync's generic
        // ShippedRoute -- they get IndentWorkflowSeeder's own cost-based
        // routing instead, so under CreateSeededAsync's seeding (only
        // WorkflowDefinitionSeeder) they would have no WorkflowDefinition row
        // at all, and this test is about the generic shipped route itself,
        // not indent-specific routing.
        var definition = await service.GetAsync(RequestType.ManpowerDocument, WorkflowPhase.Indent);

        definition.RequestType.Should().Be(RequestType.ManpowerDocument);
        definition.Phase.Should().Be(WorkflowPhase.Indent);
        definition.Stages.Should().HaveCount(7);
    }

    [Fact]
    public async Task GetAsync_DistinguishesPhasesOfTheSameRequestType()
    {
        var (service, _) = await CreateSeededAsync();

        var indent = await service.GetAsync(RequestType.Travel, WorkflowPhase.Indent);
        var bill = await service.GetAsync(RequestType.Travel, WorkflowPhase.Bill);

        bill.Id.Should().NotBe(indent.Id);
    }

    [Fact]
    public async Task GetAsync_FallsBackToTheShippedRouteWhenNothingIsConfigured()
    {
        // Seeding runs in Development only (Program.cs), so a production database
        // has no definitions until someone seeds it. Requiring a configured route
        // would mean every transition 500s there. The route is moving into data,
        // not becoming mandatory, so an unconfigured pair behaves exactly as it
        // did before Phase 7.
        var db = new TestDbContext(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var service = new WorkflowDefinitionService(db);

        var definition = await service.GetAsync(RequestType.ManpowerDocument, WorkflowPhase.Indent);

        definition.Stages.Should().HaveCount(WorkflowDefinitionSeeder.ShippedRoute.Length);
        definition.Stages.OrderBy(s => s.Sequence).Select(s => s.Stage)
            .Should().Equal(WorkflowDefinitionSeeder.ShippedRoute.Select(r => r.Stage));
    }

    [Fact]
    public async Task GetAsync_FallsBackWhenTheOnlyDefinitionIsInactive()
    {
        var (service, db) = await CreateSeededAsync();
        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.ManpowerDocument && d.Phase == WorkflowPhase.Indent);
        definition.IsActive = false;
        await db.SaveChangesAsync();

        var resolved = await service.GetAsync(RequestType.ManpowerDocument, WorkflowPhase.Indent);

        // Deactivating a route retires the customisation, returning the pair to
        // shipped behaviour rather than breaking it.
        resolved.Stages.Should().HaveCount(WorkflowDefinitionSeeder.ShippedRoute.Length);
    }

    [Fact]
    public async Task GetStageAsync_ReturnsTheRowForTheCurrentStage()
    {
        var (service, _) = await CreateSeededAsync();

        var stage = await service.GetStageAsync(
            RequestType.ManpowerDocument, WorkflowPhase.Indent, WorkflowStage.ForwardedDR);

        stage.Sequence.Should().Be(6);
        stage.CanApprove.Should().BeTrue();
        stage.AllowedRoleList().Should().Equal("Dean", "Director");
    }

    [Fact]
    public async Task GetStageAsync_ThrowsWhenTheStageIsNotInTheRoute()
    {
        // Reachable in production: a SuperAdmin removes a stage while instances
        // are sitting on it. The instance must not stall silently.
        var (service, db) = await CreateSeededAsync();
        var stage = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Definition!.RequestType == RequestType.ManpowerDocument
                           && s.Definition.Phase == WorkflowPhase.Indent
                           && s.Stage == WorkflowStage.Forwarded);
        db.WorkflowStageDefinitions.Remove(stage);
        await db.SaveChangesAsync();

        var act = () => service.GetStageAsync(
            RequestType.ManpowerDocument, WorkflowPhase.Indent, WorkflowStage.Forwarded);

        await act.Should().ThrowAsync<WorkflowConfigurationException>()
            .WithMessage("*Forwarded*");
    }

    [Fact]
    public async Task GetNextStageAsync_ResolvesBySequence()
    {
        var (service, _) = await CreateSeededAsync();

        var next = await service.GetNextStageAsync(
            RequestType.ManpowerDocument, WorkflowPhase.Indent, WorkflowStage.Assigned);

        next!.Stage.Should().Be(WorkflowStage.Forwarded);
    }

    [Fact]
    public async Task GetNextStageAsync_ReturnsNullAtTheEndOfTheRoute()
    {
        var (service, _) = await CreateSeededAsync();

        var next = await service.GetNextStageAsync(
            RequestType.ManpowerDocument, WorkflowPhase.Indent, WorkflowStage.Director);

        next.Should().BeNull("Director is the last row in the seeded route");
    }

    [Fact]
    public async Task GetAsync_CachesWithinTheServiceLifetime()
    {
        // The service is scoped, so this is one request's worth of caching. The
        // point is that a single transition does not re-query per stage lookup.
        var (service, db) = await CreateSeededAsync();

        await service.GetAsync(RequestType.ManpowerDocument, WorkflowPhase.Indent);

        // Remove the route behind the service's back; a cached read still works.
        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.ManpowerDocument && d.Phase == WorkflowPhase.Indent);
        db.WorkflowDefinitions.Remove(definition);
        await db.SaveChangesAsync();

        var again = await service.GetAsync(RequestType.ManpowerDocument, WorkflowPhase.Indent);

        again.Stages.Should().HaveCount(7);
    }
}
