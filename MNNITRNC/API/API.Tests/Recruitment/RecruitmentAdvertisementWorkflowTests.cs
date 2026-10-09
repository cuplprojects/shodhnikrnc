using API.Application.Notifications;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// The advertisement approval chain: PI -> RnC office -> Computer Centre, with
/// the RnC office able to reject or return instead.
/// </summary>
/// <remarks>
/// The load-bearing assertion across this file is that RecruitmentRequest.Stage
/// stays AdvertisementRequested for the WHOLE chain. Advertised is what
/// ApplyAsync gates on, so flipping it one approval early would open the ad to
/// applicants before the Computer Centre had ever seen it.
/// </remarks>
public class RecruitmentAdvertisementWorkflowTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

    private static readonly string[] PiRoles = ["Faculty"];
    private static readonly string[] RnCOfficeRoles = AdvertisementApprovalHarness.RnCOfficeRoles;
    private static readonly string[] ComputerCentreRoles = AdvertisementApprovalHarness.ComputerCentreRoles;

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        FakeApplicantRoleService Roles,
        Guid PiUserId,
        Guid ProjectId,
        Guid PositionId);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var piUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-ADV1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Advertisement Workflow Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 31_000m,
            Hra = 0m,
        });
        db.SaveChanges();

        AdvertisementWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var roles = new FakeApplicantRoleService();
        var profiles = new StubFacultyProfileProvider();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));
        var service = new RecruitmentService(
            db, workflow, roles,
            new StubRecruitmentDocumentGenerationService(), profiles,
            new StubDocumentStorageService(), new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            new AdvertisementTemplateService(db, profiles),
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(db, service, roles, piUserId, projectId, positionId);
    }

    private static async Task<Guid> SubmittedForApprovalAsync(Fixture f, string text = "JRF wanted")
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, text, "Submitted for RnC office approval"), f.PiUserId);
        return id;
    }

    private static async Task<RecruitmentRequest> RequestAsync(Fixture f, Guid id) =>
        await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);

    private static async Task<WorkflowStage> StageAsync(Fixture f, Guid id)
    {
        var request = await RequestAsync(f, id);
        var instance = await f.Db.WorkflowInstances.AsNoTracking()
            .FirstAsync(w => w.Id == request.AdvertisementWorkflowInstanceId!.Value);
        return instance.CurrentStage;
    }

    // ------------------------------------------------------------- AdvertiseAsync

    [Fact]
    public async Task AdvertiseAsync_FirstCall_RaisesWorkflowAndForwardsToRnCOffice()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        var request = await RequestAsync(f, id);
        request.AdvertisementWorkflowInstanceId.Should().NotBeNull();
        request.Stage.Should().Be(
            RecruitmentStage.AdvertisementRequested,
            "the ad must not go live until the Computer Centre approves");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);

        // The ad row itself exists from the first call -- only its liveness is
        // deferred, not its content.
        (await f.Db.Advertisements.CountAsync(a => a.RecruitmentRequestId == id)).Should().Be(1);
    }

    /// <summary>
    /// Final whole-branch review finding 2: a second AdvertiseAsync call while
    /// the instance is actively under RnC office or Computer Centre review must
    /// be refused, not silently rewrite the content a reviewer is currently
    /// looking at. This pins the fix -- the previous version of this test
    /// asserted the opposite (a silent overwrite succeeding), which was the bug.
    /// </summary>
    [Fact]
    public async Task AdvertiseAsync_SecondCallWhileAtRnCOffice_ThrowsAndLeavesContentUnchanged()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f, "original wording");
        var firstInstanceId = (await RequestAsync(f, id)).AdvertisementWorkflowInstanceId;

        var act = async () => await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "sneaky edit", "Submitted for RnC office approval"), f.PiUserId);

        await act.Should().ThrowAsync<InvalidRecruitmentStageException>();

        (await RequestAsync(f, id)).AdvertisementWorkflowInstanceId.Should().Be(firstInstanceId);
        (await f.Db.WorkflowInstances.CountAsync(w => w.RequestId == id)).Should().Be(1);
        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);

        var ad = await f.Db.Advertisements.AsNoTracking()
            .FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("original wording", "the throw must happen before any content is written");
    }

    /// <summary>Same as above, but at the Computer Centre stage -- the guard
    /// must cover both in-review stages, not just the RnC office's.</summary>
    [Fact]
    public async Task AdvertiseAsync_SecondCallWhileAtComputerCentre_ThrowsAndLeavesContentUnchanged()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f, "original wording");
        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "looks fine");

        var act = async () => await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "sneaky edit", "Submitted for RnC office approval"), f.PiUserId);

        await act.Should().ThrowAsync<InvalidRecruitmentStageException>();

        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithComputerCentre);
        var ad = await f.Db.Advertisements.AsNoTracking()
            .FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("original wording");
    }

    /// <summary>The legitimate resubmit path -- calling AdvertiseAsync again
    /// while at ReturnedToPIAdvertisement -- must keep working: the guard only
    /// closes the in-review hole, it must not also block the resubmit the
    /// re-forward branch already handles.</summary>
    [Fact]
    public async Task AdvertiseAsync_SecondCallWhileReturnedToPI_StillWorksAndReForwards()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f, "original wording");
        await f.Service.ReturnAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "fix the dates");

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "corrected wording", "Submitted for RnC office approval"), f.PiUserId);

        (await StageAsync(f, id)).Should().Be(
            WorkflowStage.WithRnCOfficeAdvertisement, "the resubmit must still re-forward");
        var ad = await f.Db.Advertisements.AsNoTracking()
            .FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("corrected wording");
    }

    [Fact]
    public async Task AdvertiseAsync_WithoutASeededRoute_IsTheOnlyThingThatNeedsTheDefinition()
    {
        // Guard on the seeder's own wiring: the route must actually resolve, or
        // every advertisement in the system fails at submit time.
        var f = Create();
        var definition = await f.Db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstAsync(d => d.RequestType == RequestType.Advertisement);

        definition.Stages.Should().HaveCount(6);
        definition.ResubmitEntrySequence.Should().Be(AdvertisementWorkflowSeeder.ResubmitEntrySequence);
    }

    // --------------------------------------------------------------- Approve

    [Fact]
    public async Task ApproveAdvertisementAsync_AtRnCOffice_AdvancesWithoutMakingItLive()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        await f.Service.ApproveAdvertisementAsync(
            id, Guid.NewGuid(), RnCOfficeRoles, "looks fine");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithComputerCentre);
        (await RequestAsync(f, id)).Stage.Should().Be(
            RecruitmentStage.AdvertisementRequested,
            "only the Computer Centre's approve publishes the ad");
    }

    [Fact]
    public async Task ApproveAdvertisementAsync_AtComputerCentre_MakesItLive()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, null);
        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), ComputerCentreRoles, "published");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.Approved);
        (await RequestAsync(f, id)).Stage.Should().Be(RecruitmentStage.Advertised);

        // Regression: applying was blocked by InvalidRecruitmentStageException
        // for the whole chain; it must work the moment the ad is live.
        var applicantId = Guid.NewGuid();
        f.Roles.ConfirmedEmails.Add(applicantId);
        var candidateId = await f.Service.ApplyAsync(
            new ApplyInput(id, "Ana Rao", "9990001111", "M.Tech", "1 year", null), applicantId);
        candidateId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ApplyAsync_WhileTheChainIsStillRunning_IsRefused()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, null);

        var applicantId = Guid.NewGuid();
        f.Roles.ConfirmedEmails.Add(applicantId);

        var act = async () => await f.Service.ApplyAsync(
            new ApplyInput(id, "Too Early", "9990001111", "M.Tech", "1 year", null), applicantId);

        await act.Should().ThrowAsync<InvalidRecruitmentStageException>();
    }

    [Fact]
    public async Task ApproveAdvertisementAsync_WithoutAWorkflow_Throws()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        var act = async () => await f.Service.ApproveAdvertisementAsync(
            id, Guid.NewGuid(), RnCOfficeRoles, null);

        await act.Should().ThrowAsync<AdvertisementWorkflowNotStartedException>();
    }

    // ---------------------------------------------------------------- Reject

    [Fact]
    public async Task RejectAdvertisementAsync_AtRnCOffice_NeverMakesItLive()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        await f.Service.RejectAdvertisementAsync(
            id, Guid.NewGuid(), RnCOfficeRoles, "position not sanctioned this year");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.Rejected);
        (await RequestAsync(f, id)).Stage.Should().Be(RecruitmentStage.AdvertisementRequested);
    }

    [Fact]
    public async Task RejectAdvertisementAsync_ThenApprove_CannotResurrectTheAd()
    {
        // A rejected instance sits on the terminal Rejected stage, which grants
        // no CanApprove -- so nothing downstream can talk it back into life.
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        await f.Service.RejectAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "no");

        var act = async () => await f.Service.ApproveAdvertisementAsync(
            id, Guid.NewGuid(), ComputerCentreRoles, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
        (await RequestAsync(f, id)).Stage.Should().Be(RecruitmentStage.AdvertisementRequested);
    }

    // ---------------------------------------------------------------- Return

    [Fact]
    public async Task ReturnAdvertisementAsync_AtRnCOffice_SendsBackToPI_ThenResubmitReForwards()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        var instanceId = (await RequestAsync(f, id)).AdvertisementWorkflowInstanceId;

        await f.Service.ReturnAdvertisementAsync(
            id, Guid.NewGuid(), RnCOfficeRoles, "closing date is too soon");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.ReturnedToPIAdvertisement);
        (await RequestAsync(f, id)).Stage.Should().Be(RecruitmentStage.AdvertisementRequested);

        // The PI edits and resubmits: the SAME instance travels back to the RnC
        // office, via ReturnedToPIAdvertisement's ForwardOverrideSequence.
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing.AddMonths(1), "corrected wording", "Submitted for RnC office approval"), f.PiUserId);

        var request = await RequestAsync(f, id);
        request.AdvertisementWorkflowInstanceId.Should().Be(
            instanceId, "a resubmit must not orphan the original instance");
        (await f.Db.WorkflowInstances.CountAsync(w => w.RequestId == id)).Should().Be(1);
        (await StageAsync(f, id)).Should().Be(
            WorkflowStage.WithRnCOfficeAdvertisement,
            "the resubmit rejoins at the RnC office, not at the PI's own initial stage");

        var ad = await f.Db.Advertisements.AsNoTracking()
            .FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("corrected wording");
    }

    [Fact]
    public async Task ReturnedThenResubmitted_StillCompletesThroughComputerCentre()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        await f.Service.ReturnAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "fix it");
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "fixed", "Submitted for RnC office approval"), f.PiUserId);

        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, null);
        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), ComputerCentreRoles, null);

        (await StageAsync(f, id)).Should().Be(WorkflowStage.Approved);
        (await RequestAsync(f, id)).Stage.Should().Be(RecruitmentStage.Advertised);
    }

    // --------------------------------------------------------------- Forward

    [Fact]
    public async Task ForwardAdvertisementAsync_FromReturnedStage_ReachesRnCOffice()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        await f.Service.ReturnAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "fix it");

        await f.Service.ForwardAdvertisementAsync(id, f.PiUserId, PiRoles, "resubmitting");

        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);
    }

    // --------------------------------------------------- Readvertise untouched

    [Fact]
    public async Task ReadvertiseAsync_NeverTouchesTheWorkflowInstance()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);

        var instanceId = (await RequestAsync(f, id)).AdvertisementWorkflowInstanceId;
        var stageBefore = await StageAsync(f, id);

        await f.Service.ReadvertiseAsync(
            new ReadvertiseInput(id, 0, Published.AddMonths(2), Closing.AddMonths(2), "round two"),
            f.PiUserId);

        var request = await RequestAsync(f, id);
        request.AdvertisementWorkflowInstanceId.Should().Be(instanceId);
        request.AdvertisementRound.Should().Be(2);
        request.Stage.Should().Be(RecruitmentStage.Advertised);

        (await f.Db.WorkflowInstances.CountAsync(w => w.RequestId == id)).Should().Be(
            1, "re-advertising raises no second instance");
        (await StageAsync(f, id)).Should().Be(stageBefore);
    }
}
