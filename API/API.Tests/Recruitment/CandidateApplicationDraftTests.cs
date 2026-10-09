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
/// The application wizard's step-scoped save endpoints, submit gate, and
/// full-copy prefill. Covers the applicant-scoped draft loader
/// (LoadOwnDraftAsync) that -- unlike LoadCandidateForPiAsync and
/// LoadSubmittedCandidateAsync -- permits Draft rows and checks applicant
/// ownership rather than PI ownership.
/// </summary>
public class CandidateApplicationDraftTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

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
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-WIZ1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Application Wizard Project",
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
            TransactionReference = "NEFT-SBIN0007654321",
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

        return new Fixture(db, service, roles, piUserId, projectId, positionId);
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

    /// <summary>
    /// The minimum Step 1 SubmitDraftAsync now insists on (full name + mobile),
    /// so tests about everything OTHER than the completeness gate can still get
    /// a draft submitted.
    /// </summary>
    private static Task FillMinimumStep1Async(Fixture f, Guid candidateId, Guid applicant) =>
        f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "Ana Rao", "9990001111", null, null, null,
                null, null, null, null, null, null, null, null, null, null),
            applicant);

    private static async Task<Guid> SubmittableDraftAsync(Fixture f, Guid requestId, Guid applicant)
    {
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);
        await FillMinimumStep1Async(f, candidateId, applicant);
        var cand = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        cand.SignatureDocumentId = Guid.NewGuid();
        // RecruitmentRequest.RequireResume defaults to true, so SubmitDraftAsync's
        // completeness gate also requires ResumeDocumentId.
        cand.ResumeDocumentId = Guid.NewGuid();
        await f.Db.SaveChangesAsync();
        return candidateId;
    }

    // ------------------------------------------------ StartOrResumeDraftAsync

    [Fact]
    public async Task StartOrResumeDraftAsync_NoExistingDraft_CreatesANewOne()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        candidateId.Should().NotBeEmpty();
        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Draft);
        stored.ApplicationUserId.Should().Be(applicant);
        stored.RecruitmentRequestId.Should().Be(requestId);
    }

    [Fact]
    public async Task StartOrResumeDraftAsync_ExistingDraft_ReturnsTheSameId()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        var first = await f.Service.StartOrResumeDraftAsync(requestId, applicant);
        var second = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        second.Should().Be(first);
        (await f.Db.Candidates.CountAsync(c => c.RecruitmentRequestId == requestId
            && c.ApplicationUserId == applicant)).Should().Be(1);
    }

    [Fact]
    public async Task StartOrResumeDraftAsync_ExistingSubmittedApplication_ThrowsDuplicateApplication()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        f.Roles.ConfirmedEmails.Add(applicant);
        await f.Service.ApplyAsync(
            new ApplyInput(requestId, "Ana Rao", "9990001111", "M.Tech", "1 year", null), applicant);

        var act = () => f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await act.Should().ThrowAsync<DuplicateApplicationException>();
    }

    // ------------------------------------------------------------ Step saves

    [Fact]
    public async Task SaveStep1PersonalAsync_OnAnotherApplicantsDraft_ThrowsCandidateDraftNotOwned()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, owner);

        var act = () => f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "Stranger Name", "9998887777", null, null, null,
                null, null, null, null, null, null, null, null, null, null),
            stranger);

        await act.Should().ThrowAsync<CandidateDraftNotOwnedException>();
    }

    [Fact]
    public async Task SaveStep1PersonalAsync_OnAnAlreadySubmittedCandidate_ThrowsCandidateAlreadySubmitted()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await SubmittableDraftAsync(f, requestId, applicant);
        await f.Service.SubmitDraftAsync(candidateId, applicant);

        var act = () => f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "New Name", "9998887777", null, null, null,
                null, null, null, null, null, null, null, null, null, null),
            applicant);

        await act.Should().ThrowAsync<CandidateAlreadySubmittedException>();
    }

    [Fact]
    public async Task SaveStep1PersonalAsync_OnOwnDraft_PersistsTheFields()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "Ana Rao", "9990001111", Gender.Female, false,
                new DateOnly(1998, 4, 12), "Rao Sr.", "123 Main St", "456 Home St",
                "ana@example.com", "Indian", CandidateCategory.OBC, null, null, null, null),
            applicant);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.FullName.Should().Be("Ana Rao");
        stored.Mobile.Should().Be("9990001111");
        stored.Gender.Should().Be(Gender.Female);
        stored.Category.Should().Be(CandidateCategory.OBC);
    }

    [Fact]
    public async Task SaveStep2QualificationsAsync_ReplacesEducationRowsEntirely()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                candidateId, true, "GATE12345", 2023, "750",
                [
                    new CandidateEducationInput(null, EducationLevel.Tenth, null, null, "CBSE Board", 2012, "92%", null, null),
                    new CandidateEducationInput(null, EducationLevel.Undergraduate, null, "CSE", "MNNIT", 2020, "8.5", "First", null),
                ]),
            applicant);

        var oldRowIds = await f.Db.CandidateEducations
            .Where(e => e.CandidateId == candidateId).Select(e => e.Id).ToListAsync();
        oldRowIds.Should().HaveCount(2);

        // Second save: hand back a totally different set of rows.
        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                candidateId, false, null, null, null,
                [
                    new CandidateEducationInput(null, EducationLevel.Postgraduate, null, "CSE", "IIT", 2022, "9.1", "First", null),
                ]),
            applicant);

        var updated = await f.Db.Candidates
            .Include(c => c.Education)
            .AsNoTracking()
            .FirstAsync(c => c.Id == candidateId);

        updated.Education.Should().ContainSingle();
        updated.Education[0].Level.Should().Be(EducationLevel.Postgraduate);
        updated.Education.Select(e => e.Id).Should().NotIntersectWith(oldRowIds);
        (await f.Db.CandidateEducations.AnyAsync(e => oldRowIds.Contains(e.Id))).Should().BeFalse();
    }

    [Fact]
    public async Task SaveStep3ExperienceAsync_ReplacesExperienceRowsEntirely()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                candidateId,
                [
                    new CandidateExperienceInput(null, 1, "Org A", "Engineer", "50000", "Dev", "Full-time", 1, 2, 0, null),
                ]),
            applicant);

        var oldRowIds = await f.Db.CandidateExperiences
            .Where(x => x.CandidateId == candidateId).Select(x => x.Id).ToListAsync();
        oldRowIds.Should().ContainSingle();

        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                candidateId,
                [
                    new CandidateExperienceInput(null, 1, "Org B", "Senior Engineer", "70000", "Lead", "Full-time", 2, 0, 0, null),
                    new CandidateExperienceInput(null, 2, "Org C", "Consultant", "80000", "Advisory", "Part-time", 0, 6, 0, null),
                ]),
            applicant);

        var updated = await f.Db.Candidates
            .Include(c => c.Experiences)
            .AsNoTracking()
            .FirstAsync(c => c.Id == candidateId);

        updated.Experiences.Should().HaveCount(2);
        updated.Experiences.Select(x => x.Id).Should().NotIntersectWith(oldRowIds);
        (await f.Db.CandidateExperiences.AnyAsync(x => oldRowIds.Contains(x.Id))).Should().BeFalse();
    }

    // -------------------------------------------------------------- Submit

    [Fact]
    public async Task SubmitDraftAsync_FlipsStatusAndSetsDeclarationAcceptedAt()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await SubmittableDraftAsync(f, requestId, applicant);

        var before = DateTimeOffset.UtcNow;
        await f.Service.SubmitDraftAsync(candidateId, applicant);
        var after = DateTimeOffset.UtcNow;

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Submitted);
        stored.DeclarationAcceptedAt.Should().NotBeNull();
        stored.DeclarationAcceptedAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task SubmitDraftAsync_OnAnotherApplicantsDraft_ThrowsCandidateDraftNotOwned()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, owner);

        var act = () => f.Service.SubmitDraftAsync(candidateId, stranger);

        await act.Should().ThrowAsync<CandidateDraftNotOwnedException>();
    }

    [Fact]
    public async Task SubmitDraftAsync_UnknownCandidateId_ThrowsCandidateDraftNotFound()
    {
        var f = Create();

        var act = () => f.Service.SubmitDraftAsync(Guid.NewGuid(), Guid.NewGuid());

        await act.Should().ThrowAsync<CandidateDraftNotFoundException>();
    }

    [Fact]
    public async Task SubmitDraftAsync_WithAPhotoDocumentId_PersistsItOnTheCandidate()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await SubmittableDraftAsync(f, requestId, applicant);
        var photoId = Guid.NewGuid();

        await f.Service.SubmitDraftAsync(candidateId, applicant, photoId);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.PhotoDocumentId.Should().Be(photoId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Submitted);
    }

    [Fact]
    public async Task SubmitDraftAsync_WithoutAPhotoDocumentId_LeavesAnExistingPhotoIntact()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await SubmittableDraftAsync(f, requestId, applicant);
        var photoId = Guid.NewGuid();

        var draft = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        draft.PhotoDocumentId = photoId;
        await f.Db.SaveChangesAsync();

        await f.Service.SubmitDraftAsync(candidateId, applicant, photoDocumentId: null);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.PhotoDocumentId.Should().Be(photoId);
    }

    /// <summary>
    /// Final-review finding 3: StartOrResumeDraftAsync seeds FullName/Mobile as
    /// empty placeholders, so a start-draft immediately followed by a submit
    /// would otherwise mint a nameless "Submitted" application straight into the
    /// PI's candidate table, screening list, and generated documents.
    /// </summary>
    [Fact]
    public async Task SubmitDraftAsync_OnAnEmptyDraft_ThrowsIncompleteApplicationAndLeavesItADraft()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        var act = () => f.Service.SubmitDraftAsync(candidateId, applicant);

        (await act.Should().ThrowAsync<IncompleteApplicationException>())
            .Which.Message.Should().Contain("full name").And.Contain("mobile number");

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Draft);
        stored.DeclarationAcceptedAt.Should().BeNull();

        // And the half-made row stays invisible to the PI-facing lifecycle.
        (await f.Service.ListCandidatesAsync(requestId, f.PiUserId)).Should().BeEmpty();
    }

    [Fact]
    public async Task SubmitDraftAsync_WithAWhitespaceOnlyMobile_IsStillRejected()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "Ana Rao", "   ", null, null, null,
                null, null, null, null, null, null, null, null, null, null),
            applicant);

        var act = () => f.Service.SubmitDraftAsync(candidateId, applicant);

        (await act.Should().ThrowAsync<IncompleteApplicationException>())
            .Which.Message.Should().Contain("mobile number").And.NotContain("full name");

        (await f.Db.Candidates.SingleAsync(c => c.Id == candidateId))
            .ApplicationStatus.Should().Be(ApplicationStatus.Draft);
    }

    /// <summary>
    /// Regression for the same finding: a draft that HAS been through Step 1
    /// still submits, and lands in the PI's candidate list as a real applicant.
    /// </summary>
    [Fact]
    public async Task SubmitDraftAsync_OnAProperlyFilledDraft_StillSucceedsAndReachesThePi()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await SubmittableDraftAsync(f, requestId, applicant);

        await f.Service.SubmitDraftAsync(candidateId, applicant);

        var stored = await f.Db.Candidates.SingleAsync(c => c.Id == candidateId);
        stored.ApplicationStatus.Should().Be(ApplicationStatus.Submitted);

        var forPi = await f.Service.ListCandidatesAsync(requestId, f.PiUserId);
        forPi.Should().ContainSingle().Which.Id.Should().Be(candidateId);
    }

    // ------------------------------------------------------- GetOwnDraftAsync

    /// <summary>
    /// Guards CandidateDraftDetail's ~29-argument positional projection: many of
    /// its parameters share a type (several string?s and ints in a row), so a
    /// transposed pair would compile silently. Every scalar is given a value
    /// distinct from every other same-typed scalar, and each is asserted by name.
    /// </summary>
    [Fact]
    public async Task GetOwnDraftAsync_ReturnsEveryStoredFieldInTheRightPlace()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        var categoryCertId = Guid.NewGuid();
        var idProofCertId = Guid.NewGuid();
        var gateCertId = Guid.NewGuid();
        var publicationsCertId = Guid.NewGuid();
        var educationCertId = Guid.NewGuid();
        var experienceCertId = Guid.NewGuid();

        await f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                candidateId, "Ana Rao", "9990001111", Gender.Female, true,
                new DateOnly(1998, 4, 12), "Rao Sr.", "12 Present Road", "34 Permanent Lane",
                "ana@example.com", "Indian", CandidateCategory.OBC, categoryCertId,
                IdProofType.AadhaarCard, "123456789012", idProofCertId),
            applicant);
        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                candidateId, true, "GATE12345", 2023, "750",
                [
                    new CandidateEducationInput(
                        null, EducationLevel.Undergraduate, null, "Computer Science",
                        "MNNIT Allahabad", 2020, "8.51", "First Division", educationCertId),
                ],
                gateCertId),
            applicant);
        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                candidateId,
                [
                    new CandidateExperienceInput(
                        null, 7, "Acme Research Labs", "Research Associate", "52000",
                        "Simulation work", "Contractual", 3, 5, 11, experienceCertId),
                ]),
            applicant);
        await f.Service.SaveStep4PublicationsAsync(
            new SaveStep4PublicationsInput(candidateId, 2, 4, 6, 8, 10, "Notes here", true, publicationsCertId, "Paper Title 1"),
            applicant);

        var detail = await f.Service.GetOwnDraftAsync(candidateId, applicant);

        detail.Id.Should().Be(candidateId);
        detail.RecruitmentRequestId.Should().Be(requestId);
        detail.ApplicationStatus.Should().Be(ApplicationStatus.Draft);

        // Step 1
        detail.FullName.Should().Be("Ana Rao");
        detail.Mobile.Should().Be("9990001111");
        detail.Gender.Should().Be(Gender.Female);
        detail.IsMarried.Should().BeTrue();
        detail.DateOfBirth.Should().Be(new DateOnly(1998, 4, 12));
        detail.FatherOrHusbandName.Should().Be("Rao Sr.");
        detail.PresentAddress.Should().Be("12 Present Road");
        detail.PermanentAddress.Should().Be("34 Permanent Lane");
        detail.Email.Should().Be("ana@example.com");
        detail.Nationality.Should().Be("Indian");
        detail.Category.Should().Be(CandidateCategory.OBC);
        detail.CategoryCertificateDocumentId.Should().Be(categoryCertId);
        detail.IdProofType.Should().Be(IdProofType.AadhaarCard);
        detail.IdProofDocumentId.Should().Be(idProofCertId);

        // Step 2
        detail.GateNetGpatQualified.Should().BeTrue();
        detail.GateNetGpatRollNo.Should().Be("GATE12345");
        detail.GateNetGpatYear.Should().Be(2023);
        detail.GateNetGpatScore.Should().Be("750");
        detail.GateNetGpatCertificateDocumentId.Should().Be(gateCertId);

        detail.Education.Should().ContainSingle();
        var edu = detail.Education[0];
        edu.Id.Should().NotBeEmpty();
        edu.Level.Should().Be(EducationLevel.Undergraduate);
        edu.Subject.Should().Be("Computer Science");
        edu.BoardInstituteUniv.Should().Be("MNNIT Allahabad");
        edu.Year.Should().Be(2020);
        edu.MarksOrCgpa.Should().Be("8.51");
        edu.Division.Should().Be("First Division");
        edu.CertificateDocumentId.Should().Be(educationCertId);

        // Step 3
        detail.Experiences.Should().ContainSingle();
        var exp = detail.Experiences[0];
        exp.Id.Should().NotBeEmpty();
        exp.SortOrder.Should().Be(7);
        exp.Organization.Should().Be("Acme Research Labs");
        exp.Position.Should().Be("Research Associate");
        exp.SalaryEmoluments.Should().Be("52000");
        exp.NatureOfDuties.Should().Be("Simulation work");
        exp.NatureOfAppointment.Should().Be("Contractual");
        exp.PeriodYears.Should().Be(3);
        exp.PeriodMonths.Should().Be(5);
        exp.PeriodDays.Should().Be(11);
        exp.CertificateDocumentId.Should().Be(experienceCertId);

        // Step 4
        detail.SciJournalCount.Should().Be(2);
        detail.ScopusJournalCount.Should().Be(4);
        detail.NonSciJournalCount.Should().Be(6);
        detail.InternationalConfCount.Should().Be(8);
        detail.NationalConfCount.Should().Be(10);
        detail.PublicationName.Should().Be("Paper Title 1");
        detail.OtherInformation.Should().Be("Notes here");
        detail.WantsHigherDegreeRegistration.Should().BeTrue();
        detail.PublicationsDocumentId.Should().Be(publicationsCertId);

        // Step 5 fields: unset on a still-open draft.
        detail.PhotoDocumentId.Should().BeNull();
        detail.SignatureDocumentId.Should().BeNull();
        detail.DeclarationAcceptedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetOwnDraftAsync_OrdersExperiencesBySortOrder()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);

        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                candidateId,
                [
                    new CandidateExperienceInput(null, 2, "Second Org", null, null, null, null, 0, 0, 0, null),
                    new CandidateExperienceInput(null, 0, "First Org", null, null, null, null, 0, 0, 0, null),
                    new CandidateExperienceInput(null, 1, "Middle Org", null, null, null, null, 0, 0, 0, null),
                ]),
            applicant);

        var detail = await f.Service.GetOwnDraftAsync(candidateId, applicant);

        detail.Experiences.Select(x => x.Organization).Should()
            .ContainInOrder("First Org", "Middle Org", "Second Org");
    }

    [Fact]
    public async Task GetOwnDraftAsync_OnAnotherApplicantsDraft_ThrowsCandidateDraftNotOwned()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var candidateId = await f.Service.StartOrResumeDraftAsync(requestId, owner);

        var act = () => f.Service.GetOwnDraftAsync(candidateId, stranger);

        await act.Should().ThrowAsync<CandidateDraftNotOwnedException>();
    }

    // ------------------------------------------- ListOwnApplicationsAsync

    [Fact]
    public async Task ListOwnApplicationsAsync_CarriesApplicationStatusThrough()
    {
        var f = Create();
        var draftRequestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        var draftId = await f.Service.StartOrResumeDraftAsync(draftRequestId, applicant);

        var submittedRequestId = await AdvertisedRequestAsync(f);
        var submittedId = await SubmittableDraftAsync(f, submittedRequestId, applicant);
        await f.Service.SubmitDraftAsync(submittedId, applicant);

        var summaries = await f.Service.ListOwnApplicationsAsync(applicant);

        summaries.Should().HaveCount(2);
        summaries.Single(s => s.Id == draftId).ApplicationStatus
            .Should().Be(ApplicationStatus.Draft);
        summaries.Single(s => s.Id == submittedId).ApplicationStatus
            .Should().Be(ApplicationStatus.Submitted);
    }

    // ------------------------------------------------------------- Prefill

    [Fact]
    public async Task PrefillFromPreviousApplicationAsync_CopiesEveryFieldAndChildRowIntoANewIndependentDraft()
    {
        var f = Create();
        var sourceRequestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        var sourceId = await f.Service.StartOrResumeDraftAsync(sourceRequestId, applicant);
        await f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                sourceId, "Ana Rao", "9990001111", Gender.Female, false,
                new DateOnly(1998, 4, 12), "Rao Sr.", "123 Main St", "456 Home St",
                "ana@example.com", "Indian", CandidateCategory.OBC, Guid.NewGuid(), null, null, null),
            applicant);
        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                sourceId, true, "GATE12345", 2023, "750",
                [
                    new CandidateEducationInput(null, EducationLevel.Undergraduate, null, "CSE", "MNNIT", 2020, "8.5", "First", Guid.NewGuid()),
                ]),
            applicant);
        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                sourceId,
                [
                    new CandidateExperienceInput(null, 1, "Org A", "Engineer", "50000", "Dev", "Full-time", 1, 2, 0, Guid.NewGuid()),
                ]),
            applicant);
        await f.Service.SaveStep4PublicationsAsync(
            new SaveStep4PublicationsInput(sourceId, 2, 1, 0, 1, 3, "Some notes", true, null, "Paper Title"),
            applicant);
        // Leave the source as a Draft -- prefill must work from any of the
        // applicant's own previous applications, not only Submitted ones, and
        // this also exercises the loader independently of ApplicationStatus.
        var sourceBefore = await f.Db.Candidates
            .Include(c => c.Education).Include(c => c.Experiences)
            .AsNoTracking().FirstAsync(c => c.Id == sourceId);

        var targetRequestId = await AdvertisedRequestAsync(f);
        var newDraftId = await f.Service.PrefillFromPreviousApplicationAsync(
            targetRequestId, sourceId, applicant);

        newDraftId.Should().NotBe(sourceId);

        var newDraft = await f.Db.Candidates
            .Include(c => c.Education).Include(c => c.Experiences)
            .AsNoTracking().FirstAsync(c => c.Id == newDraftId);

        newDraft.FullName.Should().Be(sourceBefore.FullName);
        newDraft.Mobile.Should().Be(sourceBefore.Mobile);
        newDraft.Gender.Should().Be(sourceBefore.Gender);
        newDraft.DateOfBirth.Should().Be(sourceBefore.DateOfBirth);
        newDraft.Category.Should().Be(sourceBefore.Category);
        newDraft.CategoryCertificateDocumentId.Should().Be(sourceBefore.CategoryCertificateDocumentId);
        newDraft.GateNetGpatRollNo.Should().Be(sourceBefore.GateNetGpatRollNo);
        newDraft.SciJournalCount.Should().Be(sourceBefore.SciJournalCount);
        newDraft.OtherInformation.Should().Be(sourceBefore.OtherInformation);
        newDraft.PrefilledFromCandidateId.Should().Be(sourceId);

        newDraft.Education.Should().ContainSingle();
        newDraft.Education[0].Id.Should().NotBe(sourceBefore.Education[0].Id);
        newDraft.Education[0].BoardInstituteUniv.Should().Be(sourceBefore.Education[0].BoardInstituteUniv);
        newDraft.Education[0].CertificateDocumentId.Should().Be(sourceBefore.Education[0].CertificateDocumentId);

        newDraft.Experiences.Should().ContainSingle();
        newDraft.Experiences[0].Id.Should().NotBe(sourceBefore.Experiences[0].Id);
        newDraft.Experiences[0].Organization.Should().Be(sourceBefore.Experiences[0].Organization);
        newDraft.Experiences[0].CertificateDocumentId.Should().Be(sourceBefore.Experiences[0].CertificateDocumentId);

        // --- Independence: mutate the NEW draft and its child rows, then
        // reload the SOURCE from the database (AsNoTracking, so nothing in the
        // identity map can paper over a real bug) and assert it is untouched.
        // This is the assertion that actually proves independence, not merely
        // that the initial copy matched.
        await f.Service.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                newDraftId, "Mutated Name", "9110000000", Gender.Male, true,
                new DateOnly(1990, 1, 1), "Someone Else", "Changed Address", "Changed Address 2",
                "mutated@example.com", "Other", CandidateCategory.General, Guid.NewGuid(), null, null, null),
            applicant);
        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                newDraftId, false, null, null, null,
                [
                    new CandidateEducationInput(null, EducationLevel.Tenth, null, "Changed", "Changed School", 2000, "50%", "Third", null),
                ]),
            applicant);
        await f.Service.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                newDraftId,
                [
                    new CandidateExperienceInput(null, 1, "Changed Org", "Changed Role", "1", "Changed", "Changed", 0, 0, 1, null),
                ]),
            applicant);

        var sourceAfter = await f.Db.Candidates
            .Include(c => c.Education).Include(c => c.Experiences)
            .AsNoTracking().FirstAsync(c => c.Id == sourceId);

        sourceAfter.FullName.Should().Be(sourceBefore.FullName);
        sourceAfter.Mobile.Should().Be(sourceBefore.Mobile);
        sourceAfter.Gender.Should().Be(sourceBefore.Gender);
        sourceAfter.PresentAddress.Should().Be(sourceBefore.PresentAddress);
        sourceAfter.Education.Should().ContainSingle();
        sourceAfter.Education[0].Id.Should().Be(sourceBefore.Education[0].Id);
        sourceAfter.Education[0].BoardInstituteUniv.Should().Be(sourceBefore.Education[0].BoardInstituteUniv);
        sourceAfter.Experiences.Should().ContainSingle();
        sourceAfter.Experiences[0].Id.Should().Be(sourceBefore.Experiences[0].Id);
        sourceAfter.Experiences[0].Organization.Should().Be(sourceBefore.Experiences[0].Organization);
    }

    [Fact]
    public async Task PrefillFromPreviousApplicationAsync_FromAnotherApplicantsCandidate_ThrowsCandidateDraftNotOwned()
    {
        var f = Create();
        var sourceRequestId = await AdvertisedRequestAsync(f);
        var owner = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        var sourceId = await f.Service.StartOrResumeDraftAsync(sourceRequestId, owner);

        var targetRequestId = await AdvertisedRequestAsync(f);

        var act = () => f.Service.PrefillFromPreviousApplicationAsync(
            targetRequestId, sourceId, stranger);

        await act.Should().ThrowAsync<CandidateDraftNotOwnedException>();
    }

    [Fact]
    public async Task PrefillFromPreviousApplicationAsync_UnknownSourceId_ThrowsCandidateDraftNotFound()
    {
        var f = Create();
        var targetRequestId = await AdvertisedRequestAsync(f);

        var act = () => f.Service.PrefillFromPreviousApplicationAsync(
            targetRequestId, Guid.NewGuid(), Guid.NewGuid());

        await act.Should().ThrowAsync<CandidateDraftNotFoundException>();
    }

    [Fact]
    public async Task PrefillFromPreviousApplicationAsync_SourceIsTheInProgressDraftForTargetRequest_ReturnsItUnchanged()
    {
        // StartOrResumeDraftAsync resumes an existing Draft for the same
        // request/applicant instead of creating a new one. If the applicant
        // picks that same draft as their prefill source (e.g. re-selecting the
        // current recruitment's own in-progress application), `source` and
        // `newDraft` resolve to the identical tracked Candidate row, aliasing
        // their Education/Experiences collections. This must not throw and
        // must not lose data.
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var applicant = Guid.NewGuid();

        var draftId = await f.Service.StartOrResumeDraftAsync(requestId, applicant);
        await f.Service.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                draftId, false, null, null, null,
                [
                    new CandidateEducationInput(null, EducationLevel.Undergraduate, null, "CSE", "MNNIT", 2020, "8.5", "First", null),
                ]),
            applicant);

        var act = () => f.Service.PrefillFromPreviousApplicationAsync(
            requestId, draftId, applicant);

        var resultId = await act.Should().NotThrowAsync();
        resultId.Subject.Should().Be(draftId);

        var draft = await f.Db.Candidates
            .Include(c => c.Education)
            .AsNoTracking().FirstAsync(c => c.Id == draftId);
        draft.Education.Should().ContainSingle();
    }
}
