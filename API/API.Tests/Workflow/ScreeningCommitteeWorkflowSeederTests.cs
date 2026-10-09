using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class ScreeningCommitteeWorkflowSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<TestDbContext> SeededAsync()
    {
        var db = CreateDb();
        await ScreeningCommitteeWorkflowSeeder.SeedAsync(db);
        return db;
    }

    [Fact]
    public async Task SeedAsync_CreatesExpectedRoute()
    {
        using var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstAsync(d => d.RequestType == RequestType.ScreeningCommittee && d.Phase == WorkflowPhase.Indent);

        definition.Stages.Should().HaveCount(3);
        var piStage = definition.Stages.Single(s => s.Sequence == 1);
        piStage.Stage.Should().Be(WorkflowStage.WithPIScreeningCommittee);
        piStage.AllowedRoles.Should().BeEmpty();
        piStage.IsInitial.Should().BeTrue();

        var deanStage = definition.Stages.Single(s => s.Sequence == 2);
        deanStage.Stage.Should().Be(WorkflowStage.WithDeanScreeningCommittee);
        deanStage.AllowedRoles.Should().Be("Dean");
        deanStage.CanApprove.Should().BeTrue();
        deanStage.CanReturn.Should().BeFalse();

        var terminalStage = definition.Stages.Single(s => s.Sequence == 3);
        terminalStage.Stage.Should().Be(WorkflowStage.ScreeningCommitteeApproved);
        terminalStage.IsTerminal.Should().BeTrue();
    }

    [Fact]
    public async Task SeedAsync_IsIdempotent()
    {
        using var db = await SeededAsync();

        await ScreeningCommitteeWorkflowSeeder.SeedAsync(db);

        var count = await db.WorkflowDefinitions
            .CountAsync(d => d.RequestType == RequestType.ScreeningCommittee && d.Phase == WorkflowPhase.Indent);
        count.Should().Be(1);
    }
}
