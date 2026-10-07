using API.Application.Audit;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Audit;

public class AuditServiceTests
{
    private static (AuditService Service, TestDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestDbContext(options);
        var service = new AuditService(db);
        return (service, db);
    }

    [Fact]
    public async Task LogAsync_WritesOneRowWithTheGivenFields()
    {
        var (service, db) = CreateService();
        var entityId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        await service.LogAsync("Project", entityId, "GrantReceiptRecorded", actorId, "Amount=15000");

        var row = db.AuditLogs.Single();
        row.EntityType.Should().Be("Project");
        row.EntityId.Should().Be(entityId);
        row.Action.Should().Be("GrantReceiptRecorded");
        row.ActorUserId.Should().Be(actorId);
        row.Detail.Should().Be("Amount=15000");
    }

    [Fact]
    public async Task LogAsync_DetailIsOptional()
    {
        var (service, db) = CreateService();

        await service.LogAsync("Role", Guid.NewGuid(), "RoleCreated", Guid.NewGuid());

        db.AuditLogs.Single().Detail.Should().BeNull();
    }

    [Fact]
    public async Task LogAsync_TwoCallsWriteTwoIndependentRows()
    {
        var (service, db) = CreateService();

        await service.LogAsync("Project", Guid.NewGuid(), "Created", Guid.NewGuid());
        await service.LogAsync("Project", Guid.NewGuid(), "Updated", Guid.NewGuid());

        db.AuditLogs.Count().Should().Be(2);
    }

    // ---- QueryAsync -------------------------------------------------------------

    [Fact]
    public async Task QueryAsync_WithNoFilters_ReturnsEverythingNewestFirst()
    {
        var (service, _) = CreateService();
        await service.LogAsync("Project", Guid.NewGuid(), "First", Guid.NewGuid());
        await service.LogAsync("Project", Guid.NewGuid(), "Second", Guid.NewGuid());

        var rows = await service.QueryAsync();

        rows.Should().HaveCount(2);
        rows.Select(r => r.Action).Should().Equal("Second", "First");
    }

    [Fact]
    public async Task QueryAsync_FilteredByEntityType_ExcludesOthers()
    {
        var (service, _) = CreateService();
        await service.LogAsync("Project", Guid.NewGuid(), "ProjectAction", Guid.NewGuid());
        await service.LogAsync("Role", Guid.NewGuid(), "RoleAction", Guid.NewGuid());

        var rows = await service.QueryAsync(entityType: "Project");

        rows.Should().ContainSingle(r => r.Action == "ProjectAction");
    }

    [Fact]
    public async Task QueryAsync_FilteredByEntityId_ExcludesOtherEntitiesOfTheSameType()
    {
        var (service, _) = CreateService();
        var thisProjectId = Guid.NewGuid();
        await service.LogAsync("Project", thisProjectId, "ThisOne", Guid.NewGuid());
        await service.LogAsync("Project", Guid.NewGuid(), "AnotherOne", Guid.NewGuid());

        var rows = await service.QueryAsync(entityId: thisProjectId);

        rows.Should().HaveCount(1);
        rows.Single().Action.Should().Be("ThisOne");
    }

    [Fact]
    public async Task QueryAsync_FiltersAreAdditive_NotOr()
    {
        var (service, _) = CreateService();
        var projectId = Guid.NewGuid();
        await service.LogAsync("Project", projectId, "Match", Guid.NewGuid());
        await service.LogAsync("Project", Guid.NewGuid(), "WrongEntity", Guid.NewGuid());
        await service.LogAsync("Role", projectId, "WrongType", Guid.NewGuid());

        var rows = await service.QueryAsync(entityType: "Project", entityId: projectId);

        rows.Should().HaveCount(1);
        rows.Single().Action.Should().Be("Match");
    }
}
