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

public class RecruitmentServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        FakeApplicantRoleService Roles,
        StubRecruitmentDocumentGenerationService Documents,
        RecordingEmailSender Mail,
        Guid PiUserId,
        Guid ProjectId,
        Guid PositionId,
        WorkflowEngineService WorkflowEngine,
        Guid DeanUserId);

    private static Fixture Create(
        bool withGrantReceipt = true, bool withTransactionReference = true,
        GrantReceiptStatus grantReceiptStatus = GrantReceiptStatus.Approved)
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
            DepartmentId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-R1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Recruitment Test Project",
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

        if (withGrantReceipt)
        {
            db.GrantReceipts.Add(new GrantReceipt
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                BudgetHeadId = budgetHeadId,
                ReceivedDate = new DateOnly(2024, 6, 15),
                Amount = 500_000m,
                Type = GrantReceiptType.Head,
                TransactionReference = withTransactionReference ? "NEFT-SBIN0001234567" : null,
                PaymentMode = withTransactionReference ? Domain.Enums.PaymentMode.Neft : null,
                Status = grantReceiptStatus,
            });
        }

        db.SaveChanges();

        // AdvertiseAsync now raises an instance on this route, so every fixture
        // that advertises needs the definition present.
        AdvertisementWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        // SubmitScreeningCommitteeForApprovalAsync raises an instance on this
        // route, so every fixture needs the definition present too.
        ScreeningCommitteeWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        // SubmitSelectionCommitteeForApprovalAsync raises an instance on this
        // route, so every fixture needs the definition present too.
        SelectionCommitteeWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var roles = new FakeApplicantRoleService();
        var documents = new StubRecruitmentDocumentGenerationService();
        var mail = new RecordingEmailSender();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));
        var service = new RecruitmentService(
            db, workflow, roles, documents,
            new API.Tests.Procurement.StubFacultyProfileProvider(),
            new API.Tests.Procurement.StubDocumentStorageService(),
            mail,
            TestEmailOptions(),
            new AdvertisementTemplateService(db, new API.Tests.Procurement.StubFacultyProfileProvider()),
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var deanUserId = Guid.NewGuid();

        return new Fixture(db, service, roles, documents, mail, piUserId, projectId, positionId, workflow, deanUserId);
    }

    private static Microsoft.Extensions.Options.IOptions<EmailOptions> TestEmailOptions() =>
        Microsoft.Extensions.Options.Options.Create(new EmailOptions
        {
            Host = "smtp.test.local",
            FromAddress = "noreply@test.local",
            PortalBaseUrl = "http://localhost:5173",
        });

    private static IReadOnlyList<CommitteeMemberInput> ScreeningCommittee() =>
    [
        new(CommitteeRole.Chairman, "Prof. PI", "CSE", "Professor", false),
        new(CommitteeRole.CoPrincipalInvestigator, "Dr. CoPI", "CSE", "Assoc. Professor", false),
        new(CommitteeRole.NominatedFaculty, "Dr. Nominee", "CSE", "Asst. Professor", false),
    ];

    private static IReadOnlyList<CommitteeMemberInput> SelectionCommittee() =>
    [
        new(CommitteeRole.Chairman, "Prof. HOD", "CSE", "Professor", false, Email: "hod@test.local"),
        new(CommitteeRole.PrincipalInvestigator, "Prof. PI", "CSE", "Professor", false, Email: "pi@test.local"),
        new(CommitteeRole.InternalNominee, "Dr. Internal", "CSE", "Assoc. Professor", false, Email: "internal@test.local"),
        new(CommitteeRole.ExternalNominee, "Prof. External", "ECE", "Professor", true, Email: "external@test.local"),
    ];

    private static async Task<Guid> AdvertisedRequestAsync(Fixture f)
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);
        return id;
    }

    private static async Task<Guid> ApplyAsync(Fixture f, Guid requestId, Guid applicantId, string name = "Ana Rao")
    {
        f.Roles.ConfirmedEmails.Add(applicantId);
        return await f.Service.ApplyAsync(
            new ApplyInput(requestId, name, "9990001111", "M.Tech", "1 year", null), applicantId);
    }

    /// <summary>
    /// Builds a ResearchProposal (with one Co-PI) tied to the fixture's
    /// project, plus an advertised RecruitmentRequest for that project -- the
    /// exact shape SubmitScreeningCommitteeForApprovalAsync's Co-PI lookup
    /// queries (ResearchProposal.ProjectId == RecruitmentRequest.ProjectId).
    /// </summary>
    private static async Task<Guid> RaiseRecruitmentWithProposalAndCoPiAsync(Fixture f)
    {
        var proposalId = Guid.NewGuid();
        f.Db.ResearchProposals.Add(new ResearchProposal
        {
            Id = proposalId,
            OwnerUserId = f.PiUserId,
            DepartmentId = Guid.NewGuid(),
            Title = "Test Proposal",
            Agency = "DST",
            ProjectId = f.ProjectId,
            CreatedAt = DateTimeOffset.UtcNow,
            CoPis =
            [
                new ProposalCoPi
                {
                    Id = Guid.NewGuid(),
                    ResearchProposalId = proposalId,
                    Name = "Dr. CoPI",
                    Department = "CSE",
                    Designation = "Assoc. Professor",
                },
            ],
        });
        f.Db.Users.Add(new ApplicationUser { Id = f.PiUserId, UserName = "pi@test.local", FullName = "Prof. PI" });
        await f.Db.SaveChangesAsync();

        return await AdvertisedRequestAsync(f);
    }

    /// <summary>
    /// This file's standard "raise a recruitment request" helper for tests
    /// that need nothing beyond an advertised RecruitmentRequest plus what
    /// SubmitSelectionCommitteeForApprovalAsync itself requires: a PI
    /// ApplicationUser row (for its FullName lookup) and a Department row
    /// whose HeadUserId resolves to an HOD ApplicationUser row (see
    /// ResolveHodForRequestAsync). No ResearchProposal/Co-PI chain is needed
    /// here -- that is Screening's own requirement, not Selection's.
    /// </summary>
    private static async Task<Guid> RaiseRecruitmentAsync(Fixture f)
    {
        f.Db.Users.Add(new ApplicationUser { Id = f.PiUserId, UserName = "pi@test.local", FullName = "Prof. PI" });

        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        var hodUserId = Guid.NewGuid();
        f.Db.Users.Add(new ApplicationUser { Id = hodUserId, UserName = "hod@test.local", FullName = "Prof. HOD" });
        f.Db.Departments.Add(new Department
        {
            Id = project.DepartmentId,
            Code = "CSE",
            Name = "Computer Science and Engineering",
            HeadUserId = hodUserId,
        });
        await f.Db.SaveChangesAsync();

        return await AdvertisedRequestAsync(f);
    }

    /// <summary>
    /// SubmitSelectionCommitteeForApprovalAsync assigns each recommended
    /// member's role from IsOutsideInstitute (Internal vs External nominee),
    /// not from whatever Role is passed in here -- so the Role on these
    /// inputs is irrelevant, only IsOutsideInstitute controls the outcome.
    /// </summary>
    private static IReadOnlyList<CommitteeMemberInput> ThreeRecommendedMembers() =>
    [
        new(CommitteeRole.InternalNominee, "Dr. Internal One", "CSE", "Assoc. Professor", false),
        new(CommitteeRole.InternalNominee, "Dr. Internal Two", "CSE", "Professor", false),
        new(CommitteeRole.InternalNominee, "Prof. External", "ECE", "Professor", true),
    ];

    // ------------------------------------------------------------- Task 6

    [Fact]
    public async Task AdvertiseAsync_ThenTheFullApprovalChain_MovesToAdvertised()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.Stage.Should().Be(RecruitmentStage.Advertised);
        summary.AdvertisementRound.Should().Be(1);
    }

    /// <summary>
    /// ListForComputerCentreQueueAsync filters strictly on
    /// CurrentStage == WithComputerCentre, so a recruitment disappears from
    /// that queue the instant a Computer Centre user publishes it --
    /// ListComputerCentreAdvertisementHistoryAsync is the counterpart that
    /// keeps it reachable afterward, scoped to the specific user's own
    /// WorkflowStep.Approve actions rather than every published advertisement.
    /// </summary>
    [Fact]
    public async Task ListComputerCentreAdvertisementHistoryAsync_AfterPublishing_ShowsOnlyThatUsersOwnActions()
    {
        var f = Create();
        var ccUserId = Guid.NewGuid();
        var otherCcUserId = Guid.NewGuid();

        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await f.Service.ApproveAdvertisementAsync(
            id, Guid.NewGuid(), AdvertisementApprovalHarness.RnCOfficeRoles, "RnC office approved");

        // Before publishing: gone from neither queue's history nor the other
        // CC user's history (nothing has been approved by anyone yet).
        (await f.Service.ListComputerCentreAdvertisementHistoryAsync(ccUserId)).Should().BeEmpty();

        await f.Service.ApproveAdvertisementAsync(
            id, ccUserId, AdvertisementApprovalHarness.ComputerCentreRoles, "Published.");

        var history = await f.Service.ListComputerCentreAdvertisementHistoryAsync(ccUserId);
        history.Should().ContainSingle(r => r.Id == id);

        // Scoped to this user specifically -- a different CC user who never
        // acted on this recruitment sees nothing for it.
        (await f.Service.ListComputerCentreAdvertisementHistoryAsync(otherCcUserId)).Should().BeEmpty();

        // And it's genuinely gone from the pending queue now.
        (await f.Service.ListForComputerCentreQueueAsync()).Should().NotContain(r => r.Id == id);
    }

    [Fact]
    public async Task ReadvertiseAsync_IncrementsRoundAndRecordsTheShortfall()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        await f.Service.ReadvertiseAsync(
            new ReadvertiseInput(id, 1, new DateOnly(2024, 8, 1), new DateOnly(2024, 8, 21), "again"),
            f.PiUserId);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.AdvertisementRound.Should().Be(2);
        summary.Stage.Should().Be(RecruitmentStage.Advertised);

        var ads = await f.Db.Advertisements.Where(a => a.RecruitmentRequestId == id)
            .OrderBy(a => a.Round).ToListAsync();
        ads.Should().HaveCount(2);
        ads[0].CandidateCountAtClose.Should().Be(1);
        ads[1].CandidateCountAtClose.Should().BeNull();
    }

    [Fact]
    public async Task SaveAdvertisementDraftAsync_ThenGetAsync_ReturnsTheSavedDraft()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        await f.Service.SaveAdvertisementDraftAsync(
            id, f.PiUserId, "<p>Work in progress</p>", new DateOnly(2024, 9, 1));

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftAdvertisementText.Should().Contain("Work in progress");
        summary.DraftClosingDate.Should().Be(new DateOnly(2024, 9, 1));
        // Saving a draft must never touch the real advertisement or raise a
        // workflow -- it's purely a save point.
        summary.Text.Should().BeNull();
        summary.Stage.Should().Be(RecruitmentStage.Draft);
    }

    [Fact]
    public async Task SaveAdvertisementDraftAsync_StoresCandidateRequirementsAndDrafts()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        await f.Service.SaveAdvertisementDraftAsync(
            id, f.PiUserId, "<p>Draft body</p>", new DateOnly(2024, 9, 1),
            requiredQualifications: "10th,12th,UG,PG", allowDiplomaFor12th: true,
            requireExperience: true, minExperienceMonths: 24,
            requirePublications: true, requireResume: true);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftRequiredQualifications.Should().Be("10th,12th,UG,PG");
        summary.DraftAllowDiplomaFor12th.Should().BeTrue();
        summary.DraftRequireExperience.Should().BeTrue();
        summary.DraftMinExperienceMonths.Should().Be(24);
        summary.DraftRequirePublications.Should().BeTrue();
        summary.DraftRequireResume.Should().BeTrue();
    }

    [Fact]
    public async Task AdvertiseAsync_StoresCandidateRequirementsOnSubmittedRecruitment()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(
                id, Published, Closing, "<p>Ad text</p>", "Submitting with requirements",
                RequiredQualifications: "10th,12th,UG,PG,GATE/NET",
                AllowDiplomaFor12th: true,
                RequireExperience: true,
                MinExperienceMonths: 12,
                RequirePublications: true,
                RequireResume: true),
            f.PiUserId);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.RequiredQualifications.Should().Be("10th,12th,UG,PG,GATE/NET");
        summary.AllowDiplomaFor12th.Should().BeTrue();
        summary.RequireExperience.Should().BeTrue();
        summary.MinExperienceMonths.Should().Be(12);
        summary.RequirePublications.Should().BeTrue();
        summary.RequireResume.Should().BeTrue();
    }

    [Fact]
    public async Task SaveAdvertisementDraftAsync_SanitizesTheDraftTextTheSameAsARealSubmission()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        await f.Service.SaveAdvertisementDraftAsync(
            id, f.PiUserId, "<p>Hello</p><script>alert(1)</script>", null);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftAdvertisementText.Should().Contain("<p>Hello</p>");
        summary.DraftAdvertisementText.Should().NotContain("<script");
    }

    [Fact]
    public async Task AdvertiseAsync_ClearsAnyPreviouslySavedDraft()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.SaveAdvertisementDraftAsync(id, f.PiUserId, "<p>Draft text</p>", null);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "<p>Final text</p>", "Submitted for RnC office approval"), f.PiUserId);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftAdvertisementText.Should().BeNull();
        summary.DraftClosingDate.Should().BeNull();
        summary.Text.Should().Contain("Final text");
    }

    [Fact]
    public async Task ReadvertiseAsync_ClearsAnyPreviouslySavedDraft()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        await f.Service.SaveAdvertisementDraftAsync(id, f.PiUserId, "<p>Draft for round 2</p>", null);

        await f.Service.ReadvertiseAsync(
            new ReadvertiseInput(id, 1, new DateOnly(2024, 8, 1), new DateOnly(2024, 8, 21), "round two"),
            f.PiUserId);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftAdvertisementText.Should().BeNull();
        summary.DraftClosingDate.Should().BeNull();
    }

    [Fact]
    public async Task PreviewAdvertisementHtmlAsync_ReturnsRenderedHtmlWithoutPersistingAnything()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        var html = await f.Service.PreviewAdvertisementHtmlAsync(
            id, f.PiUserId, "<p>Unsaved preview text</p>", new DateOnly(2024, 9, 1));

        html.Should().Contain("Unsaved preview text");

        // The service resolved real project/position/PI data into the model
        // handed to the renderer, even though this stub's own HTML only
        // echoes the advertisement text back.
        f.Documents.LastModel.Should().NotBeNull();
        f.Documents.LastModel!.ProjectTitle.Should().Be("Recruitment Test Project");
        f.Documents.LastModel.ClosingDate.Should().Be(new DateOnly(2024, 9, 1));

        // Nothing about this call is persisted -- no Advertisement row, no draft.
        (await f.Db.Advertisements.CountAsync()).Should().Be(0);
        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.DraftAdvertisementText.Should().BeNull();
        summary.Text.Should().BeNull();
    }

    [Fact]
    public async Task PreviewAdvertisementHtmlAsync_SanitizesTheTextTheSameAsARealSubmission()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

        var html = await f.Service.PreviewAdvertisementHtmlAsync(
            id, f.PiUserId, "<p>Hello</p><script>alert(1)</script>", null);

        html.Should().Contain("Hello");
        html.Should().NotContain("<script");
    }

    [Fact]
    public async Task ApplyAsync_WithoutVerifiedEmail_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        // Deliberately not added to ConfirmedEmails.

        var act = () => f.Service.ApplyAsync(
            new ApplyInput(id, "Ana", "999", null, null, null), applicant);

        await act.Should().ThrowAsync<EmailNotVerifiedException>();
    }

    [Fact]
    public async Task ApplyAsync_TwiceToSameDrive_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        await ApplyAsync(f, id, applicant);

        var act = () => f.Service.ApplyAsync(
            new ApplyInput(id, "Ana", "999", null, null, null), applicant);

        await act.Should().ThrowAsync<DuplicateApplicationException>();
    }

    [Fact]
    public async Task ApplyAsync_ReactivatesTheAccount()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        await ApplyAsync(f, id, applicant);

        f.Roles.Reactivated.Should().Contain(applicant);
    }

    /// <summary>
    /// The security-relevant rule: prefill may only copy from the caller's own
    /// earlier application.
    /// </summary>
    [Fact]
    public async Task ApplyAsync_PrefillFromAnotherApplicant_Throws()
    {
        var f = Create();
        var first = await AdvertisedRequestAsync(f);
        var stranger = Guid.NewGuid();
        var strangerCandidateId = await ApplyAsync(f, first, stranger, "Stranger");

        var second = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(second, Published, Closing, "Another", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, second);

        var applicant = Guid.NewGuid();
        f.Roles.ConfirmedEmails.Add(applicant);

        var act = () => f.Service.ApplyAsync(
            new ApplyInput(second, "Ana", "999", null, null, strangerCandidateId), applicant);

        await act.Should().ThrowAsync<PrefillNotOwnedException>();
    }

    [Fact]
    public async Task ApplyAsync_PrefillFromOwnApplication_CopiesDetails()
    {
        var f = Create();
        var first = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var firstCandidateId = await ApplyAsync(f, first, applicant, "Ana Rao");

        var second = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(second, Published, Closing, "Another", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, second);

        var newId = await f.Service.ApplyAsync(
            new ApplyInput(second, "", "", null, null, firstCandidateId), applicant);

        var created = await f.Db.Candidates.FirstAsync(c => c.Id == newId);
        created.FullName.Should().Be("Ana Rao");
        created.Qualification.Should().Be("M.Tech");
        created.PrefilledFromCandidateId.Should().Be(firstCandidateId);

        // A fresh row -- the earlier application is untouched.
        created.Id.Should().NotBe(firstCandidateId);
        (await f.Db.Candidates.CountAsync(c => c.ApplicationUserId == applicant)).Should().Be(2);
    }

    // ------------------------------------------------------------- Task 7

    [Fact]
    public async Task SubmitScreeningCommittee_MissingCoPrincipalInvestigator_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var members = ScreeningCommittee()
            .Where(m => m.Role != CommitteeRole.CoPrincipalInvestigator)
            .ToList();

        var act = () => f.Service.SubmitScreeningCommitteeAsync(id, members, f.PiUserId);

        await act.Should().ThrowAsync<InvalidCommitteeCompositionException>();
    }

    [Fact]
    public async Task SubmitScreeningCommittee_WithoutTheDeanHavingNominatedYet_Succeeds()
    {
        // The Dean's nominee is a separate, independent action
        // (NominateScreeningFacultyAsync) -- the PI must be able to save their
        // own Chairman/Co-PI without already knowing who the Dean will pick,
        // and without the Dean having acted first.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var piOwnMembers = ScreeningCommittee()
            .Where(m => m.Role != CommitteeRole.NominatedFaculty)
            .ToList();

        await f.Service.SubmitScreeningCommitteeAsync(id, piOwnMembers, f.PiUserId);

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Screening)
            .ToListAsync();
        saved.Select(m => m.Role).Should().BeEquivalentTo(
            [CommitteeRole.Chairman, CommitteeRole.CoPrincipalInvestigator]);
    }

    [Fact]
    public async Task NominateScreeningFacultyAsync_AfterPiAlreadySubmitted_DoesNotRemoveThePisMembers()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var piOwnMembers = ScreeningCommittee()
            .Where(m => m.Role != CommitteeRole.NominatedFaculty)
            .ToList();
        await f.Service.SubmitScreeningCommitteeAsync(id, piOwnMembers, f.PiUserId);

        await f.Service.NominateScreeningFacultyAsync(
            id, "Dr. Nominee", "CSE", "Asst. Professor", Guid.NewGuid());

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Screening)
            .ToListAsync();
        saved.Select(m => m.Role).Should().BeEquivalentTo(
            [CommitteeRole.Chairman, CommitteeRole.CoPrincipalInvestigator, CommitteeRole.NominatedFaculty]);
    }

    [Fact]
    public async Task SubmitScreeningCommitteeAsync_AfterDeanAlreadyNominated_DoesNotRemoveTheDeansNominee()
    {
        // The reverse ordering: SubmitCommitteeAsync's "resubmission replaces
        // the roster" behaviour must only replace the roles the PI is actually
        // submitting, never a role a different actor already saved.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        await f.Service.NominateScreeningFacultyAsync(
            id, "Dr. Nominee", "CSE", "Asst. Professor", Guid.NewGuid());
        var piOwnMembers = ScreeningCommittee()
            .Where(m => m.Role != CommitteeRole.NominatedFaculty)
            .ToList();

        await f.Service.SubmitScreeningCommitteeAsync(id, piOwnMembers, f.PiUserId);

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Screening)
            .ToListAsync();
        saved.Select(m => m.Role).Should().BeEquivalentTo(
            [CommitteeRole.Chairman, CommitteeRole.CoPrincipalInvestigator, CommitteeRole.NominatedFaculty]);
        saved.Single(m => m.Role == CommitteeRole.NominatedFaculty).Name.Should().Be("Dr. Nominee");
    }

    [Fact]
    public async Task SubmitSelectionCommittee_WithoutNomineesYet_Succeeds()
    {
        // SubmitCommitteeAsync no longer validates Selection composition at
        // all (that moved to SubmitSelectionCommitteeForApprovalAsync) -- it
        // remains a low-level row-writer that accepts whatever subset of
        // roles a caller already has, same as it always could for Screening.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var chairmanAndPi = SelectionCommittee()
            .Where(m => m.Role is CommitteeRole.Chairman or CommitteeRole.PrincipalInvestigator)
            .ToList();

        await f.Service.SubmitSelectionCommitteeAsync(id, chairmanAndPi, f.PiUserId);

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Selection)
            .ToListAsync();
        saved.Select(m => m.Role).Should().BeEquivalentTo(
            [CommitteeRole.Chairman, CommitteeRole.PrincipalInvestigator]);
    }

    [Fact]
    public async Task SubmitSelectionCommitteeAsync_AfterANomineeAlreadySaved_DoesNotRemoveIt()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var chairmanAndPi = SelectionCommittee()
            .Where(m => m.Role is CommitteeRole.Chairman or CommitteeRole.PrincipalInvestigator)
            .ToList();
        var chairmanPiAndNominee = chairmanAndPi
            .Append(new CommitteeMemberInput(CommitteeRole.InternalNominee, "Dr. Internal", "CSE", "Assoc. Professor", false))
            .ToList();
        await f.Service.SubmitSelectionCommitteeAsync(id, chairmanPiAndNominee, f.PiUserId);

        // Resubmitting just Chairman/PI (e.g. a correction) must not wipe out
        // the nominee already saved -- SubmitCommitteeAsync only removes
        // existing rows whose role is present in the new submission.
        await f.Service.SubmitSelectionCommitteeAsync(id, chairmanAndPi, f.PiUserId);

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Selection)
            .ToListAsync();
        saved.Select(m => m.Role).Should().Contain(CommitteeRole.InternalNominee);
    }

    [Fact]
    public async Task SubmitScreeningCommittee_Valid_MovesToScreening()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        await f.Service.SubmitScreeningCommitteeAsync(id, ScreeningCommittee(), f.PiUserId);

        (await f.Service.GetAsync(id, f.PiUserId)).Stage
            .Should().Be(RecruitmentStage.ScreeningInProgress);
    }

    [Fact]
    public async Task SubmitScreeningCommitteeForApprovalAsync_AddsPiAndCoPi_AndForwardsToDean()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentWithProposalAndCoPiAsync(f);

        await f.Service.SubmitScreeningCommitteeForApprovalAsync(requestId, f.PiUserId);

        var members = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == requestId && m.Kind == CommitteeKind.Screening)
            .ToListAsync();
        members.Should().Contain(m => m.Role == CommitteeRole.Chairman);
        members.Should().Contain(m => m.Role == CommitteeRole.CoPrincipalInvestigator);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        request.ScreeningCommitteeWorkflowInstanceId.Should().NotBeNull();

        var instance = await f.WorkflowEngine.GetAsync(request.ScreeningCommitteeWorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.WithDeanScreeningCommittee);
    }

    [Fact]
    public async Task AssignScreeningCommitteeMemberAsync_AddsMember_AndApproves()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentWithProposalAndCoPiAsync(f);
        await f.Service.SubmitScreeningCommitteeForApprovalAsync(requestId, f.PiUserId);

        await f.Service.AssignScreeningCommitteeMemberAsync(
            requestId,
            new CommitteeMemberInput(CommitteeRole.NominatedFaculty, "Dr. Nominee", "CSE", "Professor", false),
            f.DeanUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        var instance = await f.WorkflowEngine.GetAsync(request.ScreeningCommitteeWorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.ScreeningCommitteeApproved);

        var nominee = await f.Db.CommitteeMembers.FirstAsync(m =>
            m.RecruitmentRequestId == requestId && m.Role == CommitteeRole.NominatedFaculty);
        nominee.Name.Should().Be("Dr. Nominee");
    }

    [Fact]
    public async Task SubmitSelectionCommitteeForApprovalAsync_WithFewerThan3Recommended_Throws()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentAsync(f);

        var act = () => f.Service.SubmitSelectionCommitteeForApprovalAsync(
            requestId, optionalMember: null,
            recommendedMembers: [
                new CommitteeMemberInput(CommitteeRole.InternalNominee, "A", "CSE", "Professor", false),
                new CommitteeMemberInput(CommitteeRole.InternalNominee, "B", "CSE", "Professor", false),
            ],
            f.PiUserId);

        await act.Should().ThrowAsync<InvalidCommitteeCompositionException>();
    }

    [Fact]
    public async Task SubmitSelectionCommitteeForApprovalAsync_AddsPiAndHod_AndForwardsToDean()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentAsync(f);

        await f.Service.SubmitSelectionCommitteeForApprovalAsync(
            requestId, optionalMember: null, ThreeRecommendedMembers(), f.PiUserId);

        var members = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == requestId && m.Kind == CommitteeKind.Selection)
            .ToListAsync();
        members.Should().Contain(m => m.Role == CommitteeRole.PrincipalInvestigator);
        members.Should().Contain(m => m.Role == CommitteeRole.Chairman);
        members.Count(m => m.Role == CommitteeRole.InternalNominee).Should().Be(3);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        request.SelectionCommitteeWorkflowInstanceId.Should().NotBeNull();

        var instance = await f.WorkflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.WithDeanSelectionCommittee);
    }

    [Fact]
    public async Task SelectSelectionCommitteeMemberAsync_MarksChosenMember_AndApproves()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentAsync(f);
        var recommended = ThreeRecommendedMembers();
        await f.Service.SubmitSelectionCommitteeForApprovalAsync(requestId, null, recommended, f.PiUserId);

        var toSelect = await f.Db.CommitteeMembers.FirstAsync(m =>
            m.RecruitmentRequestId == requestId && m.Role == CommitteeRole.InternalNominee);

        await f.Service.SelectSelectionCommitteeMemberAsync(requestId, toSelect.Id, f.DeanUserId);

        var updated = await f.Db.CommitteeMembers.FirstAsync(m => m.Id == toSelect.Id);
        updated.IsSelectedByDean.Should().BeTrue();

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        var instance = await f.WorkflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.SelectionCommitteeApproved);
    }

    [Fact]
    public async Task ReturnSelectionCommitteeAsync_ThenResubmit_RejoinsAtDeanStage()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentAsync(f);
        var recommended = ThreeRecommendedMembers();
        await f.Service.SubmitSelectionCommitteeForApprovalAsync(requestId, null, recommended, f.PiUserId);

        await f.Service.ReturnSelectionCommitteeAsync(requestId, "Please add a more senior external nominee.", f.DeanUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        var instanceAfterReturn = await f.WorkflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId!.Value);
        instanceAfterReturn!.CurrentStage.Should().Be(WorkflowStage.ReturnedToPISelectionCommittee);

        var revisedRecommended = ThreeRecommendedMembers(); // a different set, simulating the PI's edit
        await f.Service.SubmitSelectionCommitteeForApprovalAsync(requestId, null, revisedRecommended, f.PiUserId);

        var instanceAfterResubmit = await f.WorkflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId!.Value);
        instanceAfterResubmit!.CurrentStage.Should().Be(WorkflowStage.WithDeanSelectionCommittee);
    }

    /// <summary>
    /// Final whole-branch review finding 1: while a Selection Committee
    /// instance is under Dean review (WithDeanSelectionCommittee -- not
    /// returned), a second SubmitSelectionCommitteeForApprovalAsync call
    /// must be rejected before it writes anything, not silently overwrite
    /// the roster the Dean is looking at.
    /// </summary>
    [Fact]
    public async Task SubmitSelectionCommitteeForApprovalAsync_WhileWithDean_ThrowsAndLeavesRosterUnchanged()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentAsync(f);
        var recommended = ThreeRecommendedMembers();
        await f.Service.SubmitSelectionCommitteeForApprovalAsync(requestId, null, recommended, f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        var instance = await f.WorkflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.WithDeanSelectionCommittee);

        var membersBefore = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == requestId && m.Kind == CommitteeKind.Selection)
            .AsNoTracking()
            .ToListAsync();

        var differentRecommended = ThreeRecommendedMembers();
        var act = () => f.Service.SubmitSelectionCommitteeForApprovalAsync(
            requestId, null, differentRecommended, f.PiUserId);

        await act.Should().ThrowAsync<InvalidRecruitmentStageException>();

        var membersAfter = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == requestId && m.Kind == CommitteeKind.Selection)
            .AsNoTracking()
            .ToListAsync();

        membersAfter.Should().BeEquivalentTo(membersBefore);
    }

    /// <summary>
    /// Final whole-branch review finding 2: a repeat call to
    /// SubmitScreeningCommitteeForApprovalAsync (double-click, retry) must
    /// not Raise a second WorkflowInstance -- that would orphan the first
    /// at WithDeanScreeningCommittee and repoint the FK, stranding it.
    /// </summary>
    [Fact]
    public async Task SubmitScreeningCommitteeForApprovalAsync_CalledTwice_DoesNotOrphanTheWorkflowInstance()
    {
        var f = Create();
        var requestId = await RaiseRecruitmentWithProposalAndCoPiAsync(f);

        await f.Service.SubmitScreeningCommitteeForApprovalAsync(requestId, f.PiUserId);
        var requestAfterFirst = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == requestId);
        var instanceIdAfterFirst = requestAfterFirst.ScreeningCommitteeWorkflowInstanceId;
        instanceIdAfterFirst.Should().NotBeNull();

        await f.Service.SubmitScreeningCommitteeForApprovalAsync(requestId, f.PiUserId);
        var requestAfterSecond = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == requestId);

        requestAfterSecond.ScreeningCommitteeWorkflowInstanceId.Should().Be(instanceIdAfterFirst);

        var instanceCount = await f.Db.WorkflowInstances
            .CountAsync(i => i.RequestType == RequestType.ScreeningCommittee && i.RequestId == requestId);
        instanceCount.Should().Be(1);
    }

    [Fact]
    public async Task RecordScreeningResult_Ineligible_ClosesTheApplication()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await ApplyAsync(f, id, applicant);

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Ineligible, "Does not meet minimum qualification."),
            f.PiUserId);

        var candidate = await f.Db.Candidates.FirstAsync(c => c.Id == candidateId);
        candidate.Outcome.Should().Be(CandidateOutcome.NotSelected);
        f.Roles.Deactivated.Should().Contain(applicant);
    }

    [Fact]
    public async Task RecordScreeningResultAsync_IneligibleWithoutRemarks_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        var act = () => f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Ineligible, Remarks: null), f.PiUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RecordScreeningResultAsync_IneligibleWithRemarks_PersistsScreeningRemarks()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Ineligible, Remarks: "Does not meet minimum qualification."),
            f.PiUserId);

        var candidate = await f.Db.Candidates.FirstAsync(c => c.Id == candidateId);
        candidate.ScreeningRemarks.Should().Be("Does not meet minimum qualification.");
        candidate.Remarks.Should().BeNull(); // the pre-existing applicant-submitted field must be untouched
    }

    [Fact]
    public async Task RecordScreeningResultAsync_Eligible_DoesNotRequireRemarks()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        var act = () => f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Eligible), f.PiUserId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendNotEligibleNotificationsAsync_EmailsOnlyUnnotifiedIneligibleCandidates()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var eligibleApplicantId = Guid.NewGuid();
        var eligibleId = await ApplyAsync(f, id, eligibleApplicantId, "Eligible Candidate");
        f.Db.Users.Add(new ApplicationUser
        {
            Id = eligibleApplicantId, FullName = "Eligible Candidate",
            Email = "eligible@mnnit.ac.in", UserName = "eligible_user",
        });

        var ineligibleApplicantId = Guid.NewGuid();
        var ineligibleId = await ApplyAsync(f, id, ineligibleApplicantId, "Ineligible Candidate");
        f.Db.Users.Add(new ApplicationUser
        {
            Id = ineligibleApplicantId, FullName = "Ineligible Candidate",
            Email = "ineligible@mnnit.ac.in", UserName = "ineligible_user",
        });
        await f.Db.SaveChangesAsync();

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(eligibleId, ScreeningResult.Eligible), f.PiUserId);
        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(ineligibleId, ScreeningResult.Ineligible, "Not qualified."), f.PiUserId);

        var notified = await f.Service.SendNotEligibleNotificationsAsync(id, f.PiUserId);

        notified.Should().ContainSingle().Which.Should().Be(ineligibleId);
        var candidate = await f.Db.Candidates.FirstAsync(c => c.Id == ineligibleId);
        candidate.NotEligibleEmailSentAt.Should().NotBeNull();

        f.Mail.Sent.Should().ContainSingle();
        var mail = f.Mail.Sent.Single();
        mail.To.Should().Be("ineligible@mnnit.ac.in");
        mail.Body.Should().Contain("Not qualified.");
    }

    [Fact]
    public async Task SendNotEligibleNotificationsAsync_SecondCall_DoesNotReEmail()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var applicantId = Guid.NewGuid();
        var ineligibleId = await ApplyAsync(f, id, applicantId, "Ineligible Candidate");
        f.Db.Users.Add(new ApplicationUser
        {
            Id = applicantId, FullName = "Ineligible Candidate",
            Email = "ineligible@mnnit.ac.in", UserName = "ineligible_user",
        });
        await f.Db.SaveChangesAsync();

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(ineligibleId, ScreeningResult.Ineligible, "Not qualified."), f.PiUserId);

        await f.Service.SendNotEligibleNotificationsAsync(id, f.PiUserId);
        var secondCall = await f.Service.SendNotEligibleNotificationsAsync(id, f.PiUserId);

        secondCall.Should().BeEmpty();
        f.Mail.Sent.Should().ContainSingle();
    }

    // ------------------------------------------------------------- Task 8

    [Fact]
    public async Task SetInterviewMode_OnlineWithoutDeanApproval_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        var act = () => f.Service.SetInterviewModeAsync(
            new SetInterviewModeInput(candidateId, InterviewMode.Online), f.PiUserId, null);

        await act.Should().ThrowAsync<OnlineInterviewNotApprovedException>();
    }

    [Fact]
    public async Task SetInterviewMode_OnlineWithDeanApproval_RecordsApprover()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());
        var dean = Guid.NewGuid();

        await f.Service.SetInterviewModeAsync(
            new SetInterviewModeInput(candidateId, InterviewMode.Online), f.PiUserId, dean);

        var candidate = await f.Db.Candidates.FirstAsync(c => c.Id == candidateId);
        candidate.InterviewMode.Should().Be(InterviewMode.Online);
        candidate.OnlineModeApprovedByUserId.Should().Be(dean);
    }

    [Fact]
    public async Task SetInterviewMode_EmailSendFails_StillRecordsTheMode()
    {
        // The notification is a side effect of a mode change that has
        // already happened -- SaveChangesAsync runs before the email is
        // ever sent. An unconfigured mailer (the real SmtpEmailSender
        // deliberately throws rather than dropping the message silently)
        // must not turn this already-successful update into an apparent
        // failure for the PI.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());
        var dean = Guid.NewGuid();

        // A PI with a real email address is required to reach the send at
        // all -- the null-email case is already a no-op the current code
        // handles fine, and would not exercise the bug.
        f.Db.Users.Add(new ApplicationUser { Id = f.PiUserId, FullName = "Prof. PI", UserName = "pi_user", Email = "pi@mnnit.ac.in" });
        await f.Db.SaveChangesAsync();

        var interviewModeWorkflow = new WorkflowEngineService(f.Db);
        var interviewModeDepartmentProvider = new StubUserDepartmentProvider();
        var interviewModeProjectService = new ProjectService(
            f.Db, interviewModeWorkflow, new ProjectYearCalculator(), new OverheadSplitValidator(),
            interviewModeDepartmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(f.Db, interviewModeDepartmentProvider),
            new API.Application.Audit.AuditService(f.Db),
            new API.Application.Workflow.WorkflowPendingQueryService(f.Db, new API.Application.Workflow.WorkflowDefinitionService(f.Db)));
        var service = new RecruitmentService(
            f.Db, interviewModeWorkflow, f.Roles, f.Documents,
            new API.Tests.Procurement.StubFacultyProfileProvider(),
            new API.Tests.Procurement.StubDocumentStorageService(),
            new ThrowingEmailSender(),
            TestEmailOptions(),
            new AdvertisementTemplateService(f.Db, new API.Tests.Procurement.StubFacultyProfileProvider()),
            new API.Application.Access.InstituteWideScopeResolver(f.Db, interviewModeDepartmentProvider),
            interviewModeProjectService,
            new WorkflowPendingQueryService(f.Db, new WorkflowDefinitionService(f.Db)));

        await service.SetInterviewModeAsync(
            new SetInterviewModeInput(candidateId, InterviewMode.Online), f.PiUserId, dean);

        var candidate = await f.Db.Candidates.FirstAsync(c => c.Id == candidateId);
        candidate.InterviewMode.Should().Be(InterviewMode.Online);
        candidate.OnlineModeApprovedByUserId.Should().Be(dean);
    }

    [Fact]
    public async Task SubmitSelectionCommittee_EmailSendFails_StillSavesTheCommittee()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var selectionCommitteeWorkflow = new WorkflowEngineService(f.Db);
        var selectionCommitteeDepartmentProvider = new StubUserDepartmentProvider();
        var selectionCommitteeProjectService = new ProjectService(
            f.Db, selectionCommitteeWorkflow, new ProjectYearCalculator(), new OverheadSplitValidator(),
            selectionCommitteeDepartmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(f.Db, selectionCommitteeDepartmentProvider),
            new API.Application.Audit.AuditService(f.Db),
            new API.Application.Workflow.WorkflowPendingQueryService(f.Db, new API.Application.Workflow.WorkflowDefinitionService(f.Db)));
        var service = new RecruitmentService(
            f.Db, selectionCommitteeWorkflow, f.Roles, f.Documents,
            new API.Tests.Procurement.StubFacultyProfileProvider(),
            new API.Tests.Procurement.StubDocumentStorageService(),
            new ThrowingEmailSender(),
            TestEmailOptions(),
            new AdvertisementTemplateService(f.Db, new API.Tests.Procurement.StubFacultyProfileProvider()),
            new API.Application.Access.InstituteWideScopeResolver(f.Db, selectionCommitteeDepartmentProvider),
            selectionCommitteeProjectService,
            new WorkflowPendingQueryService(f.Db, new WorkflowDefinitionService(f.Db)));

        await service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);

        var saved = await f.Db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == id && m.Kind == CommitteeKind.Selection)
            .ToListAsync();
        saved.Should().HaveCount(SelectionCommittee().Count);
    }

    [Fact]
    public async Task SubmitSelectionCommittee_SendsInvitations()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        
        // Seed PI user
        var piUser = new ApplicationUser { Id = f.PiUserId, FullName = "Prof. PI", UserName = "pi_user" };
        f.Db.Users.Add(piUser);
        await f.Db.SaveChangesAsync();

        var members = SelectionCommittee();
        await f.Service.SubmitSelectionCommitteeAsync(id, members, f.PiUserId);

        // SelectionCommittee has 2 nominees (InternalNominee and ExternalNominee).
        // Let's assert that two invitation emails were sent.
        f.Mail.Sent.Should().HaveCount(2);
        
        // Check internal nominee email details
        var internalMail = f.Mail.Sent.FirstOrDefault(m => m.To.Contains("dr.internal"));
        internalMail.Should().NotBeNull();
        internalMail!.Cc.Should().Be(piUser.Email);
        internalMail.Subject.Should().Contain("Invitation to serve on Selection Committee");

        // Check external nominee email details
        var externalMail = f.Mail.Sent.FirstOrDefault(m => m.To.Contains("prof.external"));
        externalMail.Should().NotBeNull();
        externalMail!.Cc.Should().Be(piUser.Email);
        externalMail.Subject.Should().Contain("Invitation to serve on Selection Committee");
    }

    [Fact]
    public async Task SetInterviewMode_OnlineWithDeanApproval_SendsEmail()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var applicantId = Guid.NewGuid();
        var candidateId = await ApplyAsync(f, id, applicantId, "Test Candidate");
        var dean = Guid.NewGuid();

        // Seed PI user and Candidate user
        var piUser = new ApplicationUser { Id = f.PiUserId, FullName = "Prof. PI", Email = "pi@mnnit.ac.in", UserName = "pi_user" };
        var candidateUser = new ApplicationUser { Id = applicantId, FullName = "Test Candidate", Email = "candidate@mnnit.ac.in", UserName = "candidate_user" };
        
        f.Db.Users.AddRange(piUser, candidateUser);
        await f.Db.SaveChangesAsync();

        await f.Service.SetInterviewModeAsync(
            new SetInterviewModeInput(candidateId, InterviewMode.Online), f.PiUserId, dean);

        f.Mail.Sent.Should().ContainSingle();
        var mail = f.Mail.Sent.Single();
        mail.To.Should().Be(piUser.Email);
        mail.Cc.Should().Be(candidateUser.Email);
        mail.Subject.Should().Be("Interview Mode Approved for Candidate Test Candidate");
        mail.Body.Should().Contain("Online");
    }

    [Fact]
    public async Task SubmitMeritList_DuplicateRanks_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var a = await ApplyAsync(f, id, Guid.NewGuid(), "A");
        var b = await ApplyAsync(f, id, Guid.NewGuid(), "B");

        var act = () => f.Service.SubmitMeritListAsync(
            id, [new(a, 1), new(b, 1)], f.PiUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*unique*");
    }

    [Fact]
    public async Task SubmitMeritList_RankingAnIneligibleCandidate_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());
        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(candidateId, ScreeningResult.Ineligible, "Does not meet minimum qualification."),
            f.PiUserId);

        var act = () => f.Service.SubmitMeritListAsync(id, [new(candidateId, 1)], f.PiUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*screened out*");
    }

    [Fact]
    public async Task ApproveMeritListAsync_WithNoDocumentsUploaded_ThrowsNamingAllMissing()
    {
        var f = Create();
        var requestId = await RaiseRequestAtMeritListPreparedAsync(f);

        var act = () => f.Service.ApproveMeritListAsync(requestId, f.DeanUserId);

        var exception = await act.Should().ThrowAsync<MeritListDocumentsMissingException>();
        exception.Which.Message.Should().Contain("SignedMeritList").And.Contain("AttendanceSheet").And.Contain("MinutesOfSelectionScanned");
    }

    [Fact]
    public async Task ApproveMeritListAsync_WithAllThreeDocumentsUploaded_Succeeds()
    {
        var f = Create();
        var requestId = await RaiseRequestAtMeritListPreparedAsync(f);

        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(),
                OwnerType = "RecruitmentRequest",
                OwnerId = requestId,
                Kind = kind,
                Version = 1,
                Status = DocumentStatus.Uploaded,
                StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId,
                UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();

        var act = () => f.Service.ApproveMeritListAsync(requestId, f.DeanUserId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ApproveMeritList_AfterDocumentsUploaded_RaisesWorkflowAndApproves()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);

        var summary = await f.Service.GetAsync(id, f.PiUserId);
        summary.Stage.Should().Be(RecruitmentStage.Approved);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        request.WorkflowInstanceId.Should().NotBeNull();

        var instance = await f.Db.WorkflowInstances
            .FirstAsync(w => w.Id == request.WorkflowInstanceId!.Value);
        instance.RequestType.Should().Be(RequestType.ManpowerDocument);
    }

    /// <summary>
    /// Gets a recruitment request to MeritListPrepared with a non-empty
    /// Selection committee, without uploading any of the gating documents.
    /// </summary>
    private static async Task<Guid> RaiseRequestAtMeritListPreparedAsync(Fixture f, Guid? applicant = null)
    {
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, applicant ?? Guid.NewGuid());
        await f.Service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);
        await f.Service.SubmitMeritListAsync(id, [new(candidateId, 1)], f.PiUserId);
        return id;
    }

    private static async Task<Guid> ApprovedRequestAsync(Fixture f, Guid? applicant = null)
    {
        var id = await RaiseRequestAtMeritListPreparedAsync(f, applicant);

        // Replaces the earlier per-member e-signing requirement: uploading
        // the signed merit list, attendance sheet, and scanned minutes now
        // stands in for "all members signed."
        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(),
                OwnerType = "RecruitmentRequest",
                OwnerId = id,
                Kind = kind,
                Version = 1,
                Status = DocumentStatus.Uploaded,
                StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId,
                UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();

        await f.Service.ApproveMeritListAsync(id, Guid.NewGuid());
        return id;
    }

    /// <summary>
    /// Issues an offer to the given candidate and walks it all the way to
    /// released (OfferIssued) -- IssueOfferLetterAsync, then the offer's
    /// approval chain to WorkflowStage.Approved via
    /// WalkOfferChainToApprovedAsync, then ReleaseOfferLetterAsync.
    /// </summary>
    private static async Task IssueAndReleaseOfferAsync(Fixture f, Guid requestId, Guid candidateId)
    {
        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidateId, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == requestId);
        await WalkOfferChainToApprovedAsync(f, request.OfferWorkflowInstanceId!.Value);

        await f.Service.ReleaseOfferLetterAsync(requestId, Guid.NewGuid());
    }

    /// <summary>
    /// Walks a ManpowerDocument workflow instance from Raised (RaiseAsync's own
    /// initial stage) to Approved, using the SAME 7-stage shipped route
    /// (WorkflowDefinitionSeeder.ShippedRoute) ApproveMeritListAsync's own offer
    /// chain uses. Verified against the engine's real behaviour rather than
    /// assumed: Raised (seq 1, AllowedRoles "") takes a Forward with any actor
    /// role but DOES require a remark (isPiOwnedStage in
    /// WorkflowEngineService.ForwardAsync, since AllowedRoles is empty) ->
    /// SignedCopyUploaded (seq 2, "HOD") -> Assigned (seq 3, "RegularStaff") ->
    /// Forwarded (seq 4, "Superintendent") -> ForwardedOSRC (seq 5,
    /// "DeputyRegistrar") -> ForwardedDR (seq 6, "Dean,Director", CanApprove) --
    /// ApproveAsync from there lands on Approved directly (ForwardedDR's next
    /// stage by sequence, Director, is a separate optional escalation the
    /// engine special-cases away from a plain Approve).
    /// </summary>
    private static async Task WalkOfferChainToApprovedAsync(Fixture f, Guid instanceId)
    {
        await f.WorkflowEngine.ForwardAsync(instanceId, f.PiUserId, ["Faculty"], "Forwarded for approval.", ct: default);
        await f.WorkflowEngine.ForwardAsync(instanceId, Guid.NewGuid(), ["HOD"], "Signed copy uploaded.", ct: default);
        await f.WorkflowEngine.ForwardAsync(instanceId, Guid.NewGuid(), ["RegularStaff"], "Assigned.", ct: default);
        await f.WorkflowEngine.ForwardAsync(instanceId, Guid.NewGuid(), ["Superintendent"], "Forwarded.", ct: default);
        await f.WorkflowEngine.ForwardAsync(instanceId, Guid.NewGuid(), ["DeputyRegistrar"], "Forwarded to Dean.", ct: default);
        await f.WorkflowEngine.ApproveAsync(instanceId, Guid.NewGuid(), ["Dean"], "Approved.", ct: default);
    }

    // -------------------------------------------------------------- Task 5
    // (grant-receipt-approval-workflow) regression: only an Approved receipt
    // may satisfy either payment-received gate in this file -- a receipt
    // still awaiting approval must not unlock either.

    /// <summary>
    /// BRD A2 / spec D7's interview-scheduling gate (ScheduleInterviewAsync).
    /// A PendingApproval receipt must not satisfy it; an Approved one must.
    /// </summary>
    [Fact]
    public async Task ScheduleInterview_PendingApprovalReceipt_Throws_ApprovedReceipt_Succeeds()
    {
        var pending = Create(grantReceiptStatus: GrantReceiptStatus.PendingApproval);
        var pendingId = await AdvertisedRequestAsync(pending);

        var pendingAct = () => pending.Service.ScheduleInterviewAsync(
            new ScheduleInterviewInput(pendingId, new DateOnly(2024, 8, 1), new TimeOnly(10, 30), "Room 101"), pending.PiUserId);

        await pendingAct.Should().ThrowAsync<PaymentNotReceivedException>();

        var approved = Create(grantReceiptStatus: GrantReceiptStatus.Approved);
        var approvedId = await AdvertisedRequestAsync(approved);

        await approved.Service.ScheduleInterviewAsync(
            new ScheduleInterviewInput(approvedId, new DateOnly(2024, 8, 1), new TimeOnly(10, 30), "Room 101"), approved.PiUserId);

        (await approved.Service.GetAsync(approvedId, approved.PiUserId)).Stage
            .Should().Be(RecruitmentStage.SelectionScheduled);
    }

    [Fact]
    public async Task ScheduleInterviewAsync_EmailsOnlyEligibleCandidates()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var eligibleApplicantId = Guid.NewGuid();
        var eligibleId = await ApplyAsync(f, id, eligibleApplicantId, "Eligible Candidate");
        f.Db.Users.Add(new ApplicationUser
        {
            Id = eligibleApplicantId, FullName = "Eligible Candidate",
            Email = "eligible@mnnit.ac.in", UserName = "eligible_user",
        });

        var ineligibleApplicantId = Guid.NewGuid();
        var ineligibleId = await ApplyAsync(f, id, ineligibleApplicantId, "Ineligible Candidate");
        f.Db.Users.Add(new ApplicationUser
        {
            Id = ineligibleApplicantId, FullName = "Ineligible Candidate",
            Email = "ineligible@mnnit.ac.in", UserName = "ineligible_user",
        });
        await f.Db.SaveChangesAsync();

        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(eligibleId, ScreeningResult.Eligible), f.PiUserId);
        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(ineligibleId, ScreeningResult.Ineligible, "Not qualified."), f.PiUserId);

        await f.Service.ScheduleInterviewAsync(
            new ScheduleInterviewInput(id, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)), new TimeOnly(10, 30), "Room 101"),
            f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        request.InterviewTime.Should().Be(new TimeOnly(10, 30));

        f.Mail.Sent.Should().ContainSingle();
        var mail = f.Mail.Sent.Single();
        mail.To.Should().Be("eligible@mnnit.ac.in");
        mail.Subject.Should().Contain("Interview Scheduled");
        mail.Body.Should().Contain("Room 101");
    }

    [Fact]
    public async Task ScheduleInterviewAsync_WithNoEligibleCandidates_NoOpsCleanly()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var act = () => f.Service.ScheduleInterviewAsync(
            new ScheduleInterviewInput(id, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)), new TimeOnly(10, 30), "Room 101"),
            f.PiUserId);

        await act.Should().NotThrowAsync();
        f.Mail.Sent.Should().BeEmpty();
    }

    /// <summary>
    /// BRD A2 / spec D7's offer-letter gate (IssueOfferLetterAsync). A receipt
    /// carrying a transaction reference but still PendingApproval must not
    /// satisfy the gate -- only Status == Approved does.
    /// </summary>
    [Fact]
    public async Task IssueOfferLetter_PendingApprovalReceiptWithTransactionReference_Throws()
    {
        var f = Create(withGrantReceipt: true, withTransactionReference: true,
            grantReceiptStatus: GrantReceiptStatus.PendingApproval);
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        var act = () => f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        await act.Should().ThrowAsync<PaymentNotReceivedException>();
    }

    // ------------------------------------------------------------- Task 9

    /// <summary>BRD A2 / spec D7: no offer until payment has been received.</summary>
    [Fact]
    public async Task IssueOfferLetter_WithoutGrantReceipt_Throws()
    {
        var f = Create(withGrantReceipt: false);
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        var act = () => f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        await act.Should().ThrowAsync<PaymentNotReceivedException>();
    }

    /// <summary>
    /// Payment is an offline NEFT/RTGS transfer, so a receipt row on its own is
    /// not evidence it happened -- the bank's transaction number is.
    /// </summary>
    [Fact]
    public async Task IssueOfferLetter_ReceiptWithoutTransactionReference_Throws()
    {
        var f = Create(withGrantReceipt: true, withTransactionReference: false);
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        var act = () => f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        await act.Should().ThrowAsync<PaymentNotReceivedException>()
            .WithMessage("*transaction reference*");
    }

    [Fact]
    public async Task IssueOfferLetter_WithGrantReceipt_SelectsTheCandidate()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        await WalkOfferChainToApprovedAsync(f, request.OfferWorkflowInstanceId!.Value);
        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        var saved = await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id);
        saved.Outcome.Should().Be(CandidateOutcome.Selected);
        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.OfferIssued);
    }

    [Fact]
    public async Task IssueOfferLetter_ClosesTheOtherCandidates()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var winner = Guid.NewGuid();
        var loser = Guid.NewGuid();
        var winnerCandidate = await ApplyAsync(f, id, winner, "Winner");
        var loserCandidate = await ApplyAsync(f, id, loser, "Loser");

        await f.Service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);
        await f.Service.SubmitMeritListAsync(
            id, [new(winnerCandidate, 1), new(loserCandidate, 2)], f.PiUserId);
        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(),
                OwnerType = "RecruitmentRequest",
                OwnerId = id,
                Kind = kind,
                Version = 1,
                Status = DocumentStatus.Uploaded,
                StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId,
                UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();
        await f.Service.ApproveMeritListAsync(id, Guid.NewGuid());

        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(winnerCandidate, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        await WalkOfferChainToApprovedAsync(f, request.OfferWorkflowInstanceId!.Value);
        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        (await f.Db.Candidates.FirstAsync(c => c.Id == loserCandidate)).Outcome
            .Should().Be(CandidateOutcome.NotSelected);
        f.Roles.Deactivated.Should().Contain(loser);
        f.Roles.Deactivated.Should().NotContain(winner);
    }

    [Fact]
    public async Task IssueOfferLetterAsync_WithGrantReceipt_RaisesApprovalChainInsteadOfIssuing()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        // ApprovedRequestAsync's own selection-committee invitations are
        // unrelated to this action; only what IssueOfferLetterAsync itself
        // sends is under test here.
        f.Mail.Sent.Clear();

        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        request.Stage.Should().Be(RecruitmentStage.OfferPendingApproval);
        request.OfferWorkflowInstanceId.Should().NotBeNull();

        // Not issued yet: Outcome is unchanged, no email sent, other candidates
        // still Pending.
        var saved = await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id);
        saved.Outcome.Should().Be(CandidateOutcome.Pending);
        f.Mail.Sent.Should().BeEmpty();
    }

    [Fact]
    public async Task ReleaseOfferLetterAsync_BeforeChainApproved_Throws()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var act = () => f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<OfferNotApprovedException>();
    }

    [Fact]
    public async Task ReleaseOfferLetterAsync_AfterChainApproved_IssuesTheOfferAndEmails()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidateEmail = "winner@mnnit.ac.in";
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        var applicantUserId = (await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id)).ApplicationUserId;
        f.Db.Users.Add(new ApplicationUser { Id = applicantUserId, FullName = "Winner", Email = candidateEmail, UserName = "winner_user" });
        await f.Db.SaveChangesAsync();

        // ApprovedRequestAsync's own selection-committee invitations are
        // unrelated to this action; only what ReleaseOfferLetterAsync itself
        // sends is under test here.
        f.Mail.Sent.Clear();

        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        var instanceId = request.OfferWorkflowInstanceId!.Value;
        await WalkOfferChainToApprovedAsync(f, instanceId);

        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        var savedCandidate = await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id);
        savedCandidate.Outcome.Should().Be(CandidateOutcome.Selected);
        var savedRequest = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        savedRequest.Stage.Should().Be(RecruitmentStage.OfferIssued);
        f.Mail.Sent.Should().ContainSingle();
        f.Mail.Sent.Single().To.Should().Be(candidateEmail);
    }

    [Fact]
    public async Task AcceptOfferAsync_ByTheOfferedCandidate_Succeeds()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        var applicantUserId = (await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id)).ApplicationUserId;
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);

        await f.Service.AcceptOfferAsync(candidate.Id, applicantUserId);

        var saved = await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id);
        saved.OfferResponse.Should().Be(CandidateOfferResponse.Accepted);
        saved.Outcome.Should().Be(CandidateOutcome.Selected); // unchanged
        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.OfferIssued); // unchanged
    }

    [Fact]
    public async Task ListCandidatesAsync_AfterAccept_ShowsOfferResponse()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        var applicantUserId = (await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id)).ApplicationUserId;
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);

        await f.Service.AcceptOfferAsync(candidate.Id, applicantUserId);

        var summary = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        summary.OfferResponse.Should().Be(CandidateOfferResponse.Accepted);
    }

    [Fact]
    public async Task AcceptOfferAsync_ByADifferentApplicant_Throws()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);

        var act = () => f.Service.AcceptOfferAsync(candidate.Id, Guid.NewGuid());

        await act.Should().ThrowAsync<CandidateApplicationNotOwnedException>();
    }

    [Fact]
    public async Task DeclineOfferAsync_ReopensOtherCandidatesAndReturnsRequestToApproved()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var winnerApplicant = Guid.NewGuid();
        var loserApplicant = Guid.NewGuid();
        var winnerCandidate = await ApplyAsync(f, id, winnerApplicant, "Winner");
        var loserCandidate = await ApplyAsync(f, id, loserApplicant, "Loser");
        await f.Service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);
        await f.Service.SubmitMeritListAsync(id, [new(winnerCandidate, 1), new(loserCandidate, 2)], f.PiUserId);
        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(), OwnerType = "RecruitmentRequest", OwnerId = id, Kind = kind,
                Version = 1, Status = DocumentStatus.Uploaded, StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId, UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();
        await f.Service.ApproveMeritListAsync(id, Guid.NewGuid());
        await IssueAndReleaseOfferAsync(f, id, winnerCandidate);

        await f.Service.DeclineOfferAsync(winnerCandidate, winnerApplicant);

        var savedWinner = await f.Db.Candidates.FirstAsync(c => c.Id == winnerCandidate);
        savedWinner.OfferResponse.Should().Be(CandidateOfferResponse.Declined);
        savedWinner.Outcome.Should().Be(CandidateOutcome.NotSelected);
        f.Roles.Deactivated.Should().Contain(winnerApplicant);

        var savedLoser = await f.Db.Candidates.FirstAsync(c => c.Id == loserCandidate);
        savedLoser.Outcome.Should().Be(CandidateOutcome.Pending); // reopened
        f.Roles.Reactivated.Should().Contain(loserApplicant);

        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.Approved);
    }

    /// <summary>
    /// Regression coverage found by task review: CandidateOutcome.NotSelected
    /// has two producers -- losing an offer round (CloseUnsuccessfulCandidatesAsync)
    /// and being screened out as Ineligible (RecordScreeningResultAsync). A
    /// decline must only ever reopen the former, never resurrect a
    /// screened-out candidate into a re-selectable Pending state.
    /// </summary>
    [Fact]
    public async Task DeclineOfferAsync_DoesNotReopenAScreenedOutCandidate()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var winnerApplicant = Guid.NewGuid();
        var ineligibleApplicant = Guid.NewGuid();
        var winnerCandidate = await ApplyAsync(f, id, winnerApplicant, "Winner");
        var ineligibleCandidate = await ApplyAsync(f, id, ineligibleApplicant, "Ineligible");
        await f.Service.RecordScreeningResultAsync(
            new RecordScreeningInput(ineligibleCandidate, ScreeningResult.Ineligible, "Not qualified."), f.PiUserId);
        await f.Service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);
        await f.Service.SubmitMeritListAsync(id, [new(winnerCandidate, 1)], f.PiUserId);
        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(), OwnerType = "RecruitmentRequest", OwnerId = id, Kind = kind,
                Version = 1, Status = DocumentStatus.Uploaded, StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId, UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();
        await f.Service.ApproveMeritListAsync(id, Guid.NewGuid());
        await IssueAndReleaseOfferAsync(f, id, winnerCandidate);

        // ApplyAsync itself reactivates on submission (reviving an account
        // soft-deleted after an earlier, unrelated rejection) -- clear that
        // noise so the assertion below isolates what DeclineOfferAsync
        // itself does, not what happened during setup.
        f.Roles.Reactivated.Clear();

        await f.Service.DeclineOfferAsync(winnerCandidate, winnerApplicant);

        var savedIneligible = await f.Db.Candidates.FirstAsync(c => c.Id == ineligibleCandidate);
        savedIneligible.Outcome.Should().Be(CandidateOutcome.NotSelected); // still rejected, not reopened
        f.Roles.Reactivated.Should().NotContain(ineligibleApplicant);
    }

    [Fact]
    public async Task DeclineOfferAsync_ThenReIssueOffer_SetsPendingOfferCandidateIdToTheNewChoice()
    {
        // Regression coverage for the PendingOfferCandidateId lifecycle gap this
        // task's brief was updated to address: confirms a re-offer round after a
        // decline correctly overwrites the stale/null PendingOfferCandidateId
        // with the newly-chosen candidate, not a leftover value from round 1.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var winnerApplicant = Guid.NewGuid();
        var loserApplicant = Guid.NewGuid();
        var winnerCandidate = await ApplyAsync(f, id, winnerApplicant, "Winner");
        var loserCandidate = await ApplyAsync(f, id, loserApplicant, "Loser");
        await f.Service.SubmitSelectionCommitteeAsync(id, SelectionCommittee(), f.PiUserId);
        await f.Service.SubmitMeritListAsync(id, [new(winnerCandidate, 1), new(loserCandidate, 2)], f.PiUserId);
        foreach (var kind in new[] { DocumentKind.SignedMeritList, DocumentKind.AttendanceSheet, DocumentKind.MinutesOfSelectionScanned })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(), OwnerType = "RecruitmentRequest", OwnerId = id, Kind = kind,
                Version = 1, Status = DocumentStatus.Uploaded, StoragePath = $"test/{kind}",
                UploadedByUserId = f.PiUserId, UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();
        await f.Service.ApproveMeritListAsync(id, Guid.NewGuid());
        await IssueAndReleaseOfferAsync(f, id, winnerCandidate);
        await f.Service.DeclineOfferAsync(winnerCandidate, winnerApplicant);

        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(loserCandidate, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        request.PendingOfferCandidateId.Should().Be(loserCandidate);
    }

    [Fact]
    public async Task MarkNoCandidateAcceptedAsync_FromApproved_Succeeds()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);

        await f.Service.MarkNoCandidateAcceptedAsync(id, Guid.NewGuid());

        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.NoCandidateAccepted);
    }

    [Fact]
    public async Task RecordJoining_CreatesFellowAndPromotesRole()
    {
        var f = Create();
        var applicant = Guid.NewGuid();
        var id = await ApprovedRequestAsync(f, applicant);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);
        await WalkOfferChainToApprovedAsync(
            f, (await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id)).OfferWorkflowInstanceId!.Value);
        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        var selectionId = await f.Service.RecordJoiningAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 8, 31),
                31_000m, null, null, null, null, null, null),
            f.PiUserId);

        var selection = await f.Db.ManpowerSelections.FirstAsync(s => s.Id == selectionId);
        selection.ApplicationUserId.Should().Be(applicant);
        selection.IdCardIssuedAt.Should().BeNull("the ID card is issued separately");

        f.Roles.PromotedToFellow.Should().Contain(applicant);
        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.Joined);
    }

    /// <summary>
    /// SubmitJoiningReportAsync/GetJoiningReportAsync is the PI-submit ->
    /// HOD/Dean-review path (distinct from RecordJoiningAsync above, which
    /// jumps straight to Joined) -- the one RecruitmentDetailPage.jsx's
    /// joining panel now drives. Before this fix, HOD/Dean had no way to read
    /// back what the PI submitted at all; it lived only in the PI's own
    /// browser localStorage.
    /// </summary>
    [Fact]
    public async Task SubmitJoiningReport_ThenGetJoiningReport_ReturnsWhatThePiSubmitted()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f, Guid.NewGuid());
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);
        await WalkOfferChainToApprovedAsync(
            f, (await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id)).OfferWorkflowInstanceId!.Value);
        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());

        (await f.Service.GetJoiningReportAsync(candidate.Id)).Should().BeNull(
            "nothing has been submitted yet");

        await UploadRequiredJoiningDocumentsAsync(f, candidate.Id);
        await f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(
                candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 8, 31), 31_000m,
                "1234-5678-9012", "ABCDE1234F", "9876543210", "SBIN0001234",
                new DateOnly(1998, 4, 12), Gender.Male),
            f.PiUserId);

        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.JoiningPendingHOD);

        var report = await f.Service.GetJoiningReportAsync(candidate.Id);
        report.Should().NotBeNull();
        report!.AadharNo.Should().Be("1234-5678-9012");
        report.PanNo.Should().Be("ABCDE1234F");
        report.BankAccountNo.Should().Be("9876543210");
        report.IfscCode.Should().Be("SBIN0001234");
        report.RecommendedStipend.Should().Be(31_000m);
    }

    [Fact]
    public async Task RecordJoining_BeforeSelection_Throws()
    {
        // A regression briefly removed this precondition (RecordJoiningAsync
        // silently self-selected the candidate instead), which let a PI
        // record a joining -- and so promote an Applicant to Fellow -- for
        // anyone still Pending, skipping IssueOfferLetterAsync's payment-
        // received check (BRD A2 spec D7) entirely.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        var candidateId = await ApplyAsync(f, id, Guid.NewGuid());

        var act = () => f.Service.RecordJoiningAsync(
            new RecordJoiningInput(candidateId, new DateOnly(2024, 9, 1), new DateOnly(2025, 8, 31),
                31_000m, null, null, null, null, null, null),
            f.PiUserId);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*not been selected*");
    }

    /// <summary>The gate Phase 6's leave module consumes (spec D4).</summary>
    [Fact]
    public async Task IssueIdCard_SetsTheGate()
    {
        var f = Create();
        var applicant = Guid.NewGuid();
        var id = await ApprovedRequestAsync(f, applicant);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await f.Service.IssueOfferLetterAsync(
            new IssueOfferInput(candidate.Id, 31_000m, new DateOnly(2024, 9, 1)), f.PiUserId);
        await WalkOfferChainToApprovedAsync(
            f, (await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id)).OfferWorkflowInstanceId!.Value);
        await f.Service.ReleaseOfferLetterAsync(id, Guid.NewGuid());
        var selectionId = await f.Service.RecordJoiningAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 8, 31),
                31_000m, null, null, null, null, null, null),
            f.PiUserId);

        await f.Service.IssueIdCardAsync(new IssueIdCardInput(selectionId, "MNNIT/JRF/001"), f.PiUserId);

        var selection = await f.Db.ManpowerSelections.FirstAsync(s => s.Id == selectionId);
        selection.IdCardNumber.Should().Be("MNNIT/JRF/001");
        selection.IdCardIssuedAt.Should().NotBeNull();
    }

    /// <summary>
    /// Uploads both of the Fellow's required joining documents
    /// (SignedOfferLetter, ContractOfEngagement) against their own Candidate
    /// row -- the shared setup SubmitJoiningReportAsync now requires before
    /// it will even accept the joining report.
    /// </summary>
    private static async Task UploadRequiredJoiningDocumentsAsync(Fixture f, Guid candidateId)
    {
        foreach (var kind in new[] { DocumentKind.SignedOfferLetter, DocumentKind.ContractOfEngagement })
        {
            f.Db.Documents.Add(new Document
            {
                Id = Guid.NewGuid(), OwnerType = "Candidate", OwnerId = candidateId,
                Kind = kind, Version = 1, Status = DocumentStatus.Uploaded,
                StoragePath = $"test/{kind}", UploadedByUserId = f.PiUserId, UploadedAt = DateTimeOffset.UtcNow,
            });
        }
        await f.Db.SaveChangesAsync();
    }

    [Fact]
    public async Task SubmitJoiningReportAsync_WithoutRequiredDocumentsUploaded_ThrowsNamingThem()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);

        var act = () => f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            f.PiUserId);

        var exception = await act.Should().ThrowAsync<JoiningDocumentsMissingException>();
        exception.Which.Message.Should().Contain("SignedOfferLetter").And.Contain("ContractOfEngagement");
    }

    [Fact]
    public async Task SubmitJoiningReportAsync_WithOnlyOneOfTheTwoRequiredDocuments_ThrowsNamingTheMissingOne()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);
        f.Db.Documents.Add(new Document
        {
            Id = Guid.NewGuid(), OwnerType = "Candidate", OwnerId = candidate.Id,
            Kind = DocumentKind.SignedOfferLetter, Version = 1, Status = DocumentStatus.Uploaded,
            StoragePath = "test/offer", UploadedByUserId = f.PiUserId, UploadedAt = DateTimeOffset.UtcNow,
        });
        await f.Db.SaveChangesAsync();

        var act = () => f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            f.PiUserId);

        var exception = await act.Should().ThrowAsync<JoiningDocumentsMissingException>();
        exception.Which.Message.Should().Contain("ContractOfEngagement").And.NotContain("SignedOfferLetter");
    }

    [Fact]
    public async Task SubmitJoiningReportAsync_WithBothRequiredDocumentsUploaded_Succeeds()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);
        await UploadRequiredJoiningDocumentsAsync(f, candidate.Id);

        var act = () => f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            f.PiUserId);

        await act.Should().NotThrowAsync();
        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.JoiningSubmitted);
    }

    /// <summary>
    /// The candidate-facing counterpart -- SubmitOwnJoiningReportAsync shares
    /// SaveJoiningReportAsync with the PI-facing path, so the same gate
    /// applies regardless of which caller submits.
    /// </summary>
    [Fact]
    public async Task SubmitOwnJoiningReportAsync_WithoutRequiredDocumentsUploaded_Throws()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        var applicantUserId = (await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id)).ApplicationUserId;
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);

        var act = () => f.Service.SubmitOwnJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            applicantUserId);

        await act.Should().ThrowAsync<JoiningDocumentsMissingException>();
    }

    [Fact]
    public async Task ApproveJoiningReportAsync_WithoutRequiredDocuments_ThrowsAsADefenseInDepthCheck()
    {
        // Simulates a Document row deleted after submission (or a joining
        // record predating this gate) -- ApproveJoiningReportAsync must not
        // trust that submission-time enforcement always ran.
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);
        await UploadRequiredJoiningDocumentsAsync(f, candidate.Id);
        await f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            f.PiUserId);
        await f.Service.ForwardJoiningReportToHodAsync(candidate.Id, "Forwarded.", f.PiUserId);
        await f.Service.ForwardJoiningReportAsync(candidate.Id, "Forwarded to Dean.", Guid.NewGuid());

        f.Db.Documents.RemoveRange(f.Db.Documents.Where(d => d.OwnerType == "Candidate" && d.OwnerId == candidate.Id));
        await f.Db.SaveChangesAsync();

        var act = () => f.Service.ApproveJoiningReportAsync(candidate.Id, "Approved.", Guid.NewGuid());

        var exception = await act.Should().ThrowAsync<JoiningDocumentsMissingException>();
        exception.Which.Message.Should().Contain("SignedOfferLetter").And.Contain("ContractOfEngagement");
    }

    [Fact]
    public async Task ApproveJoiningReportAsync_WithRequiredDocumentsStillUploaded_Succeeds()
    {
        var f = Create();
        var id = await ApprovedRequestAsync(f);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();
        await IssueAndReleaseOfferAsync(f, id, candidate.Id);
        await UploadRequiredJoiningDocumentsAsync(f, candidate.Id);
        await f.Service.SubmitJoiningReportAsync(
            new RecordJoiningInput(candidate.Id, new DateOnly(2024, 9, 1), new DateOnly(2025, 9, 1), 31_000m, null, null, null, null, null, null),
            f.PiUserId);
        await f.Service.ForwardJoiningReportToHodAsync(candidate.Id, "Forwarded.", f.PiUserId);
        await f.Service.ForwardJoiningReportAsync(candidate.Id, "Forwarded to Dean.", Guid.NewGuid());

        var act = () => f.Service.ApproveJoiningReportAsync(candidate.Id, "Approved.", Guid.NewGuid());

        await act.Should().NotThrowAsync();
        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.Joined);
    }

    // ------------------------------------------------------------- Documents

    [Fact]
    public async Task GenerateDocument_Advertisement_RendersAndNamesTheFile()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var doc = await f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.Advertisement, f.PiUserId);

        doc.Content.Should().NotBeEmpty();
        doc.FileName.Should().Be($"advertisement-{id}.pdf");
        f.Documents.Generated.Should().Contain("GenerateAdvertisementAsync");
    }

    /// <summary>
    /// The offer and joining letters are per candidate, so they cannot be
    /// produced before someone has been selected.
    /// </summary>
    [Fact]
    public async Task GenerateDocument_OfferLetterBeforeSelection_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var act = () => f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.OfferLetter, f.PiUserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No candidate has been selected*");
    }

    [Fact]
    public async Task GenerateDocument_OfferLetterWithManualOverrides_StillRequiresASelectedCandidate()
    {
        // A regression let manual overrides (candidate name/amount typed
        // into the download form) build and "generate" an offer letter for
        // any recruitment at all -- no selected candidate, no payment
        // check -- since this branch never touched the no-overrides path's
        // selection guard. The overrides exist to correct display details
        // on a real offer, not to conjure one.
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var overrides = new OfferLetterManualOverrides(
            "Manually Typed Name", null, null, null, null, null, 31_000m, null, new DateOnly(2024, 9, 1));

        var act = () => f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.OfferLetter, f.PiUserId, overrides: overrides);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No candidate has been selected*");
    }

    [Fact]
    public async Task GenerateDocument_OfferLetter_DoesNotAdvanceStageAsASideEffect()
    {
        // A regression advanced RecruitmentStage to OfferIssued purely as a
        // side effect of generating the PDF -- reachable via the manual-
        // overrides path with no payment ever recorded. OfferIssued must
        // only ever be a consequence of IssueOfferLetterAsync itself
        // running (which checks for a grant receipt with a transaction
        // reference, BRD A2 spec D7), not of downloading a document.
        var f = Create(withGrantReceipt: false);
        var applicant = Guid.NewGuid();
        var id = await ApprovedRequestAsync(f, applicant);
        var candidate = (await f.Service.ListCandidatesAsync(id, f.PiUserId)).Single();

        // Bypass IssueOfferLetterAsync entirely -- simulates whatever path
        // might reach GenerateDocumentAsync with a Selected candidate
        // already on record but no payment ever having been checked.
        var entity = await f.Db.Candidates.FirstAsync(c => c.Id == candidate.Id);
        entity.Outcome = CandidateOutcome.Selected;
        await f.Db.SaveChangesAsync();

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.OfferLetter, f.PiUserId);

        (await f.Service.GetAsync(id, f.PiUserId)).Stage.Should().Be(RecruitmentStage.Approved,
            "generating a document must never itself advance the recruitment's stage");
    }

    [Fact]
    public async Task GenerateDocument_ForAnotherUsersProject_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var act = () => f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.Advertisement, Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    // ------------------------------------------------------------- Ownership

    [Fact]
    public async Task CreateAsync_ForAnotherUsersProject_Throws()
    {
        var f = Create();

        var act = () => f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task ListCandidates_ForAnotherUsersProject_Throws()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);

        var act = () => f.Service.ListCandidatesAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    // -------------------------------------------------------------- ListOwn

    [Fact]
    public async Task ListOwnAsync_ReturnsRecruitmentsAcrossAllOfThePisProjects()
    {
        var f = Create();
        var firstId = await AdvertisedRequestAsync(f);

        var secondProjectId = Guid.NewGuid();
        var secondPositionId = Guid.NewGuid();
        f.Db.Projects.Add(new Project
        {
            Id = secondProjectId,
            OwnerUserId = f.PiUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-R2",
            SanctionDate = ProjectStart,
            ProjectTitle = "Second Recruitment Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        f.Db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = secondPositionId,
            ProjectId = secondProjectId,
            Designation = "Research Associate",
            Positions = 1,
            Stipend = 42_000m,
            Hra = 0m,
        });
        await f.Db.SaveChangesAsync();

        var secondId = await f.Service.CreateAsync(
            new CreateRecruitmentInput(secondProjectId, secondPositionId), f.PiUserId);

        var own = await f.Service.ListOwnAsync(f.PiUserId);

        own.Select(r => r.Id).Should().BeEquivalentTo([firstId, secondId]);
    }

    [Fact]
    public async Task ListOwnAsync_ExcludesRecruitmentsOnAnotherPisProjects()
    {
        var f = Create();
        await AdvertisedRequestAsync(f);

        var own = await f.Service.ListOwnAsync(Guid.NewGuid());

        own.Should().BeEmpty();
    }
}
