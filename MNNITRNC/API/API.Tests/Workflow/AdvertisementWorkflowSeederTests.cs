using API.Application.Access;
using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// The advertisement route's topology is load-bearing: WorkflowEngineService
/// resolves "next" strictly by sequence, so where the branch and terminal
/// stages sit is behaviour, not decoration.
/// </summary>
public class AdvertisementWorkflowSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<TestDbContext> SeededAsync()
    {
        var db = CreateDb();
        await AdvertisementWorkflowSeeder.SeedAsync(db);
        return db;
    }

    [Fact]
    public async Task SeedsExactlyOneDefinitionForAdvertisement()
    {
        var db = await SeededAsync();

        db.WorkflowDefinitions.Should().ContainSingle(
            d => d.RequestType == RequestType.Advertisement && d.Phase == WorkflowPhase.Indent);
    }

    [Fact]
    public async Task TheSeedIsIdempotent()
    {
        var db = await SeededAsync();
        var stagesBefore = db.WorkflowStageDefinitions.Count();

        await AdvertisementWorkflowSeeder.SeedAsync(db);

        db.WorkflowDefinitions.Count(d => d.RequestType == RequestType.Advertisement).Should().Be(1);
        db.WorkflowStageDefinitions.Count().Should().Be(stagesBefore);
    }

    [Fact]
    public async Task StageSequenceIsPiThenRnCOfficeThenComputerCentre()
    {
        var db = await SeededAsync();

        var stages = await db.WorkflowStageDefinitions
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        // Approved is a real stage because ApproveAsync hardcodes it as the
        // fallback when nothing follows, and Rejected likewise because
        // RejectAsync hardcodes it; ReturnedToPIAdvertisement sits among them
        // because it is a branch stage reachable only via Return's jump.
        stages.Should().Equal(
            WorkflowStage.WithPIAdvertisement,
            WorkflowStage.WithRnCOfficeAdvertisement,
            WorkflowStage.WithComputerCentre,
            WorkflowStage.Approved,
            WorkflowStage.ReturnedToPIAdvertisement,
            WorkflowStage.Rejected);
    }

    [Fact]
    public async Task WithPIAdvertisementIsTheOnlyInitialStage()
    {
        var db = await SeededAsync();

        var initial = await db.WorkflowStageDefinitions.Where(s => s.IsInitial).ToListAsync();

        initial.Should().ContainSingle().Which.Stage.Should().Be(WorkflowStage.WithPIAdvertisement);
    }

    [Fact]
    public async Task ApprovedAndRejectedAreTheTerminalStages()
    {
        var db = await SeededAsync();

        var terminal = await db.WorkflowStageDefinitions
            .Where(s => s.IsTerminal)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        terminal.Should().Equal(WorkflowStage.Approved, WorkflowStage.Rejected);
    }

    [Fact]
    public async Task ApprovalIsPossibleAtTheRnCOfficeAndTheComputerCentre()
    {
        var db = await SeededAsync();

        var approving = await db.WorkflowStageDefinitions
            .Where(s => s.CanApprove)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage)
            .ToListAsync();

        approving.Should().Equal(
            WorkflowStage.WithRnCOfficeAdvertisement,
            WorkflowStage.WithComputerCentre);
    }

    [Fact]
    public async Task RejectionAndReturnArePossibleOnlyAtTheRnCOffice()
    {
        // The Computer Centre is the last gate and only approves: an
        // advertisement it will not publish is sent back by the RnC office,
        // not bounced from the end of the chain.
        var db = await SeededAsync();

        var rejecting = await db.WorkflowStageDefinitions
            .Where(s => s.CanReject).Select(s => s.Stage).ToListAsync();
        var returning = await db.WorkflowStageDefinitions
            .Where(s => s.CanReturn).Select(s => s.Stage).ToListAsync();

        rejecting.Should().Equal(WorkflowStage.WithRnCOfficeAdvertisement);
        returning.Should().Equal(WorkflowStage.WithRnCOfficeAdvertisement);
    }

    [Fact]
    public async Task TheComputerCentreStageIsComputerCentreScoped()
    {
        var db = await SeededAsync();

        var stage = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithComputerCentre);

        stage.AllowedRoleList().Should().Equal("ComputerCentre");
    }

    [Fact]
    public async Task ThePiStagesAreThePisOwn_NoRoleRequired()
    {
        // Mirrors Draft on the research proposal route: an empty AllowedRoles
        // means "not role-restricted", with ownership enforced by the service.
        var db = await SeededAsync();

        var withPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithPIAdvertisement);
        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPIAdvertisement);

        withPi.AllowedRoleList().Should().BeEmpty();
        returnedToPi.AllowedRoleList().Should().BeEmpty();
    }

    [Fact]
    public async Task ResubmitEntersAtTheReturnedToPiStage()
    {
        var db = await SeededAsync();

        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.Advertisement);
        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPIAdvertisement);

        definition.ResubmitEntrySequence.Should().Be(returnedToPi.Sequence);
    }

    [Fact]
    public async Task ForwardingOutOfReturnedToPiLandsOnTheRnCOffice()
    {
        // ReturnedToPIAdvertisement sits off the main sequence, so this is
        // carried by ForwardOverrideSequence rather than sequence adjacency.
        var db = await SeededAsync();

        var returnedToPi = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.ReturnedToPIAdvertisement);
        var rnCOffice = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithRnCOfficeAdvertisement);

        returnedToPi.ForwardOverrideSequence.Should().Be(rnCOffice.Sequence);
    }

    [Fact]
    public async Task ReturnedToPiIsNotOnTheOrdinaryForwardPath()
    {
        // ApproveAsync advances strictly to the next stage by sequence, with no
        // special-casing for branch stages. So the RnC office's approve must
        // land directly on the Computer Centre -- if ReturnedToPIAdvertisement
        // sat between them, every approved advertisement would divert into the
        // PI's correction stage.
        var db = await SeededAsync();

        var rnCOffice = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithRnCOfficeAdvertisement);
        var computerCentre = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithComputerCentre);

        computerCentre.Sequence.Should().Be(rnCOffice.Sequence + 1,
            "the RnC office's ordinary Approve must land directly on the Computer Centre, not ReturnedToPIAdvertisement");
    }

    [Fact]
    public async Task ApprovingAtTheComputerCentreLandsOnTheRoutesOwnApprovedStage()
    {
        // ApproveAsync sets CurrentStage = WorkflowStage.Approved when nothing
        // follows; that stage must therefore exist in the route, or the next
        // GetStageAsync throws WorkflowConfigurationException.
        var db = await SeededAsync();

        var computerCentre = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.WithComputerCentre);
        var approved = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Stage == WorkflowStage.Approved);

        approved.Sequence.Should().Be(computerCentre.Sequence + 1);
        approved.CanApprove.Should().BeFalse();
        approved.AllowedRoleList().Should().BeEmpty();
    }

    [Fact]
    public async Task ThisRouteIsValidByPhase7sOwnRules()
    {
        var db = await SeededAsync();
        var stages = await db.WorkflowStageDefinitions.ToListAsync();
        var definition = await db.WorkflowDefinitions
            .SingleAsync(d => d.RequestType == RequestType.Advertisement && d.Phase == WorkflowPhase.Indent);

        var errors = await new WorkflowDefinitionValidator(db, new AllRolesKnown())
            .ValidateAsync(RequestType.Advertisement, WorkflowPhase.Indent, stages, definition.ResubmitEntrySequence);

        errors.Should().BeEmpty();
    }

    [Fact]
    public async Task RejectingAtTheRnCOfficeLandsOnTheRoutesOwnRejectedStage()
    {
        // RejectAsync hardcodes CurrentStage = WorkflowStage.Rejected rather
        // than resolving it from the route, exactly as ApproveAsync does for
        // Approved. Since the RnC office holds CanReject, that stage must exist
        // in the route -- otherwise the rejected instance sits on a stage the
        // route does not contain and the next lookup strands it.
        var db = await SeededAsync();
        var engine = new WorkflowEngineService(db);
        var actorId = Guid.NewGuid();

        var instance = await engine.RaiseAsync(
            RequestType.Advertisement, Guid.NewGuid(), WorkflowPhase.Indent, actorId);

        // PI forwards to the RnC office, which then rejects.
        await engine.ForwardAsync(instance.Id, actorId, [], "submitting");
        (await engine.GetAsync(instance.Id))!.CurrentStage
            .Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);

        await engine.RejectAsync(instance.Id, actorId, ["Dean"], "not suitable for advertisement");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Rejected);

        // The instance is not stranded: the stage genuinely resolves against
        // the route rather than throwing WorkflowConfigurationException.
        var afterReject = await FluentActions
            .Awaiting(() => engine.GetAsync(instance.Id))
            .Should().NotThrowAsync();
        afterReject.Subject!.CurrentStage.Should().Be(WorkflowStage.Rejected);

        var rejectedStage = await new WorkflowDefinitionService(db)
            .GetStageAsync(RequestType.Advertisement, WorkflowPhase.Indent, WorkflowStage.Rejected);
        rejectedStage.IsTerminal.Should().BeTrue();
        rejectedStage.AllowedRoleList().Should().BeEmpty();
    }

    [Fact]
    public async Task TheGenericSeederDoesNotClaimTheAdvertisementRouteFirst()
    {
        // DbSeeder runs WorkflowDefinitionSeeder before this one. If
        // Advertisement were not excluded from the generic seeder's request
        // types, the generic seven-stage office-escalation route would already
        // occupy (Advertisement, Indent) and AdvertisementWorkflowSeeder would
        // take its "update existing" branch -- which reconciles roles and flags
        // by Sequence but never rewrites Stage, permanently leaving the wrong
        // stage names in place. This asserts the real registration order.
        var db = CreateDb();

        await WorkflowDefinitionSeeder.SeedAsync(db);
        await AdvertisementWorkflowSeeder.SeedAsync(db);

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .SingleAsync(d => d.RequestType == RequestType.Advertisement
                           && d.Phase == WorkflowPhase.Indent);

        definition.Stages.OrderBy(s => s.Sequence).Select(s => s.Stage).Should().Equal(
            WorkflowStage.WithPIAdvertisement,
            WorkflowStage.WithRnCOfficeAdvertisement,
            WorkflowStage.WithComputerCentre,
            WorkflowStage.Approved,
            WorkflowStage.ReturnedToPIAdvertisement,
            WorkflowStage.Rejected);

        definition.ResubmitEntrySequence.Should().Be(AdvertisementWorkflowSeeder.ResubmitEntrySequence);
        definition.ResubmitEntrySequence.Should().Be(5);
    }

    /// <summary>
    /// Final whole-branch review bonus recommendation: every role named in the
    /// route's AllowedRoles must also hold the recruitment.detail page grant, or
    /// that role can be approved/rejected/returned/forwarded to at a stage it has
    /// no reachable UI to act from -- exactly the gap finding 1 found for
    /// ComputerCentre (ComputerCentreAdvertisementApprovalsPage.jsx links to
    /// /recruitments/:recruitmentId, which ProtectedRoute.jsx blocks without this
    /// page grant). This is the second time in this plan a role/page grant drift
    /// caused a real bug (Task 6 had an analogous department-scope gap), so this
    /// pins the invariant at build time instead of relying on the next review to
    /// catch it by hand.
    /// </summary>
    [Fact]
    public void EveryRouteRoleHoldsTheRecruitmentDetailPageGrant()
    {
        var routeRoles = AdvertisementWorkflowSeeder.Route
            .SelectMany(r => r.Roles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct()
            .ToList();

        var recruitmentDetailRoles = PageCatalogue.Modules
            .SelectMany(m => m.Pages)
            .Single(p => p.Key == "recruitment.detail")
            .Roles;

        routeRoles.Should().NotBeEmpty("the route must name at least one role-restricted stage for this test to mean anything");
        routeRoles.Should().BeSubsetOf(
            recruitmentDetailRoles,
            "every role the advertisement route can hand a stage to must be able to reach " +
            "/recruitments/:recruitmentId to act on it, or that stage's action has no reachable UI");
    }

    private sealed class AllRolesKnown : IWorkflowRoleCatalogue
    {
        public Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<string>>(
                ["RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "ComputerCentre"]);
    }
}
