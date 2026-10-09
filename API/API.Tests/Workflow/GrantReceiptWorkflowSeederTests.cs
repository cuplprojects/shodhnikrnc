using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The grant receipt route's topology is load-bearing: WorkflowEngineService
/// resolves "next" strictly by sequence, so where the branch and terminal
/// stages sit is behaviour, not decoration. This route now mirrors Research
/// Proposal's depth: PI -> HOD -> DA -> Superintendent -> DeputyRegistrar ->
/// Dean, each office hop a single-role stage (not RnC Office's old combined
/// multi-role stage).
/// </summary>
public class GrantReceiptWorkflowSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task SeedAsync_RunTwice_ExactlyOneDefinitionWithNineStagesInOrder()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var definitions = await db.WorkflowDefinitions
            .Where(d => d.RequestType == RequestType.GrantReceipt)
            .Include(d => d.Stages)
            .ToListAsync();

        definitions.Should().ContainSingle();
        var stages = definitions[0].Stages.OrderBy(s => s.Sequence).ToList();
        stages.Should().HaveCount(9);

        stages[0].Stage.Should().Be(WorkflowStage.Draft);
        stages[0].IsInitial.Should().BeTrue();

        stages[1].Stage.Should().Be(WorkflowStage.WithHODGrantReceipt);
        stages[1].AllowedRoles.Should().Be("HOD");
        stages[1].CanReject.Should().BeFalse();
        stages[1].CanReturn.Should().BeFalse();

        stages[2].Stage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);
        stages[2].AllowedRoles.Should().Be("RegularStaff");
        stages[2].CanReject.Should().BeTrue();
        stages[2].CanReturn.Should().BeTrue();

        stages[3].Stage.Should().Be(WorkflowStage.WithSuperintendentGrantReceipt);
        stages[3].AllowedRoles.Should().Be("Superintendent");
        stages[3].CanReject.Should().BeTrue();
        stages[3].CanReturn.Should().BeTrue();

        stages[4].Stage.Should().Be(WorkflowStage.WithDeputyRegistrarGrantReceipt);
        stages[4].AllowedRoles.Should().Be("DeputyRegistrar");
        stages[4].CanReject.Should().BeTrue();
        stages[4].CanReturn.Should().BeTrue();

        stages[5].Stage.Should().Be(WorkflowStage.WithDeanGrantReceipt);
        stages[5].AllowedRoles.Should().Be("Dean,Director");
        stages[5].CanApprove.Should().BeTrue();
        stages[5].CanReject.Should().BeTrue();
        stages[5].CanReturn.Should().BeTrue();

        stages[6].Stage.Should().Be(WorkflowStage.Approved);
        stages[6].IsTerminal.Should().BeTrue();
        stages[7].Stage.Should().Be(WorkflowStage.Rejected);
        stages[7].IsTerminal.Should().BeTrue();
        stages[8].Stage.Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);
        stages[8].ForwardOverrideSequence.Should().Be(2);

        // Only the Dean stage approves -- ApproveGrantReceiptAsync's own
        // "only ONE CanApprove stage" assumption depends on this.
        stages.Count(s => s.CanApprove).Should().Be(1);

        definitions[0].ResubmitEntrySequence.Should().Be(9);
    }

    [Fact]
    public async Task WorkflowDefinitionSeeder_DoesNotGiveGrantReceiptTheGenericOfficeEscalation()
    {
        // Regression guard for the exact bug the Advertisement plan's Task 2
        // review caught: WorkflowDefinitionSeeder runs first in DbSeeder.cs, so
        // if RequestType.GrantReceipt is not excluded from its generic fallback,
        // that route wins silently and permanently.
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.GrantReceipt && d.Phase == WorkflowPhase.Indent);

        definition.Stages.Select(s => s.Stage).Should().NotContain(WorkflowStage.SignedCopyUploaded,
            "that stage belongs to the generic office-escalation route, not this one");
        definition.Stages.Should().HaveCount(9);
    }

    [Fact]
    public async Task ExistingDefinition_WithOldSevenStageShape_RebuildsToNineStages()
    {
        // Simulates a pre-existing GrantReceipt definition seeded under the OLD
        // 7-stage route (before this plan). SeedAsync must detect the shape
        // mismatch and rebuild, not silently skip the new sequence numbers --
        // the old patch-in-place loop's `if (existingStage is null) continue;`
        // would otherwise leave sequences 3 onward as stale WithRnCOfficeGrantReceipt/
        // WithDeanGrantReceipt/Approved/Rejected/ReturnedToPIGrantReceipt rows at
        // their OLD sequence numbers, never inserting the three new stages.
        var db = CreateDb();
        var definition = new API.Domain.Entities.WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.GrantReceipt,
            Phase = WorkflowPhase.Indent,
            Name = "Grant Receipt Approval",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            ResubmitEntrySequence = 7,
        };
        var oldRoute = new (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[]
        {
            (1, WorkflowStage.Draft, "", false, false, false, null),
            (2, WorkflowStage.WithHODGrantReceipt, "HOD", false, false, false, null),
            (3, WorkflowStage.WithRnCOfficeGrantReceipt, "RegularStaff,Superintendent,DeputyRegistrar,Dean", false, true, true, null),
            (4, WorkflowStage.WithDeanGrantReceipt, "Dean,Director", true, true, true, null),
            (5, WorkflowStage.Approved, "", false, false, false, null),
            (6, WorkflowStage.Rejected, "", false, false, false, null),
            (7, WorkflowStage.ReturnedToPIGrantReceipt, "", false, false, false, 2),
        };
        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in oldRoute)
        {
            definition.Stages.Add(new API.Domain.Entities.WorkflowStageDefinition
            {
                Id = Guid.NewGuid(),
                WorkflowDefinitionId = definition.Id,
                Sequence = sequence,
                Stage = stage,
                AllowedRoles = roles,
                IsInitial = sequence == 1,
                IsTerminal = stage is WorkflowStage.Approved or WorkflowStage.Rejected,
                CanApprove = canApprove,
                CanReject = canReject,
                CanReturn = canReturn,
                ForwardOverrideSequence = forwardOverrideSequence,
            });
        }
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();

        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var reloaded = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.GrantReceipt && d.Phase == WorkflowPhase.Indent);
        var stages = reloaded.Stages.OrderBy(s => s.Sequence).Select(s => s.Stage).ToList();
        stages.Should().Equal(
            WorkflowStage.Draft,
            WorkflowStage.WithHODGrantReceipt,
            WorkflowStage.AssignedToDAGrantReceipt,
            WorkflowStage.WithSuperintendentGrantReceipt,
            WorkflowStage.WithDeputyRegistrarGrantReceipt,
            WorkflowStage.WithDeanGrantReceipt,
            WorkflowStage.Approved,
            WorkflowStage.Rejected,
            WorkflowStage.ReturnedToPIGrantReceipt);
        reloaded.ResubmitEntrySequence.Should().Be(9);
    }

    [Fact]
    public async Task RaiseAsync_UsesTheRoutesInitialStage_ReusingDraftIsSafe()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);

        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, Guid.NewGuid(), WorkflowPhase.Indent, Guid.NewGuid());

        instance.CurrentStage.Should().Be(WorkflowStage.Draft);
    }

    [Fact]
    public async Task ForwardingWalksPiToHodToDaToSuperintendentToDeputyRegistrarToDean()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var actorId = Guid.NewGuid();

        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, Guid.NewGuid(), WorkflowPhase.Indent, actorId);
        instance.CurrentStage.Should().Be(WorkflowStage.Draft);

        await engine.ForwardAsync(instance.Id, actorId, [], "submitting");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);

        await engine.ForwardAsync(instance.Id, actorId, ["HOD"], "forwarding");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);

        await engine.ForwardAsync(instance.Id, actorId, ["RegularStaff"], "forwarding");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithSuperintendentGrantReceipt);

        await engine.ForwardAsync(instance.Id, actorId, ["Superintendent"], "forwarding");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithDeputyRegistrarGrantReceipt);

        await engine.ForwardAsync(instance.Id, actorId, ["DeputyRegistrar"], "forwarding");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithDeanGrantReceipt);
    }

    [Fact]
    public async Task ApprovingAtTheDeanLandsOnTheRoutesOwnApprovedStage()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var actorId = Guid.NewGuid();

        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, Guid.NewGuid(), WorkflowPhase.Indent, actorId);
        await engine.ForwardAsync(instance.Id, actorId, [], "submitting");
        await engine.ForwardAsync(instance.Id, actorId, ["HOD"], "forwarding");
        await engine.ForwardAsync(instance.Id, actorId, ["RegularStaff"], "forwarding");
        await engine.ForwardAsync(instance.Id, actorId, ["Superintendent"], "forwarding");
        await engine.ForwardAsync(instance.Id, actorId, ["DeputyRegistrar"], "forwarding");

        await engine.ApproveAsync(instance.Id, actorId, ["Dean"], "approved");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);

        var approvedStage = await new WorkflowDefinitionService(db)
            .GetStageAsync(RequestType.GrantReceipt, WorkflowPhase.Indent, WorkflowStage.Approved);
        approvedStage.IsTerminal.Should().BeTrue();
    }

    [Fact]
    public async Task RejectingAtTheDaStageLandsOnTheRoutesOwnRejectedStage()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var actorId = Guid.NewGuid();

        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, Guid.NewGuid(), WorkflowPhase.Indent, actorId);
        await engine.ForwardAsync(instance.Id, actorId, [], "submitting");
        await engine.ForwardAsync(instance.Id, actorId, ["HOD"], "forwarding");

        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);

        await engine.RejectAsync(instance.Id, actorId, ["RegularStaff"], "not a valid receipt");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Rejected);

        var rejectedStage = await new WorkflowDefinitionService(db)
            .GetStageAsync(RequestType.GrantReceipt, WorkflowPhase.Indent, WorkflowStage.Rejected);
        rejectedStage.IsTerminal.Should().BeTrue();
        rejectedStage.AllowedRoleList().Should().BeEmpty();
    }

    [Fact]
    public async Task ReturningFromAnyOfficeStageReentersAtReturnedToPi_AndForwardingBackGoesToHod()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var actorId = Guid.NewGuid();

        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, Guid.NewGuid(), WorkflowPhase.Indent, actorId);
        await engine.ForwardAsync(instance.Id, actorId, [], "submitting");
        await engine.ForwardAsync(instance.Id, actorId, ["HOD"], "forwarding");
        await engine.ForwardAsync(instance.Id, actorId, ["RegularStaff"], "forwarding");

        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithSuperintendentGrantReceipt);

        await engine.ReturnAsync(instance.Id, actorId, ["Superintendent"], "please correct the amount");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);

        await engine.ForwardAsync(instance.Id, actorId, [], "resubmitted");
        (await engine.GetAsync(instance.Id))!.CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    [Fact]
    public async Task ReturnedToPiIsNotOnTheOrdinaryForwardPath()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var dean = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithDeanGrantReceipt);
        var approved = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.Approved);

        approved.Sequence.Should().Be(dean.Sequence + 1,
            "the Dean's ordinary Approve must land directly on Approved, not ReturnedToPIGrantReceipt");
    }

    [Fact]
    public async Task ResubmitEntersAtTheReturnedToPiStage()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.GrantReceipt);
        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPIGrantReceipt);

        definition.ResubmitEntrySequence.Should().Be(returnedToPi.Sequence);
    }

    [Fact]
    public async Task TheGenericSeederDoesNotClaimTheGrantReceiptRouteFirst()
    {
        var db = CreateDb();

        await WorkflowDefinitionSeeder.SeedAsync(db);
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.GrantReceipt
                           && d.Phase == WorkflowPhase.Indent);

        definition.Stages.OrderBy(s => s.Sequence).Select(s => s.Stage).Should().Equal(
            WorkflowStage.Draft,
            WorkflowStage.WithHODGrantReceipt,
            WorkflowStage.AssignedToDAGrantReceipt,
            WorkflowStage.WithSuperintendentGrantReceipt,
            WorkflowStage.WithDeputyRegistrarGrantReceipt,
            WorkflowStage.WithDeanGrantReceipt,
            WorkflowStage.Approved,
            WorkflowStage.Rejected,
            WorkflowStage.ReturnedToPIGrantReceipt);

        definition.ResubmitEntrySequence.Should().Be(GrantReceiptWorkflowSeeder.ResubmitEntrySequence);
        definition.ResubmitEntrySequence.Should().Be(9);
    }

    [Fact]
    public async Task ThisRouteIsValidByPhase7sOwnRules()
    {
        var db = CreateDb();
        await GrantReceiptWorkflowSeeder.SeedAsync(db);
        var stages = await db.WorkflowStageDefinitions.ToListAsync();
        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.GrantReceipt && d.Phase == WorkflowPhase.Indent);

        var errors = await new WorkflowDefinitionValidator(db, new AllRolesKnown())
            .ValidateAsync(RequestType.GrantReceipt, WorkflowPhase.Indent, stages, definition.ResubmitEntrySequence);

        errors.Should().BeEmpty();
    }

    private sealed class AllRolesKnown : IWorkflowRoleCatalogue
    {
        public Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<string>>(
                ["HOD", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "Director"]);
    }
}
