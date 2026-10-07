using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The seeded route must reproduce what the engine hardcodes today, because
/// Phase 7 changes where the route is stored, not what it is. These assert
/// against the engine's own behaviour rather than against a second copy of the
/// table -- a test that restates the seed would agree with any mistake in it.
/// </summary>
public class WorkflowDefinitionSeedTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<TestDbContext> SeededAsync()
    {
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        return db;
    }

    [Fact]
    public async Task EveryRequestTypeGetsAnIndentRoute()
    {
        var db = await SeededAsync();

        // ResearchProposal's route comes from ResearchProposalWorkflowSeeder,
        // not this one -- see ResearchProposalIsNotGivenTheGenericOfficeEscalation.
        // FellowshipClaim's route similarly comes from its own
        // FellowshipWorkflowSeeder, Advertisement's from
        // AdvertisementWorkflowSeeder -- see
        // AdvertisementIsNotGivenTheGenericOfficeEscalation -- and GrantReceipt's
        // from GrantReceiptWorkflowSeeder -- see
        // GrantReceiptIsNotGivenTheGenericOfficeEscalation. This fixture's
        // SeededAsync() runs none of those.
        //
        // Consumable/Equipment/Contingency/DynamicIndent get IndentWorkflowSeeder's
        // own IndentRaised/IndentWithHOD/... route instead (see
        // WorkflowEngineService.UploadSignedCopyAsync's per-RequestType
        // branching); ProjectUpdate/Reappropriation/ScreeningCommittee/
        // SelectionCommittee each have their own dedicated seeder too -- see
        // WorkflowDefinitionSeeder.SeedAsync's own exclusion list, which this
        // test mirrors exactly rather than guessing at it.
        foreach (var requestType in Enum.GetValues<RequestType>()
            .Where(t => t != RequestType.ResearchProposal
                     && t != RequestType.FellowshipClaim
                     && t != RequestType.Advertisement
                     && t != RequestType.GrantReceipt
                     && t != RequestType.Consumable
                     && t != RequestType.Equipment
                     && t != RequestType.Contingency
                     && t != RequestType.DynamicIndent
                     && t != RequestType.ProjectUpdate
                     && t != RequestType.Reappropriation
                     && t != RequestType.ScreeningCommittee
                     && t != RequestType.SelectionCommittee))
        {
            db.WorkflowDefinitions
                .Should().Contain(d => d.RequestType == requestType && d.Phase == WorkflowPhase.Indent,
                    $"{requestType} raises an Indent workflow");
        }
    }

    [Fact]
    public async Task TravelAlsoGetsABillRoute()
    {
        // TravelRequestService raises a second instance for the bill phase.
        // The Bill-phase definition comes from ProcessBillWorkflowSeeder, not
        // WorkflowDefinitionSeeder -- WorkflowDefinitionSeeder.SeedAsync's own
        // "backfill" loop explicitly skips (RequestType.Travel, Phase.Bill)
        // rows rather than creating them (see its own exclusion check).
        var db = await SeededAsync();
        await ProcessBillWorkflowSeeder.SeedAsync(db);

        db.WorkflowDefinitions
            .Should().Contain(d => d.RequestType == RequestType.Travel && d.Phase == WorkflowPhase.Bill);
    }

    [Fact]
    public async Task ResearchProposalIsNotGivenTheGenericOfficeEscalation()
    {
        // ResearchProposal is excluded from this seeder's loop because it has
        // its own eight-stage BRD Prompt 1 chain. Without the exclusion this
        // seeder would silently give it the generic seven-stage route instead
        // -- caught here before ResearchProposalWorkflowSeeder existed to
        // provide the real one.
        var db = await SeededAsync();

        db.WorkflowDefinitions
            .Should().NotContain(d => d.RequestType == RequestType.ResearchProposal);
    }

    [Fact]
    public async Task AdvertisementIsNotGivenTheGenericOfficeEscalation()
    {
        // Advertisement is excluded from this seeder's loop because it has its
        // own five-stage PI -> RnC office -> Computer Centre chain. The
        // exclusion matters more here than for ResearchProposal: DbSeeder runs
        // this seeder first, so a definition created here would still be
        // present when AdvertisementWorkflowSeeder runs, sending it down its
        // "update existing" branch -- which never rewrites Stage, so the
        // generic stage names would stick permanently.
        var db = await SeededAsync();

        db.WorkflowDefinitions
            .Should().NotContain(d => d.RequestType == RequestType.Advertisement);
    }

    [Fact]
    public async Task GrantReceiptIsNotGivenTheGenericOfficeEscalation()
    {
        // GrantReceipt is excluded from this seeder's loop because it has its
        // own seven-stage PI -> HOD -> RnC office -> Dean chain. As with
        // Advertisement, the exclusion matters more than for ResearchProposal:
        // DbSeeder runs this seeder first, so a definition created here would
        // still be present when GrantReceiptWorkflowSeeder runs, sending it
        // down its "update existing" branch -- which never rewrites Stage, so
        // the generic stage names would stick permanently.
        var db = await SeededAsync();

        db.WorkflowDefinitions
            .Should().NotContain(d => d.RequestType == RequestType.GrantReceipt);
    }

    [Fact]
    public async Task TheSeedIsIdempotent()
    {
        var db = await SeededAsync();
        var countAfterFirst = db.WorkflowDefinitions.Count();

        await WorkflowDefinitionSeeder.SeedAsync(db);

        db.WorkflowDefinitions.Count().Should().Be(countAfterFirst);
    }

    [Fact]
    public async Task StageSequenceMatchesTheEnginesForwardChain()
    {
        // Raised -> SignedCopyUploaded -> Assigned -> Forwarded -> ForwardedOSRC
        // -> ForwardedDR, then Director. Any divergence here is a seed bug: the
        // engine will resolve the next stage by Sequence + 1 from Task 5 on.
        //
        // Travel, not Consumable: Consumable/Equipment/Contingency/DynamicIndent
        // are excluded from this seeder's loop (they get IndentWorkflowSeeder's
        // own IndentRaised/IndentWithHOD/... route instead -- see
        // WorkflowEngineService.UploadSignedCopyAsync's per-RequestType
        // branching). Travel is not excluded, so it still gets this generic
        // route for its Indent phase (its own separate Bill-phase route comes
        // from ProcessBillWorkflowSeeder).
        var db = await SeededAsync();

        var stages = await db.WorkflowStageDefinitions
            .Where(s => s.Definition!.RequestType == RequestType.Travel
                     && s.Definition.Phase == WorkflowPhase.Indent)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        stages.Should().Equal(
            WorkflowStage.Raised,
            WorkflowStage.SignedCopyUploaded,
            WorkflowStage.Assigned,
            WorkflowStage.Forwarded,
            WorkflowStage.ForwardedOSRC,
            WorkflowStage.ForwardedDR,
            WorkflowStage.Director);
    }

    [Fact]
    public async Task OnlyTheDecisionStagesCanApprove()
    {
        // ApproveAsync calls RequireStageCanAsync(s => s.CanApprove), and
        // CanApprove is true only at ForwardedDR and Director in ShippedRoute.
        // CanReject, unlike CanApprove, is true at every stage in ShippedRoute
        // (see the class's own remarks on ShippedRoute: "Superintendent and
        // DeputyRegistrar appear on the Reject attribute but cannot reach a
        // stage where the engine permits rejection ... this records what
        // ships, not what the attribute implies") -- RejectAsync's real gate
        // is role-based (AllowedRoles), not stage-based, so this test only
        // checks CanApprove. Travel, not Consumable -- see
        // StageSequenceMatchesTheEnginesForwardChain's own comment.
        var db = await SeededAsync();

        var stages = await db.WorkflowStageDefinitions
            .Where(s => s.Definition!.RequestType == RequestType.Travel
                     && s.Definition.Phase == WorkflowPhase.Indent)
            .OrderBy(s => s.Sequence)
            .ToListAsync();

        stages.Where(s => s.CanApprove).Select(s => s.Stage)
            .Should().Equal(WorkflowStage.ForwardedDR, WorkflowStage.Director);
    }

    [Fact]
    public async Task SeedAsync_NarrowsEachOfficeStageToItsOwnSingleRole()
    {
        // The 2026-09-09 indent-workflow-and-role-scoping plan narrows the four
        // office-escalation stages, which used to share one five-role group
        // (RegularStaff, Superintendent, DeputyRegistrar, HOD, Dean), to the
        // one role actually meant to act at each -- now that the engine reads
        // AllowedRoles per stage from this table rather than a single
        // compile-time [Authorize] attribute that could not distinguish which
        // stage Forward was acting from. Travel, not Consumable -- see
        // StageSequenceMatchesTheEnginesForwardChain's own comment.
        var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.Travel && d.Phase == WorkflowPhase.Indent);

        var stages = definition.Stages.ToDictionary(s => s.Stage);
        stages[WorkflowStage.SignedCopyUploaded].AllowedRoles.Should().Be("HOD");
        stages[WorkflowStage.Assigned].AllowedRoles.Should().Be("RegularStaff");
        stages[WorkflowStage.Forwarded].AllowedRoles.Should().Be("Superintendent");
        stages[WorkflowStage.ForwardedOSRC].AllowedRoles.Should().Be("DeputyRegistrar");
        stages[WorkflowStage.ForwardedDR].AllowedRoles.Should().Be("Dean,Director");
        stages[WorkflowStage.Director].AllowedRoles.Should().Be("Director");
    }

    [Fact]
    public async Task SeedAsync_UpdatesAnExistingDefinitionsRolesToTheNarrowedSet()
    {
        // Simulates a pre-existing DB row seeded under the OLD shared
        // ForwardingRoles group, then confirms SeedAsync's "update existing"
        // reconciliation branch genuinely narrows it on the next run -- not
        // just fresh inserts.
        var db = CreateDb();
        var oldDefinition = WorkflowDefinitionSeeder.BuildShippedRoute(RequestType.Travel, WorkflowPhase.Indent);
        // Manually stamp the OLD shared-role string onto a stage before the
        // fix, to simulate a definition seeded by a pre-fix binary:
        oldDefinition.Stages.First(s => s.Stage == WorkflowStage.Forwarded).AllowedRoles =
            "RegularStaff,Superintendent,DeputyRegistrar,HOD,Dean";
        db.WorkflowDefinitions.Add(oldDefinition);
        await db.SaveChangesAsync();

        await WorkflowDefinitionSeeder.SeedAsync(db);

        var reloaded = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.Travel && d.Phase == WorkflowPhase.Indent);
        reloaded.Stages.Single(s => s.Stage == WorkflowStage.Forwarded).AllowedRoles.Should().Be("Superintendent");
    }

    [Fact]
    public async Task ExactlyOneStageIsInitial()
    {
        // Travel, not Consumable -- see
        // StageSequenceMatchesTheEnginesForwardChain's own comment.
        var db = await SeededAsync();

        var initial = await db.WorkflowStageDefinitions
            .Where(s => s.Definition!.RequestType == RequestType.Travel
                     && s.Definition.Phase == WorkflowPhase.Indent
                     && s.IsInitial)
            .ToListAsync();

        initial.Should().ContainSingle().Which.Stage.Should().Be(WorkflowStage.Raised);
    }
}
