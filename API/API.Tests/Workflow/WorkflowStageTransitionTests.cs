using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

public class WorkflowStageTransitionTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private static readonly Guid RequestId = Guid.NewGuid();

    private static (WorkflowEngineService Engine, TestDbContext Db) CreateEngine()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestDbContext(options);
        // Consumable/Equipment/Contingency/DynamicIndent route through
        // IndentWithHOD (see WorkflowEngineService.UploadSignedCopyAsync),
        // which only IndentWorkflowSeeder's route contains -- the unseeded
        // fallback (WorkflowDefinitionSeeder.BuildShippedRoute) does not.
        IndentWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        return (new WorkflowEngineService(db), db);
    }

    [Fact]
    public async Task RaiseAsync_CreatesInstanceAtRaisedStage()
    {
        var (engine, _) = CreateEngine();

        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        // IndentWorkflowSeeder's route (seeded by CreateEngine) has
        // IndentRaised, not the generic route's Raised, as its initial stage.
        instance.CurrentStage.Should().Be(WorkflowStage.IndentRaised);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
    }

    [Fact]
    public async Task FullHappyPath_Consumable_ReachesApproved()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        // Full IndentWorkflowSeeder chain: IndentRaised -> IndentWithHOD ->
        // IndentWithRnCOffice -> IndentAssignedToDA -> IndentWithSuperintendent
        // -> IndentWithDeputyRegistrar -> IndentWithDean -> Director -> Approved.
        // Office (RegularStaff, Superintendent, DeputyRegistrar) covers every
        // one of those office-chain roles.
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, Raiser, null);
        await engine.ForwardAsync(instance.Id, ActorId, Hod, "HOD verification complete.");         // -> IndentWithRnCOffice
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);                // stays at IndentWithRnCOffice
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                               // -> IndentAssignedToDA
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                               // -> IndentWithSuperintendent
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);                 // stays at IndentWithSuperintendent
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                               // -> IndentWithDeputyRegistrar
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                               // -> IndentWithDean
        await engine.ApproveAsync(instance.Id, ActorId, Dean, "looks good");                          // -> Director (no matching Indent row, so the <=1L short-circuit never applies)
        await engine.ApproveAsync(instance.Id, ActorId, Director, "looks good");                      // -> IndentApproved (the indent route's own terminal, not the generic Approved)

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.IndentApproved);
        reloaded.Steps.Should().HaveCount(11);
    }

    [Fact]
    public async Task AssignAsync_BeforeSignedCopyUploaded_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        var act = () => engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*IndentRaised*");
    }

    [Fact]
    public async Task ApproveAsync_BeforeForwardedDR_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, Raiser, null);
        await engine.ForwardAsync(instance.Id, ActorId, Hod, "HOD verification complete.");
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);

        var act = () => engine.ApproveAsync(instance.Id, ActorId, Dean, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    /// <summary>
    /// ForwardToDirector moved an instance to the Director stage, but nothing
    /// led out of it: Approve and Reject both required ForwardedDR, and Director
    /// was not in the forward chain. An instance the Dean escalated was stuck
    /// there permanently, with Cancel the only remaining action.
    /// </summary>
    [Fact]
    public async Task ApproveAsync_FromDirectorStage_ReachesApproved()
    {
        var (engine, _) = CreateEngine();
        var instance = await RaiseAndEscalateToDirectorAsync(engine);

        await engine.ApproveAsync(instance.Id, ActorId, Director, "approved by the Director");

        var reloaded = await engine.GetAsync(instance.Id);
        // IndentApproved is the indent route's own terminal-approved stage,
        // not the generic Approved (see ApproveAsync's own comment).
        reloaded!.CurrentStage.Should().Be(WorkflowStage.IndentApproved);
    }

    [Fact]
    public async Task RejectAsync_FromDirectorStage_ReachesRejected()
    {
        var (engine, _) = CreateEngine();
        var instance = await RaiseAndEscalateToDirectorAsync(engine);

        await engine.RejectAsync(instance.Id, ActorId, Director, "rejected by the Director");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Rejected);
    }

    private static async Task<WorkflowInstance> RaiseAndEscalateToDirectorAsync(WorkflowEngineService engine)
    {
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, Raiser, null);
        await engine.ForwardAsync(instance.Id, ActorId, Hod, "HOD verification complete.");   // -> IndentWithRnCOffice
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);          // stays at IndentWithRnCOffice
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentAssignedToDA
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithSuperintendent
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithDeputyRegistrar
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithDean
        await engine.ForwardToDirectorAsync(instance.Id, ActorId, Dean, null);
        return instance;
    }

    [Fact]
    public async Task AssignAndForwardAsync_FromWithRnCOffice_SetsAssigneeAndAdvancesToAssignedToDealingAssistant()
    {
        var (engine, db) = CreateEngine();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        var instance = await RaiseProposalAtWithRnCOfficeAsync(engine);
        var assignee = Guid.NewGuid();

        await engine.AssignAndForwardAsync(instance.Id, assignee, ActorId, Office, "assigning to Harshit");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.AssignedToDealingAssistant);
        reloaded.AssignedToUserId.Should().Be(assignee);
    }

    [Fact]
    public async Task AssignAndForwardAsync_ByNonOfficeRole_Throws()
    {
        var (engine, db) = CreateEngine();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        var instance = await RaiseProposalAtWithRnCOfficeAsync(engine);

        var act = () => engine.AssignAndForwardAsync(instance.Id, Guid.NewGuid(), ActorId, Raiser, null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task ForwardAsync_AtAssignedToDealingAssistant_ByTheAssignedUser_Succeeds()
    {
        var (engine, db) = CreateEngine();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        var instance = await RaiseProposalAtWithRnCOfficeAsync(engine);
        var assignee = Guid.NewGuid();
        await engine.AssignAndForwardAsync(instance.Id, assignee, ActorId, Office, null);

        await engine.ForwardAsync(instance.Id, assignee, Office, "reviewed, forwarding on");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.WithSuperintendent);
    }

    [Fact]
    public async Task ForwardAsync_AtAssignedToDealingAssistant_ByADifferentRegularStaffAccount_Throws()
    {
        // The whole point of assignment: once a specific person picks this up,
        // another RegularStaff account -- who would otherwise pass the stage's
        // plain role check -- must not also be able to act on it.
        var (engine, db) = CreateEngine();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        var instance = await RaiseProposalAtWithRnCOfficeAsync(engine);
        var assignee = Guid.NewGuid();
        await engine.AssignAndForwardAsync(instance.Id, assignee, ActorId, Office, null);

        var someoneElse = Guid.NewGuid();
        var act = () => engine.ForwardAsync(instance.Id, someoneElse, ["RegularStaff"], null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task ForwardAsync_AtAssignedToDealingAssistant_BySuperintendent_StillSucceeds()
    {
        // Superintendent/DeputyRegistrar/Dean sit above the Dealing Assistant in
        // the chain and must retain the ability to act regardless of who the
        // proposal is assigned to -- assignment narrows RegularStaff, not the
        // office's own oversight roles.
        var (engine, db) = CreateEngine();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        var instance = await RaiseProposalAtWithRnCOfficeAsync(engine);
        await engine.AssignAndForwardAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);

        await engine.ForwardAsync(instance.Id, ActorId, ["Superintendent"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.WithSuperintendent);
    }

    private static async Task<WorkflowInstance> RaiseProposalAtWithRnCOfficeAsync(WorkflowEngineService engine)
    {
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.ForwardAsync(instance.Id, ActorId, Raiser, "submitting");   // Draft -> WithHOD (PI's own stage)
        await engine.ForwardAsync(instance.Id, ActorId, ["HOD"], "forwarding"); // WithHOD -> WithRnCOffice
        return instance;
    }

    [Fact]
    public async Task CancelAsync_FromForwarded_MovesToCancelled()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Travel, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, Raiser, null);
        // Raiser carries no Faculty role, so Travel uploads land on
        // WithPITravel first (see WorkflowEngineService.UploadSignedCopyAsync);
        // only Forward is valid there.
        await engine.ForwardAsync(instance.Id, ActorId, Hod, "PI review complete.");
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Hod, null);
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);

        await engine.CancelAsync(instance.Id, ActorId, Raiser, "no longer needed");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Cancelled);
    }

    [Fact]
    public async Task CancelAsync_AfterApproved_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, Raiser, null);
        await engine.ForwardAsync(instance.Id, ActorId, Hod, "HOD verification complete.");   // -> IndentWithRnCOffice
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Office, null);          // stays at IndentWithRnCOffice
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentAssignedToDA
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithSuperintendent
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithDeputyRegistrar
        await engine.ForwardAsync(instance.Id, ActorId, Office, null);                        // -> IndentWithDean
        await engine.ApproveAsync(instance.Id, ActorId, Dean, null);                          // -> Director
        await engine.ApproveAsync(instance.Id, ActorId, Director, null);                     // -> IndentApproved

        var act = () => engine.CancelAsync(instance.Id, ActorId, Raiser, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }
}
