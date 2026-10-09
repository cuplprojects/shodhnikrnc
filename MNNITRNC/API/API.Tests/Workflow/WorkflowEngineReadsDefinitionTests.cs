using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

/// <summary>
/// The engine must actually consult the stored route, not merely compile
/// against it. Every test here configures a route that differs from the shipped
/// one and asserts the engine follows the difference -- a test using the shipped
/// route would pass identically against the old hardcoded chain and prove
/// nothing.
/// </summary>
public class WorkflowEngineReadsDefinitionTests
{
    private static readonly Guid ActorId = Guid.NewGuid();

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    /// <summary>A deliberately short route: Raised, then straight to a decision.</summary>
    private static WorkflowDefinition ShortRoute(RequestType requestType, WorkflowPhase phase)
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = requestType,
            Phase = phase,
            Name = "Short route",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(),
            WorkflowDefinitionId = definition.Id,
            Sequence = 1,
            Stage = WorkflowStage.Raised,
            AllowedRoles = "",
            IsInitial = true,
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(),
            WorkflowDefinitionId = definition.Id,
            Sequence = 2,
            Stage = WorkflowStage.Assigned,
            AllowedRoles = "RegularStaff",
        });
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(),
            WorkflowDefinitionId = definition.Id,
            Sequence = 3,
            Stage = WorkflowStage.ForwardedDR,
            AllowedRoles = "Dean",
            CanApprove = true,
            CanReject = true,
        });

        return definition;
    }

    [Fact]
    public async Task ForwardFollowsTheConfiguredSequence_NotTheOldHardcodedChain()
    {
        // The shipped chain goes Assigned -> Forwarded. This route skips
        // Forwarded and ForwardedOSRC entirely, so a single Forward from
        // Assigned must land on ForwardedDR.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(ShortRoute(RequestType.Consumable, WorkflowPhase.Indent));
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);

        // Move to Assigned the way the route allows.
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        await engine.ForwardAsync(instance.Id, ActorId, Office, null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.ForwardedDR);
    }

    [Fact]
    public async Task ApproveIsPermittedWhereTheRouteSaysSo()
    {
        // Under the shipped route, approving from Assigned throws. Here Assigned
        // is configured to conclude, so it must succeed.
        //
        // ApproveAsync now walks to the route's next sequenced stage rather
        // than always landing on Approved directly (needed for fellowship's
        // multi-hop PI -> HOD -> Dean chain) -- ShortRoute's ForwardedDR stage
        // is removed here so Assigned really is the last stage in this route,
        // matching "Assigned is configured to conclude" rather than having it
        // silently walk on to ForwardedDR.
        var db = CreateDb();
        var definition = ShortRoute(RequestType.Travel, WorkflowPhase.Indent);
        definition.Stages.Single(s => s.Stage == WorkflowStage.Assigned).CanApprove = true;
        definition.Stages.Remove(definition.Stages.Single(s => s.Stage == WorkflowStage.ForwardedDR));
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Travel, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        await engine.ApproveAsync(instance.Id, ActorId, ["RegularStaff"], "approved early");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task ApproveIsRefusedWhereTheRouteDoesNotPermitIt()
    {
        var db = CreateDb();
        db.WorkflowDefinitions.Add(ShortRoute(RequestType.Contingency, WorkflowPhase.Indent));
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Contingency, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.Assigned;
        await db.SaveChangesAsync();

        var act = () => engine.ApproveAsync(instance.Id, ActorId, Dean, null);

        // The message names where approval is possible, read off the route.
        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*ForwardedDR*");
    }

    [Fact]
    public async Task ForwardFromAConcludingStageIsRefused()
    {
        // ForwardedDR concludes, so there is nowhere to forward to -- previously
        // expressed by its absence from the ForwardChain dictionary.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(ShortRoute(RequestType.Equipment, WorkflowPhase.Indent));
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Equipment, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = WorkflowStage.ForwardedDR;
        await db.SaveChangesAsync();

        var act = () => engine.ForwardAsync(instance.Id, ActorId, Office, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    [Fact]
    public async Task AnInstanceOnAStageMissingFromItsRouteFailsLoudly()
    {
        // A SuperAdmin can remove a stage while instances sit on it. The
        // instance must report the problem rather than stall.
        var db = CreateDb();
        db.WorkflowDefinitions.Add(ShortRoute(RequestType.Consumable, WorkflowPhase.Indent));
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);

        // ForwardedOSRC is not in this route at all.
        instance.CurrentStage = WorkflowStage.ForwardedOSRC;
        await db.SaveChangesAsync();

        var act = () => engine.ForwardAsync(instance.Id, ActorId, Office, null);

        await act.Should().ThrowAsync<WorkflowConfigurationException>()
            .WithMessage("*ForwardedOSRC*");
    }

    [Fact]
    public async Task RaiseAsyncLandsAtTheRoutesInitialStage_NotHardcodedRaised()
    {
        // RaiseAsync used to hardcode CurrentStage = WorkflowStage.Raised
        // regardless of the route's IsInitial stage. Latent since Phase 7:
        // every route until the research proposal chain (Phase 9) happened to
        // use Raised as its first stage, so nothing exposed that RaiseAsync
        // never actually consulted the route. Assigned is deliberately not
        // Raised, to prove this reads the data rather than a hardcoded value.
        var db = CreateDb();
        var definition = ShortRoute(RequestType.Consumable, WorkflowPhase.Indent);
        foreach (var stage in definition.Stages)
        {
            stage.IsInitial = stage.Stage == WorkflowStage.Assigned;
        }
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);

        instance.CurrentStage.Should().Be(WorkflowStage.Assigned);
    }
}
