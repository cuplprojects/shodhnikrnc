using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

/// <summary>
/// UndoLastActionAsync lets the actor who performed the most recent step on a
/// workflow instance take it back -- but only while nothing downstream has
/// happened since, by anyone, including the actor's own later actions. It is
/// the generic, engine-level half of undo; the Sanction-specific
/// Project-deletion path lives in ResearchProposalServiceTests instead, since
/// RecordSanctionAsync never calls AppendStep in the first place.
/// </summary>
public class WorkflowUndoTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<(WorkflowEngineService Engine, WorkflowInstance Instance, Guid Raiser)> RaisedAsync(TestDbContext db)
    {
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var raiser = Guid.NewGuid();
        var instance = await engine.RaiseAsync(RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, raiser);
        return (engine, instance, raiser);
    }

    [Fact]
    public async Task UndoLastActionAsync_SameActorNothingSince_RevertsToThePreviousStage()
    {
        var db = CreateDb();
        var (engine, instance, _) = await RaisedAsync(db);
        var forwarder = Guid.NewGuid();

        // Raised has no AllowedRoles (belongs to whoever raised it), so any
        // roles forward it -- matching how the shipped route's initial stage
        // behaves elsewhere in this suite.
        await engine.ForwardAsync(instance.Id, forwarder, Raiser, "moving it on");

        var beforeUndo = await engine.GetAsync(instance.Id);
        beforeUndo!.CurrentStage.Should().NotBe(WorkflowStage.Raised, "the Forward must actually have moved it");

        await engine.UndoLastActionAsync(instance.Id, forwarder);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(
            WorkflowStage.Raised, "the previous stage is what the Raise step's own Stage recorded");

        var forwardStep = reloaded.Steps.Single(s => s.Action == WorkflowAction.Forward);
        forwardStep.IsUndone.Should().BeTrue();
        forwardStep.UndoneAt.Should().NotBeNull();

        // The row itself is never deleted -- a reversed decision is still
        // meaningful history.
        reloaded.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward);
        reloaded.Steps.Should().HaveCount(2, "Raise and Forward both still exist as rows");
    }

    [Fact]
    public async Task UndoLastActionAsync_DifferentActor_Throws()
    {
        var db = CreateDb();
        var (engine, instance, _) = await RaisedAsync(db);
        var forwarder = Guid.NewGuid();
        var someoneElse = Guid.NewGuid();

        await engine.ForwardAsync(instance.Id, forwarder, Raiser, "submitting");

        var act = () => engine.UndoLastActionAsync(instance.Id, someoneElse);

        await act.Should().ThrowAsync<CannotUndoException>();
    }

    [Fact]
    public async Task UndoLastActionAsync_SomethingHappenedSince_Throws()
    {
        var db = CreateDb();
        var (engine, instance, _) = await RaisedAsync(db);
        var userA = Guid.NewGuid();
        var userB = Guid.NewGuid();

        // Raised -> SignedCopyUploaded (by A), then SignedCopyUploaded ->
        // Assigned (by B, a legitimate later-stage actor). A's own original
        // step is no longer the last undone-eligible step once B has acted.
        await engine.ForwardAsync(instance.Id, userA, Raiser, "A's forward");
        await engine.ForwardAsync(instance.Id, userB, Hod, "B's forward");

        var act = () => engine.UndoLastActionAsync(instance.Id, userA);

        await act.Should().ThrowAsync<CannotUndoException>(
            "the most recent NON-undone step now belongs to B, not A -- " +
            "undo looks at what is actually last, not at whether this actor ever acted at all");
    }
}
