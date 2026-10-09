using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class SelectionCommitteeWorkflowSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<TestDbContext> SeededAsync()
    {
        var db = CreateDb();
        await SelectionCommitteeWorkflowSeeder.SeedAsync(db);
        return db;
    }

    [Fact]
    public async Task SeedAsync_CreatesExpectedRoute()
    {
        using var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstAsync(d => d.RequestType == RequestType.SelectionCommittee && d.Phase == WorkflowPhase.Indent);

        definition.Stages.Should().HaveCount(4);

        var piStage = definition.Stages.Single(s => s.Sequence == 1);
        piStage.Stage.Should().Be(WorkflowStage.WithPISelectionCommittee);
        piStage.AllowedRoles.Should().BeEmpty();
        piStage.IsInitial.Should().BeTrue();

        var deanStage = definition.Stages.Single(s => s.Sequence == 2);
        deanStage.Stage.Should().Be(WorkflowStage.WithDeanSelectionCommittee);
        deanStage.AllowedRoles.Should().Be("Dean");
        deanStage.CanApprove.Should().BeTrue();
        deanStage.CanReturn.Should().BeTrue();

        var terminalStage = definition.Stages.Single(s => s.Sequence == 3);
        terminalStage.Stage.Should().Be(WorkflowStage.SelectionCommitteeApproved);
        terminalStage.IsTerminal.Should().BeTrue();

        var returnedStage = definition.Stages.Single(s => s.Sequence == 4);
        returnedStage.Stage.Should().Be(WorkflowStage.ReturnedToPISelectionCommittee);
        returnedStage.AllowedRoles.Should().BeEmpty();
        returnedStage.ForwardOverrideSequence.Should().Be(2);
    }

    [Fact]
    public async Task SeedAsync_SetsResubmitEntrySequenceCorrectly()
    {
        using var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .FirstAsync(d => d.RequestType == RequestType.SelectionCommittee && d.Phase == WorkflowPhase.Indent);

        definition.ResubmitEntrySequence.Should().Be(SelectionCommitteeWorkflowSeeder.ResubmitEntrySequence);
        definition.ResubmitEntrySequence.Should().Be(4);
    }

    [Fact]
    public async Task SeedAsync_IsIdempotent()
    {
        using var db = await SeededAsync();

        await SelectionCommitteeWorkflowSeeder.SeedAsync(db);

        var count = await db.WorkflowDefinitions
            .CountAsync(d => d.RequestType == RequestType.SelectionCommittee && d.Phase == WorkflowPhase.Indent);
        count.Should().Be(1);
    }
}
