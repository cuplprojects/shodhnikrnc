using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The seeded chain has to match spec §4's table exactly -- it is transcribed
/// from the BRD, not designed, so any divergence here is a transcription bug.
/// </summary>
public class ResearchProposalWorkflowSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<TestDbContext> SeededAsync()
    {
        var db = CreateDb();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        return db;
    }

    [Fact]
    public async Task SeedsExactlyOneDefinitionForResearchProposal()
    {
        var db = await SeededAsync();

        db.WorkflowDefinitions.Should().ContainSingle(
            d => d.RequestType == RequestType.ResearchProposal && d.Phase == WorkflowPhase.Indent);
    }

    [Fact]
    public async Task TheSeedIsIdempotent()
    {
        var db = await SeededAsync();
        var stagesBefore = db.WorkflowStageDefinitions.Count();

        await ResearchProposalWorkflowSeeder.SeedAsync(db);

        db.WorkflowDefinitions.Count(d => d.RequestType == RequestType.ResearchProposal).Should().Be(1);
        db.WorkflowStageDefinitions.Count().Should().Be(stagesBefore);
    }

    [Fact]
    public async Task StageSequenceMatchesTheBrdRoutingLine()
    {
        // PI (prepares) -> HOD (forwards) -> RnC Office -> Dealing Assistant ->
        // Superintendent (checks & verifies) -> DR -> Dean (signs/approves).
        var db = await SeededAsync();

        var stages = await db.WorkflowStageDefinitions
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        // ReturnedToPI is deliberately last: it is a branch stage reachable
        // only via Return's explicit jump, not part of the forward sequence a
        // proposal that is never returned ever passes through.
        stages.Should().Equal(
            WorkflowStage.Draft,
            WorkflowStage.WithHOD,
            WorkflowStage.WithRnCOffice,
            WorkflowStage.AssignedToDealingAssistant,
            WorkflowStage.WithSuperintendent,
            WorkflowStage.WithDeputyRegistrar,
            WorkflowStage.WithDean,
            WorkflowStage.Approved,
            WorkflowStage.ReturnedToPI);
    }

    [Fact]
    public async Task OnlyTheHodStageIsHodScoped()
    {
        var db = await SeededAsync();

        var hodStage = await db.WorkflowStageDefinitions.SingleAsync(s => s.Stage == WorkflowStage.WithHOD);

        hodStage.AllowedRoleList().Should().Equal("HOD");
    }

    [Fact]
    public async Task RejectionIsPossibleAtWithSuperintendentWithDeputyRegistrarAndWithDean()
    {
        var db = await SeededAsync();

        var rejecting = await db.WorkflowStageDefinitions
            .Where(s => s.CanReject)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        rejecting.Should().Equal(
            WorkflowStage.WithSuperintendent,
            WorkflowStage.WithDeputyRegistrar,
            WorkflowStage.WithDean);
    }

    [Fact]
    public async Task ReturnIsPossibleAtWithHODWithSuperintendentWithDeputyRegistrarAndWithDean()
    {
        var db = await SeededAsync();

        var returning = await db.WorkflowStageDefinitions
            .Where(s => s.CanReturn)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        returning.Should().Equal(
            WorkflowStage.WithHOD,
            WorkflowStage.WithSuperintendent,
            WorkflowStage.WithDeputyRegistrar,
            WorkflowStage.WithDean);
    }

    [Fact]
    public async Task WithDeanAllowsBothDeanAndDirector()
    {
        var db = await SeededAsync();

        var deanStage = await db.WorkflowStageDefinitions.SingleAsync(s => s.Stage == WorkflowStage.WithDean);

        deanStage.AllowedRoleList().Should().Equal("Dean", "Director");
    }

    [Fact]
    public async Task OnlyDeanCanApprove()
    {
        var db = await SeededAsync();

        var approving = await db.WorkflowStageDefinitions
            .Where(s => s.CanApprove)
            .Select(s => s.Stage)
            .ToListAsync();

        approving.Should().Equal(WorkflowStage.WithDean);
    }

    [Fact]
    public async Task ResubmitEntersAtThePi_NotTheDealingAssistantDirectly_NotTheDean()
    {
        // BRD: "a resubmitted proposal goes directly to the Dealing Assistant --
        // it must NOT re-enter at the Dean step." Read narrowly this named the
        // Dealing Assistant as the re-entry stage; but that stage only permits
        // RegularStaff, so the PI who owns the proposal could never act on a
        // return at all. ReturnedToPI is the PI's own correction stage --
        // forwarding out of it (still PI-only, mirroring Draft) is what lands
        // on the Dealing Assistant next, preserving "not the Dean" without
        // silently locking the PI out of their own returned proposal.
        var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.ResearchProposal);
        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPI);

        definition.ResubmitEntrySequence.Should().Be(returnedToPi.Sequence);
    }

    [Fact]
    public async Task ReturnedToPiIsThePisOwnStage_NoRoleRequired()
    {
        // Mirrors Draft: empty AllowedRoles means "the owning PI", enforced by
        // IResearchProposalService's ownership check, not a role list.
        var db = await SeededAsync();

        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPI);

        returnedToPi.AllowedRoleList().Should().BeEmpty();
    }

    [Fact]
    public async Task ForwardingOutOfReturnedToPiLandsOnTheDealingAssistant()
    {
        // ReturnedToPI sits off the main sequence, so this is carried by
        // ForwardOverrideSequence rather than sequence adjacency.
        var db = await SeededAsync();

        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPI);
        var dealingAssistant = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.AssignedToDealingAssistant);

        returnedToPi.ForwardOverrideSequence.Should().Be(dealingAssistant.Sequence);
    }

    [Fact]
    public async Task ReturnedToPiIsNotOnTheOrdinaryForwardPath()
    {
        // The happy path (never returned) must not pass through it: it is
        // reachable only via Return's explicit jump to ResubmitEntrySequence.
        var db = await SeededAsync();

        var rnCOffice = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithRnCOffice);
        var dealingAssistant = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.AssignedToDealingAssistant);

        dealingAssistant.Sequence.Should().Be(rnCOffice.Sequence + 1,
            "WithRnCOffice's ordinary Forward must land directly on the Dealing Assistant, not ReturnedToPI");
    }

    [Fact]
    public async Task DraftIsTheOnlyInitialStage()
    {
        var db = await SeededAsync();

        var initial = await db.WorkflowStageDefinitions.Where(s => s.IsInitial).ToListAsync();

        initial.Should().ContainSingle().Which.Stage.Should().Be(WorkflowStage.Draft);
    }

    [Fact]
    public async Task ThisRouteIsValidByPhase7sOwnRules()
    {
        // The seed exists to feed the configurator's validator, so it should
        // pass the same rules a SuperAdmin's edit would be held to.
        var db = await SeededAsync();
        var stages = await db.WorkflowStageDefinitions.ToListAsync();
        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.ResearchProposal && d.Phase == WorkflowPhase.Indent);

        var errors = await new WorkflowDefinitionValidator(db, new AllRolesKnown())
            .ValidateAsync(RequestType.ResearchProposal, WorkflowPhase.Indent, stages, definition.ResubmitEntrySequence);

        errors.Should().BeEmpty();
    }

    private sealed class AllRolesKnown : IWorkflowRoleCatalogue
    {
        public Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<string>>(
                ["HOD", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "Director"]);
    }
}
