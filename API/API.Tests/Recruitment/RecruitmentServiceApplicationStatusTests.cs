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
/// Guards the ApplicationStatus gate: a Draft Candidate row is real and
/// persisted, but must be invisible to every PI-facing recruitment path, while
/// the legacy single-shot ApplyAsync flow keeps working exactly as before.
/// </summary>
public class RecruitmentServiceApplicationStatusTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        FakeApplicantRoleService Roles,
        StubRecruitmentDocumentGenerationService Documents,
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
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-AS1",
            SanctionDate = ProjectStart,
            ProjectTitle = "ApplicationStatus Gate Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringManpower,
            Year1Amount = 500_000m,
            Year2Amount = 0m,
            Year3Amount = 0m,
            Total = 500_000m,
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
        db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            ReceivedDate = new DateOnly(2024, 6, 15),
            Amount = 500_000m,
            Type = GrantReceiptType.Head,
            TransactionReference = "NEFT-SBIN0001234567",
            PaymentMode = PaymentMode.Neft,
        });

        db.SaveChanges();
        AdvertisementWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var roles = new FakeApplicantRoleService();
        var documents = new StubRecruitmentDocumentGenerationService();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));
        var service = new RecruitmentService(
            db, workflow, roles, documents,
            new StubFacultyProfileProvider(),
            new StubDocumentStorageService(),
            new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            new AdvertisementTemplateService(db, new StubFacultyProfileProvider()),
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(db, service, roles, documents, piUserId, projectId, positionId);
    }

    private static async Task<Guid> AdvertisedRequestAsync(Fixture f)
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);
        return id;
    }

    private static async Task<Guid> ApplyAsync(
        Fixture f, Guid requestId, Guid applicantId, string name = "Ana Rao")
    {
        f.Roles.ConfirmedEmails.Add(applicantId);
        return await f.Service.ApplyAsync(
            new ApplyInput(requestId, name, "9990001111", "M.Tech", "1 year", null), applicantId);
    }

    /// <summary>
    /// Seeds a Draft row straight through the DbContext -- the stepwise wizard
    /// that will create these for real does not exist yet, and the point of the
    /// test is the reading side.
    /// </summary>
    private static async Task<Guid> SeedDraftAsync(
        Fixture f, Guid requestId, string name = "Drafty McDraftface")
    {
        var id = Guid.NewGuid();
        f.Db.Candidates.Add(new Candidate
        {
            Id = id,
            RecruitmentRequestId = requestId,
            ApplicationUserId = Guid.NewGuid(),
            FullName = name,
            Mobile = "9998887777",
            Outcome = CandidateOutcome.Pending,
            AppliedAt = DateTimeOffset.UtcNow,
            ApplicationStatus = ApplicationStatus.Draft,
        });
        await f.Db.SaveChangesAsync();
        return id;
    }

    // ------------------------------------------------- the legacy apply flow

    [Fact]
    public async Task ApplyAsync_CreatesASubmittedCandidate_VisibleInListCandidatesAsync()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        // The regression this whole task exists to prevent: ApplicationStatus
        // defaults to Draft, so a missing explicit assignment in ApplyAsync would
        // make every new single-shot application invisible to its own PI.
        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Submitted);

        var listed = await f.Service.ListCandidatesAsync(id, f.PiUserId);
        listed.Should().ContainSingle().Which.Id.Should().Be(candidateId);
    }

    [Fact]
    public async Task ApplyAsync_IsNotBlockedByAnExistingDraftForTheSameRecruitment()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var applicant = Guid.NewGuid();
        f.Db.Candidates.Add(new Candidate
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = id,
            ApplicationUserId = applicant,
            FullName = "Ana Rao",
            Mobile = "9990001111",
            Outcome = CandidateOutcome.Pending,
            AppliedAt = DateTimeOffset.UtcNow,
            ApplicationStatus = ApplicationStatus.Draft,
        });
        await f.Db.SaveChangesAsync();

        // A half-finished draft is not an application on file, so it must not
        // trip the duplicate-application guard.
        var candidateId = await ApplyAsync(f, id, applicant);
        candidateId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ApplyAsync_TwiceToTheSameDrive_StillThrows()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        await ApplyAsync(f, id, applicant);

        var act = () => f.Service.ApplyAsync(
            new ApplyInput(id, "Ana", "999", null, null, null), applicant);

        await act.Should().ThrowAsync<DuplicateApplicationException>();
    }

    // ------------------------------------------------------- reads exclude Draft

    [Fact]
    public async Task ListCandidatesAsync_ExcludesDraftRows()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var submittedId = await ApplyAsync(f, id, Guid.NewGuid(), "Submitted Sue");
        await SeedDraftAsync(f, id);

        var listed = await f.Service.ListCandidatesAsync(id, f.PiUserId);

        listed.Should().ContainSingle().Which.Id.Should().Be(submittedId);
    }

    [Fact]
    public async Task GetAsync_CandidateCount_ExcludesDraftRows()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        await ApplyAsync(f, id, Guid.NewGuid(), "Submitted Sue");
        await SeedDraftAsync(f, id);

        // The count badge must agree with the table it links to.
        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.CandidateCount.Should().Be(1);
    }

    [Fact]
    public async Task GenerateDocumentAsync_ScreeningProforma_ExcludesDraftCandidatesFromThePrintedList()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        await ApplyAsync(f, id, Guid.NewGuid(), "Submitted Sue");
        await SeedDraftAsync(f, id, "Drafty McDraftface");

        await f.Service.SubmitScreeningCommitteeAsync(id,
        [
            new(CommitteeRole.Chairman, "Prof. PI", "CSE", "Professor", false),
            new(CommitteeRole.CoPrincipalInvestigator, "Dr. CoPI", "CSE", "Assoc. Professor", false),
            new(CommitteeRole.NominatedFaculty, "Dr. Nominee", "CSE", "Asst. Professor", false),
        ], f.PiUserId);

        await f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.ScreeningProforma, f.PiUserId);

        var printed = f.Documents.LastModel!.Candidates;
        printed.Should().ContainSingle();
        printed[0].Name.Should().Be("Submitted Sue");
    }

    // ---------------------------------------------- mutations reject a Draft

    [Fact]
    public async Task RecordScreeningResultAsync_OnADraftCandidate_ThrowsCandidateApplicationNotSubmitted()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var draftId = await SeedDraftAsync(f, id);

        var act = () => f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(draftId, ScreeningResult.Eligible), f.PiUserId);

        await act.Should().ThrowAsync<CandidateApplicationNotSubmittedException>();
    }

    [Fact]
    public async Task RecordScreeningResultAsync_OnASubmittedCandidate_StillWorks()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Eligible), f.PiUserId);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ScreeningResult.Should().Be(ScreeningResult.Eligible);
    }

    [Fact]
    public async Task SubmitMeritListAsync_RankingADraftCandidate_ThrowsCandidateApplicationNotSubmitted()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var draftId = await SeedDraftAsync(f, id);

        var act = () => f.Service.SubmitMeritListAsync(
            id, [new MeritRankInput(draftId, 1)], f.PiUserId);

        await act.Should().ThrowAsync<CandidateApplicationNotSubmittedException>();
    }

    [Fact]
    public async Task SubmitMeritListAsync_RankingASubmittedCandidate_StillWorks()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());
        await SeedDraftAsync(f, id);

        await f.Service.SubmitMeritListAsync(
            id, [new MeritRankInput(candidateId, 1)], f.PiUserId);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.MeritRank.Should().Be(1);
    }

    [Fact]
    public async Task SetInterviewModeAsync_OnADraftCandidate_ThrowsCandidateApplicationNotSubmitted()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var draftId = await SeedDraftAsync(f, id);

        var act = () => f.Service.SetInterviewModeAsync(
            new SetInterviewModeInput(draftId, InterviewMode.Offline), f.PiUserId, null);

        await act.Should().ThrowAsync<CandidateApplicationNotSubmittedException>();
    }

    [Fact]
    public async Task ApproveInterviewModeAsync_OnADraftCandidate_ThrowsCandidateApplicationNotSubmitted()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var draftId = await SeedDraftAsync(f, id);

        var act = () => f.Service.ApproveInterviewModeAsync(
            draftId, InterviewMode.Online, Guid.NewGuid());

        await act.Should().ThrowAsync<CandidateApplicationNotSubmittedException>();
    }

    // -------------------------------------------- a Draft is not a "live" application

    [Fact]
    public async Task DraftRows_DoNotKeepAnAccountAliveWhenItsRealApplicationIsRejected()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await ApplyAsync(f, id, applicant);

        // The same person also has an abandoned draft elsewhere.
        var second = await AdvertisedRequestAsync(f);
        f.Db.Candidates.Add(new Candidate
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = second,
            ApplicationUserId = applicant,
            FullName = "Ana Rao",
            Mobile = "9990001111",
            Outcome = CandidateOutcome.Pending,
            AppliedAt = DateTimeOffset.UtcNow,
            ApplicationStatus = ApplicationStatus.Draft,
        });
        await f.Db.SaveChangesAsync();

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Ineligible, "Does not meet minimum qualification."),
            f.PiUserId);

        // An unfinished form is not a live application, so nothing is holding the
        // account open.
        f.Roles.Deactivated.Should().Contain(applicant);
    }
}
