using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The mapping for the stored approval route. The cascade matters because a
/// definition without its stages is not a partial route, it is a broken one:
/// the engine would find no stage row for an instance's current stage.
/// </summary>
public class WorkflowDefinitionPersistenceTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static WorkflowDefinition DefinitionWith(
        RequestType requestType = RequestType.Consumable,
        WorkflowPhase phase = WorkflowPhase.Indent,
        params (int Sequence, WorkflowStage Stage, string Roles)[] stages)
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = requestType,
            Phase = phase,
            Name = $"{requestType} ({phase})",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var (sequence, stage, roles) in stages)
        {
            definition.Stages.Add(new WorkflowStageDefinition
            {
                Id = Guid.NewGuid(),
                WorkflowDefinitionId = definition.Id,
                Sequence = sequence,
                Stage = stage,
                AllowedRoles = roles,
                IsInitial = sequence == 1,
            });
        }

        return definition;
    }

    [Fact]
    public async Task Definition_RoundTripsWithItsStages()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(DefinitionWith(
            stages:
            [
                (1, WorkflowStage.Raised, ""),
                (2, WorkflowStage.SignedCopyUploaded, "Dean"),
            ]));
        await db.SaveChangesAsync();

        var reloaded = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync();

        reloaded.Stages.Should().HaveCount(2);
        reloaded.Stages.OrderBy(s => s.Sequence).Last().AllowedRoles.Should().Be("Dean");
    }

    [Fact]
    public async Task DeletingADefinition_CascadesToItsStages()
    {
        var db = CreateDb();
        var definition = DefinitionWith(
            stages: [(1, WorkflowStage.Raised, ""), (2, WorkflowStage.ForwardedDR, "Dean")]);
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();

        db.WorkflowDefinitions.Remove(definition);
        await db.SaveChangesAsync();

        db.WorkflowStageDefinitions.Should().BeEmpty();
    }

    // The three below assert on model metadata rather than on saved rows.
    //
    // The in-memory provider enforces neither unique indexes nor delete
    // behaviour: the round-trip version of the cascade test above passes just
    // as happily with DeleteBehavior.Restrict configured, because the provider
    // cascades the loaded children by itself. Asserting on the model is what
    // actually fails when the mapping is wrong, and the mapping is what the
    // relational migration is generated from.
    //
    // They build the real ApplicationDbContext rather than TestDbContext,
    // because TestDbContext declares its own minimal model with no indexes --
    // asserting against it would be asserting against the wrong mapping.
    private static ApplicationDbContext CreateRealContextModel() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public void Stages_CascadeDeleteWithTheirDefinition()
    {
        using var db = CreateRealContextModel();

        var foreignKey = db.Model
            .FindEntityType(typeof(WorkflowStageDefinition))!
            .GetForeignKeys()
            .Single(fk => fk.PrincipalEntityType.ClrType == typeof(WorkflowDefinition));

        foreignKey.DeleteBehavior.Should().Be(DeleteBehavior.Cascade);
    }

    [Fact]
    public void OneDefinitionPerRequestTypeAndPhase_IsEnforcedByAUniqueIndex()
    {
        using var db = CreateRealContextModel();

        var index = db.Model
            .FindEntityType(typeof(WorkflowDefinition))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[] { nameof(WorkflowDefinition.RequestType), nameof(WorkflowDefinition.Phase) }));

        index.IsUnique.Should().BeTrue();
    }

    [Fact]
    public void SequenceIsUniqueWithinADefinition()
    {
        // Forwarding resolves the next stage by Sequence + 1, so a duplicate
        // sequence would make the next step ambiguous.
        using var db = CreateRealContextModel();

        var index = db.Model
            .FindEntityType(typeof(WorkflowStageDefinition))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[]
                {
                    nameof(WorkflowStageDefinition.WorkflowDefinitionId),
                    nameof(WorkflowStageDefinition.Sequence),
                }));

        index.IsUnique.Should().BeTrue();
    }

    [Fact]
    public async Task TheSameRequestType_CanHaveOneDefinitionPerPhase()
    {
        // Travel raises an Indent workflow and, later, a Bill workflow. They are
        // separate routes, so the uniqueness is on the pair, not RequestType.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(DefinitionWith(RequestType.Travel, WorkflowPhase.Indent,
            (1, WorkflowStage.Raised, "")));
        db.WorkflowDefinitions.Add(DefinitionWith(RequestType.Travel, WorkflowPhase.Bill,
            (1, WorkflowStage.Raised, "")));

        await db.SaveChangesAsync();

        db.WorkflowDefinitions.Should().HaveCount(2);
    }

    [Fact]
    public async Task StagesAreOrderedBySequence_NotInsertionOrder()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(DefinitionWith(
            stages:
            [
                (3, WorkflowStage.Assigned, "RegularStaff"),
                (1, WorkflowStage.Raised, ""),
                (2, WorkflowStage.SignedCopyUploaded, "Dean"),
            ]));
        await db.SaveChangesAsync();

        var stages = await db.WorkflowStageDefinitions
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        stages.Should().Equal(
            WorkflowStage.Raised,
            WorkflowStage.SignedCopyUploaded,
            WorkflowStage.Assigned);
    }
}
