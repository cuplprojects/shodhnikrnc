using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The rules that stand between a configurator and a foot-gun. A SuperAdmin can
/// express a route that strands live requests; these refuse it before it is
/// persisted.
/// </summary>
public class WorkflowDefinitionValidatorTests
{
    private static readonly string[] KnownRoles =
        ["Dean", "Director", "RegularStaff", "Superintendent", "DeputyRegistrar", "Faculty"];

    private sealed class FakeRoles(IEnumerable<string> roles) : IWorkflowRoleCatalogue
    {
        private readonly HashSet<string> _roles = new(roles, StringComparer.OrdinalIgnoreCase);
        public Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<string>>(_roles.ToList());
    }

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static WorkflowDefinitionValidator CreateValidator(TestDbContext db) =>
        new(db, new FakeRoles(KnownRoles));

    /// <summary>A valid three-stage route, which each test then breaks in one way.</summary>
    private static List<WorkflowStageDefinition> ValidStages() =>
    [
        new() { Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true },
        new() { Sequence = 2, Stage = WorkflowStage.Assigned, AllowedRoles = "RegularStaff" },
        new() { Sequence = 3, Stage = WorkflowStage.ForwardedDR, AllowedRoles = "Dean", CanApprove = true, CanReject = true, CanReturn = true },
    ];

    private static async Task<IReadOnlyList<string>> ValidateAsync(
        TestDbContext db, List<WorkflowStageDefinition> stages,
        RequestType requestType = RequestType.Consumable, WorkflowPhase phase = WorkflowPhase.Indent) =>
        await CreateValidator(db).ValidateAsync(requestType, phase, stages);

    [Fact]
    public async Task AValidRouteHasNoErrors()
    {
        var db = CreateDb();

        (await ValidateAsync(db, ValidStages())).Should().BeEmpty();
    }

    // Rule 1 -- sequences contiguous from 1.

    [Fact]
    public async Task AGapInTheSequenceIsRejected()
    {
        // Forwarding resolves the next stage by Sequence + 1, so a gap strands
        // an instance mid-route.
        var db = CreateDb();
        var stages = ValidStages();
        stages[2].Sequence = 4;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*contiguous*");
    }

    [Fact]
    public async Task ADuplicateSequenceIsRejected()
    {
        var db = CreateDb();
        var stages = ValidStages();
        stages[2].Sequence = 2;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*contiguous*");
    }

    [Fact]
    public async Task ASequenceNotStartingAtOneIsRejected()
    {
        var db = CreateDb();
        var stages = ValidStages();
        foreach (var s in stages) s.Sequence++;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*contiguous*");
    }

    [Fact]
    public async Task AnEmptyRouteIsRejected()
    {
        var db = CreateDb();

        (await ValidateAsync(db, [])).Should().NotBeEmpty();
    }

    // Rule 2 -- exactly one initial stage.

    [Fact]
    public async Task NoInitialStageIsRejected()
    {
        var db = CreateDb();
        var stages = ValidStages();
        stages[0].IsInitial = false;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*exactly one*initial*");
    }

    [Fact]
    public async Task TwoInitialStagesAreRejected()
    {
        var db = CreateDb();
        var stages = ValidStages();
        stages[1].IsInitial = true;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*exactly one*initial*");
    }

    // Rule 3 -- something must be able to conclude.

    [Fact]
    public async Task ARouteThatCanNeverBeApprovedIsRejected()
    {
        // Without this, every request raised on the route runs to the end and
        // stops there permanently.
        var db = CreateDb();
        var stages = ValidStages();
        stages[2].CanApprove = false;

        (await ValidateAsync(db, stages)).Should().ContainMatch("*approve*");
    }

    // Rule 3b -- if a resubmit entry point is configured, something must be
    // able to return a request for correction, or that entry point can never
    // actually be reached.

    [Fact]
    public async Task ValidateAsync_NoStageCanReturn_ReturnsError()
    {
        // A resubmit entry point is configured (sequence 1), so some stage
        // must be able to reach it via Return.
        var db = CreateDb();
        var validator = CreateValidator(db);
        var stages = new[]
        {
            new WorkflowStageDefinition { Sequence = 1, Stage = WorkflowStage.WithDean, AllowedRoles = "Dean", IsInitial = true, CanApprove = true, CanReject = true, CanReturn = false },
        };

        var errors = await validator.ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, resubmitEntrySequence: 1);

        errors.Should().Contain(e => e.Contains("must be able to return"));
    }

    [Fact]
    public async Task ValidateAsync_OneStageCanReturn_NoReturnError()
    {
        var db = CreateDb();
        var validator = CreateValidator(db);
        var stages = new[]
        {
            new WorkflowStageDefinition { Sequence = 1, Stage = WorkflowStage.WithDean, AllowedRoles = "Dean", IsInitial = true, CanApprove = true, CanReject = true, CanReturn = true },
        };

        var errors = await validator.ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, resubmitEntrySequence: 1);

        errors.Should().NotContain(e => e.Contains("must be able to return"));
    }

    [Fact]
    public async Task ValidateAsync_NoResubmitEntrySequenceAndNoStageCanReturn_NoReturnError()
    {
        // A route with no ResubmitEntrySequence has no resubmission concept
        // at all -- e.g. a simple approve-or-reject chain -- so it must be
        // allowed to save with zero CanReturn stages.
        var db = CreateDb();
        var validator = CreateValidator(db);
        var stages = new[]
        {
            new WorkflowStageDefinition { Sequence = 1, Stage = WorkflowStage.WithDean, AllowedRoles = "Dean", IsInitial = true, CanApprove = true, CanReject = true, CanReturn = false },
        };

        var errors = await validator.ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, resubmitEntrySequence: null);

        errors.Should().NotContain(e => e.Contains("must be able to return"));
    }

    // Rule 3c -- resubmit/forward-override targets must reference real
    // sequences/stages in the route.

    [Fact]
    public async Task ValidateAsync_ForwardOverrideSequenceByReturnOriginPointsAtNonexistentSequence_IsRejected()
    {
        var db = CreateDb();
        var validator = CreateValidator(db);
        var stages = new List<WorkflowStageDefinition>
        {
            new() { Id = Guid.NewGuid(), Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true, CanApprove = true },
            new() { Id = Guid.NewGuid(), Sequence = 2, Stage = WorkflowStage.ReturnedToPI, AllowedRoles = "",
                    ForwardOverrideSequence = 1, ForwardOverrideSequenceByReturnOrigin = "Raised:99" },
        };

        var errors = await validator.ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, resubmitEntrySequence: 2);

        errors.Should().Contain(e => e.Contains("ForwardOverrideSequenceByReturnOrigin") && e.Contains("99"));
    }

    [Fact]
    public async Task ValidateAsync_ForwardOverrideSequenceByReturnOriginKeyedOnStageNotInRoute_IsRejected()
    {
        var db = CreateDb();
        var validator = CreateValidator(db);
        var stages = new List<WorkflowStageDefinition>
        {
            new() { Id = Guid.NewGuid(), Sequence = 1, Stage = WorkflowStage.Raised, AllowedRoles = "", IsInitial = true, CanApprove = true },
            new() { Id = Guid.NewGuid(), Sequence = 2, Stage = WorkflowStage.ReturnedToPI, AllowedRoles = "",
                    ForwardOverrideSequence = 1, ForwardOverrideSequenceByReturnOrigin = "WithDean:1" },
        };

        var errors = await validator.ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, resubmitEntrySequence: 2);

        errors.Should().Contain(e => e.Contains("WithDean") && e.Contains("not a stage in this route"));
    }

    [Fact]
    public void ForwardOverrideSequenceByReturnOriginMap_WithAMalformedStageName_Throws()
    {
        // A typo'd stage name must fail fast, not silently drop the entry from
        // the map -- a dropped entry here would make an HOD return resubmit to
        // the office instead of back through the HOD, with a green test suite.
        var stage = new WorkflowStageDefinition
        {
            Sequence = 1, Stage = WorkflowStage.ReturnedToPI, AllowedRoles = "",
            ForwardOverrideSequenceByReturnOrigin = "NotAStage:2",
        };

        var act = () => stage.ForwardOverrideSequenceByReturnOriginMap();

        act.Should().Throw<Exception>();
    }

    [Fact]
    public void ForwardOverrideSequenceByReturnOriginMap_WithAMalformedSequence_Throws()
    {
        var stage = new WorkflowStageDefinition
        {
            Sequence = 1, Stage = WorkflowStage.ReturnedToPI, AllowedRoles = "",
            ForwardOverrideSequenceByReturnOrigin = "WithHOD:notanumber",
        };

        var act = () => stage.ForwardOverrideSequenceByReturnOriginMap();

        act.Should().Throw<Exception>();
    }

    // Rule 4 -- roles must exist.

    [Fact]
    public async Task AnUnknownRoleIsRejected()
    {
        // A typo here silently locks a stage: no user can ever hold "Deen", so
        // every request would stall there with a 403.
        var db = CreateDb();
        var stages = ValidStages();
        stages[1].AllowedRoles = "Deen";

        (await ValidateAsync(db, stages)).Should().ContainMatch("*Deen*");
    }

    [Fact]
    public async Task AKnownRoleInAnyCaseIsAccepted()
    {
        var db = CreateDb();
        var stages = ValidStages();
        stages[1].AllowedRoles = "regularstaff";

        (await ValidateAsync(db, stages)).Should().BeEmpty();
    }

    // Rule 5 -- do not strand live instances. The operational one.

    [Fact]
    public async Task RemovingAStageThatLiveInstancesSitOnIsRejected()
    {
        var db = CreateDb();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Assigned,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var stages = ValidStages();
        stages.RemoveAt(1);                 // drop Assigned
        stages[1].Sequence = 2;             // keep the sequence contiguous

        var errors = await ValidateAsync(db, stages);

        errors.Should().ContainMatch("*Assigned*");
        // The count is what tells an operator how much is at stake.
        errors.Should().ContainMatch("*1*");
    }

    [Fact]
    public async Task RemovingAStageWithOnlyTerminalInstancesIsAllowed()
    {
        // An approved request is finished; it is not stranded by a route change.
        var db = CreateDb();
        foreach (var stage in new[] { WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled })
        {
            db.WorkflowInstances.Add(new WorkflowInstance
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                RequestId = Guid.NewGuid(),
                Phase = WorkflowPhase.Indent,
                CurrentStage = stage,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();

        var stages = ValidStages();
        stages.RemoveAt(1);
        stages[1].Sequence = 2;

        (await ValidateAsync(db, stages)).Should().BeEmpty();
    }

    [Fact]
    public async Task InstancesOfAnotherRequestTypeDoNotBlockTheEdit()
    {
        // Routes are per (RequestType, Phase); a Travel request sitting on
        // Assigned says nothing about the Consumable route.
        var db = CreateDb();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Travel,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Assigned,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var stages = ValidStages();
        stages.RemoveAt(1);
        stages[1].Sequence = 2;

        (await ValidateAsync(db, stages)).Should().BeEmpty();
    }

    [Fact]
    public async Task KeepingAStageThatLiveInstancesSitOnIsAllowed()
    {
        var db = CreateDb();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Assigned,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        // Reordering and re-roling is fine; the stage still exists.
        var stages = ValidStages();
        stages[1].AllowedRoles = "Dean";

        (await ValidateAsync(db, stages)).Should().BeEmpty();
    }

    [Fact]
    public async Task AllFailuresAreReportedTogether()
    {
        // One round trip should tell an operator everything that is wrong, not
        // make them fix errors one at a time.
        var db = CreateDb();
        var stages = ValidStages();
        stages[0].IsInitial = false;
        stages[1].AllowedRoles = "Nope";
        stages[2].CanApprove = false;

        (await ValidateAsync(db, stages)).Should().HaveCountGreaterThanOrEqualTo(3);
    }
}
