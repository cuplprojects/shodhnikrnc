using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

/// <summary>
/// ReturnAsync sends an instance back for correction rather than concluding it.
/// Where it lands is configured per route via
/// <see cref="WorkflowDefinition.ResubmitEntrySequence"/>, not hardcoded --
/// BRD Prompt 0's "resubmission behavior is configurable per workflow
/// definition".
/// </summary>
public class WorkflowReturnTests
{
    private static readonly Guid ActorId = Guid.NewGuid();

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    /// <summary>Raised -> Assigned -> Reviewing (can reject) -> Approved, with a
    /// configurable resubmit entry point.</summary>
    private static WorkflowDefinition RouteWithReentry(int? resubmitEntrySequence)
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            Phase = WorkflowPhase.Indent,
            Name = "Route with re-entry",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            ResubmitEntrySequence = resubmitEntrySequence,
        };

        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 2, Stage = WorkflowStage.Assigned, AllowedRoles = "RegularStaff",
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 3, Stage = WorkflowStage.ForwardedDR,
            AllowedRoles = "Dean", CanApprove = true, CanReject = true, CanReturn = true,
        });

        return definition;
    }

    private static async Task<(WorkflowEngineService Engine, WorkflowInstance Instance, TestDbContext Db)>
        RaisedAtDecisionStageAsync(int? resubmitEntrySequence)
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithReentry(resubmitEntrySequence));
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.ForwardedDR;
        await db.SaveChangesAsync();

        return (engine, instance, db);
    }

    [Fact]
    public async Task WithNoResubmitEntrySequence_ReturnRestartsAtTheInitialStage()
    {
        // Null means today's behaviour for every route that does not opt in:
        // restart at step 1.
        var (engine, instance, _) = await RaisedAtDecisionStageAsync(null);

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "needs a correction");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Raised);
    }

    [Fact]
    public async Task WithAResubmitEntrySequence_ReturnReEntersThere()
    {
        var (engine, instance, _) = await RaisedAtDecisionStageAsync(resubmitEntrySequence: 2);

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "needs a correction");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Assigned);
    }

    [Fact]
    public async Task ReturnIsRecordedAsAStep()
    {
        var (engine, instance, _) = await RaisedAtDecisionStageAsync(2);

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "please fix the budget head");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = reloaded!.Steps.OrderByDescending(s => s.Timestamp).First();
        step.Action.Should().Be(WorkflowAction.Return);
        step.Remarks.Should().Be("please fix the budget head");
    }

    [Fact]
    public async Task ReturnIsPermittedOnlyWhereCanReturnIs()
    {
        // Task A2: ReturnAsync is gated on CanReturn, not CanReject. This route's
        // Assigned stage has neither flag set, so Return from there must still be
        // refused -- Assigned is not a decision stage under either gate.
        var db = CreateDb();
        var definition = RouteWithReentry(resubmitEntrySequence: 2);
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned; // CanReturn = false here
        await db.SaveChangesAsync();

        var act = () => engine.ReturnAsync(instance.Id, ActorId, Dean, "no");

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    [Fact]
    public async Task ReturnRequiresTheStagesRole()
    {
        var (engine, instance, _) = await RaisedAtDecisionStageAsync(2);

        var act = () => engine.ReturnAsync(instance.Id, ActorId, Office, "not a dean");

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    /// <summary>Raised -> Assigned -> BranchStage (off the main line, no roles)
    /// -> ForwardedDR (can reject). Assigned's ordinary Forward must reach
    /// ForwardedDR directly; BranchStage is reachable only by an explicit
    /// jump (as Return's ResubmitEntrySequence performs), and its own Forward
    /// rejoins via ForwardOverrideSequence rather than "next by sequence".</summary>
    private static WorkflowDefinition RouteWithBranchStage()
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            Phase = WorkflowPhase.Indent,
            Name = "Route with a branch stage",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            ResubmitEntrySequence = 4,
        };

        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 2, Stage = WorkflowStage.Assigned, AllowedRoles = "RegularStaff",
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 3, Stage = WorkflowStage.ForwardedDR,
            AllowedRoles = "Dean", CanApprove = true, CanReject = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 4, Stage = WorkflowStage.SignedCopyUploaded, AllowedRoles = "",
            ForwardOverrideSequence = 2, // rejoins at Assigned, not sequence 5 (which does not exist)
        });

        return definition;
    }

    [Fact]
    public async Task ForwardingOutOfABranchStage_UsesTheOverride_NotNextBySequence()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithBranchStage());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
        await db.SaveChangesAsync();

        await engine.ForwardAsync(instance.Id, ActorId, [], "resubmitted");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Assigned);
    }

    [Fact]
    public async Task TheBranchStageIsNeverReachedByOrdinaryForward()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithBranchStage());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        await engine.ForwardAsync(instance.Id, ActorId, Office, null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.ForwardedDR, "Assigned's next-by-sequence neighbour, not the branch stage");
    }

    [Fact]
    public async Task TheShippedRouteIsUnaffectedByReturn()
    {
        // Regression: every route seeded before Phase 9 has no
        // ResubmitEntrySequence, and a Dean at ForwardedDR (the seeded route's
        // decision stage) returning an instance lands it back at Raised --
        // exactly what "restart at step 1" already meant before Return existed.
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);

        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.ForwardedDR;
        await db.SaveChangesAsync();

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "resubmit please");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Raised);
    }

    /// <summary>Raised -> Assigned (CanReturn=true) -> ForwardedDR
    /// (CanApprove/CanReject/CanReturn) -> BranchStage (ResubmitEntrySequence
    /// target, ForwardOverrideSequence=2 by default, but WITH a return-origin
    /// exception routing an Assigned-originated return to sequence 3 instead
    /// of the default 2). Mirrors the shape of ResearchProposalWorkflowSeeder's
    /// WithHOD/ReturnedToPI pair, but with generic stage names so this test
    /// does not depend on the real Proposal route.</summary>
    private static WorkflowDefinition RouteWithReturnOriginException()
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            Phase = WorkflowPhase.Indent,
            Name = "Route with a return-origin exception",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            ResubmitEntrySequence = 4,
        };

        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 2, Stage = WorkflowStage.Assigned, AllowedRoles = "RegularStaff", CanReturn = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 3, Stage = WorkflowStage.ForwardedDR,
            AllowedRoles = "Dean", CanApprove = true, CanReject = true, CanReturn = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definition.Id,
            Sequence = 4, Stage = WorkflowStage.SignedCopyUploaded, AllowedRoles = "",
            ForwardOverrideSequence = 2, // default rejoin: Assigned
            ForwardOverrideSequenceByReturnOrigin = "Assigned:3", // EXCEPT when Assigned itself returned it -- then rejoin at ForwardedDR
        });

        return definition;
    }

    [Fact]
    public async Task ReturnFromAssigned_RecordsAssignedAsTheReturnOrigin()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithReturnOriginException());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        await engine.ReturnAsync(instance.Id, ActorId, ["RegularStaff"], "needs rework");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.SignedCopyUploaded, "the route's ResubmitEntrySequence");
        reloaded.ReturnedFromStage.Should().Be(WorkflowStage.Assigned);
    }

    [Fact]
    public async Task ForwardOutOfBranchStage_UsesTheReturnOriginException_NotTheDefaultOverride()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithReturnOriginException());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();
        await engine.ReturnAsync(instance.Id, ActorId, ["RegularStaff"], "needs rework");

        await engine.ForwardAsync(instance.Id, ActorId, [], "resubmitted");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.ForwardedDR, "the Assigned-origin exception (sequence 3), not the default ForwardOverrideSequence (2)");
        reloaded.ReturnedFromStage.Should().BeNull("consumed once the branch stage's Forward resolves");
    }

    [Fact]
    public async Task ForwardOutOfBranchStage_WithNoMatchingReturnOriginException_UsesTheDefaultOverride()
    {
        // Same route, but reached via ForwardedDR's own Return instead of
        // Assigned's -- ForwardedDR has no entry in the exception map, so the
        // stage's plain ForwardOverrideSequence (2) applies, unchanged.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithReturnOriginException());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.ForwardedDR;
        await db.SaveChangesAsync();
        await engine.ReturnAsync(instance.Id, ActorId, Dean, "needs rework");

        await engine.ForwardAsync(instance.Id, ActorId, [], "resubmitted");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Assigned, "ForwardedDR has no return-origin exception, so the default ForwardOverrideSequence applies");
    }

    [Fact]
    public async Task UndoLastActionAsync_UndoingAReturn_ClearsReturnedFromStage()
    {
        // ReturnedFromStage's invariant is "only ever non-null while genuinely
        // sitting on a branch stage a Return produced". Undoing the very
        // Return that set it must restore that invariant, not leave the
        // instance back at the origin stage with a stale ReturnedFromStage.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(RouteWithReturnOriginException());
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        await engine.ReturnAsync(instance.Id, ActorId, ["RegularStaff"], "needs rework");

        var afterReturn = await engine.GetAsync(instance.Id);
        afterReturn!.ReturnedFromStage.Should().Be(WorkflowStage.Assigned, "the Return just recorded its origin");

        await engine.UndoLastActionAsync(instance.Id, ActorId);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Raised, "undo reverts to the stage the Raise step recorded (the step before Return)");
        reloaded.ReturnedFromStage.Should().BeNull("undoing the Return unwinds the very step that set it");
    }

    [Fact]
    public async Task ReturnAsync_OnIndentRoute_StillPermittedWhereCanRejectWasTrue()
    {
        // Regression guard: A2 must not narrow any route except Research
        // Proposal's. This mirrors whatever stage/role combination the
        // Indent (Consumable) route's WorkflowDefinitionSeeder already marks
        // CanReject=true for (ForwardedDR, "Dean,Director"), confirming
        // CanReturn was backfilled to match.
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);

        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.ForwardedDR;
        await db.SaveChangesAsync();

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "resubmit please");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Raised);
    }
}
