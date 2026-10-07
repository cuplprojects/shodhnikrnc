using API.Application.Notifications;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.DocumentGeneration.Templates;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// Task 4: advertising with a chosen template renders from that template's
/// resolved sections, while advertising without one keeps behaving exactly as
/// it did before advertisement templates existed.
/// </summary>
public class RecruitmentServiceAdvertisementTemplateTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        AdvertisementTemplateService Templates,
        StubRecruitmentDocumentGenerationService Documents,
        Guid PiUserId,
        Guid ProjectId,
        Guid PositionId);

    /// <summary>
    /// Mirrors RecruitmentServiceTests.Create, on the same
    /// TestProcurementDbContext (which already declares the
    /// AdvertisementTemplate model) so both services share one store.
    /// </summary>
    private static Fixture Create()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var piUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
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

        var profiles = new StubFacultyProfileProvider();
        var documents = new StubRecruitmentDocumentGenerationService();
        var templates = new AdvertisementTemplateService(db, profiles);
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));
        var service = new RecruitmentService(
            db, workflow, new FakeApplicantRoleService(), documents,
            profiles, new StubDocumentStorageService(),
            new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            templates,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(db, service, templates, documents, piUserId, projectId, positionId);
    }

    private static async Task<Guid> SeedDefaultTemplateAsync(Fixture f)
    {
        await AdvertisementTemplateSeeder.SeedAsync(f.Db);
        return (await f.Db.AdvertisementTemplates.FirstAsync(t => t.IsSystemDefault)).Id;
    }

    private static async Task<Guid> CreateRequestAsync(Fixture f) =>
        await f.Service.CreateAsync(new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

    // ------------------------------------------------------------- Advertise

    [Fact]
    public async Task AdvertiseAsync_WithTemplateId_StoresResolvedSectionsAndGeneratedTextIncludesThem()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "ignored free text", "Submitted for RnC office approval", templateId), f.PiUserId);

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id);

        // Advertisement.Text is now the template's own wording, not the
        // caller's free text, so every existing reader of that field sees the
        // advertisement as actually issued.
        ad.Text.Should().NotContain("ignored free text");
        ad.Text.Should().Contain("Essential Qualifications:");
        ad.Text.Should().Contain("Tenure of Appointment:");
        ad.Text.Should().Contain("One year. Extendable on performance basis up to 3 years.");

        // Entity-bound tokens are resolved out; nothing is left unsubstituted.
        ad.Text.Should().Contain("As per DST norms");
        ad.Text.Should().NotContain("{{");

        // And the same sections were cached for the PDF path.
        f.Documents.LastModel.Should().BeNull("no document has been generated yet");
        var doc = await f.Service.GenerateDocumentAsync(
            id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        doc.Content.Should().NotBeEmpty();

        var sections = f.Documents.LastModel!.ResolvedAdvertisementSections;
        sections.Should().NotBeNull();
        sections!.Should().HaveCount(8);
        sections[0].Key.Should().Be(AdvertisementSectionKey.EssentialQualifications);
        sections[^1].Key.Should().Be(AdvertisementSectionKey.Notes);
        sections.Should().OnlyContain(s => s.IsIncluded);
    }

    [Fact]
    public async Task AdvertiseAsync_WithTemplateId_SubstitutesCallerSuppliedFreeTextTokens()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);

        // Add a section carrying a token the entity-bound catalogue cannot
        // resolve, so only the caller's own value can fill it.
        f.Db.AdvertisementTemplateSections.Add(new AdvertisementTemplateSection
        {
            Id = Guid.NewGuid(),
            TemplateId = templateId,
            Key = AdvertisementSectionKey.OtherBenefits,
            Content = "Reporting location: {{WorkLocation}}.",
            IsIncluded = true,
            SortOrder = 9,
        });
        await f.Db.SaveChangesAsync();

        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(
                id, Published, Closing, "free text", "Submitted for RnC office approval", templateId,
                new Dictionary<string, string> { ["WorkLocation"] = "CSE Block, MNNIT" }),
            f.PiUserId);

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Contain("Reporting location: CSE Block, MNNIT.");
        ad.Text.Should().NotContain("{{WorkLocation}}");
    }

    [Fact]
    public async Task AdvertiseAsync_WithTemplateId_OmitsExcludedSections()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);

        var template = await f.Db.AdvertisementTemplates
            .Include(t => t.Sections).FirstAsync(t => t.Id == templateId);
        template.Sections.First(s => s.Key == AdvertisementSectionKey.AgeLimit).IsIncluded = false;
        await f.Db.SaveChangesAsync();

        var id = await CreateRequestAsync(f);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "free text", "Submitted for RnC office approval", templateId), f.PiUserId);

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().NotContain("Age Limit:");
        ad.Text.Should().Contain("Essential Qualifications:");

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        var html = RecruitmentTemplates.Advertisement(f.Documents.LastModel!);
        html.Should().NotContain("<strong>Age Limit:</strong>");
        html.Should().Contain("<strong>Essential Qualifications:</strong>");
    }

    [Fact]
    public async Task AdvertiseAsync_WithoutTemplateId_BehavesExactlyAsBefore()
    {
        var f = Create();
        await SeedDefaultTemplateAsync(f); // present but not chosen
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("JRF wanted", "free text is stored verbatim when no template is chosen");
        ad.PublishedOn.Should().Be(Published);
        ad.ClosingDate.Should().Be(Closing);
        ad.Round.Should().Be(1);
        // Advertising now submits for approval rather than publishing outright;
        // Advertised arrives only once the Computer Centre approves.
        (await f.Service.GetAsync(id, f.PiUserId)).Stage
            .Should().Be(RecruitmentStage.AdvertisementRequested);

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        f.Documents.LastModel!.ResolvedAdvertisementSections.Should().BeNull(
            "no sections are stored for a template-less advertisement");
    }

    [Fact]
    public async Task AdvertiseAsync_WithoutTemplateId_RendersJustTheEditorTextWithNoFixedTable()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);

        var html = RecruitmentTemplates.Advertisement(f.Documents.LastModel!);

        // The rich text editor is the sole source of the advertisement body
        // now -- no fixed table of project/agency/salary/date details above
        // it, since the PI types all of that directly into the editor.
        html.Should().Contain("JRF wanted");
        html.Should().NotContain("<th>Fellowship</th>");
        html.Should().NotContain("<th>Tenure of Appointment</th>");
        html.Should().NotContain("Research Project Entitled");
        html.Should().NotContain("<strong>Essential Qualifications:</strong>");
        html.Should().NotContain("Advertisement for the Post of");
    }

    [Fact]
    public async Task AdvertiseAsync_SanitizesScriptTagsOutOfText()
    {
        var f = Create();
        var requestId = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(
                requestId, Published, Closing, "<p>Apply now</p><script>alert('x')</script>",
                "Submitted for RnC office approval"),
            f.PiUserId);

        var stored = await f.Db.Advertisements.SingleAsync(a => a.RecruitmentRequestId == requestId);
        stored.Text.Should().Contain("<p>Apply now</p>");
        stored.Text.Should().NotContain("<script");
    }

    // --------------------------------------------------- Advertisement token values

    [Fact]
    public async Task GetAdvertisementTokenValuesAsync_ReturnsRealEntityBoundValues()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);

        var values = await f.Service.GetAdvertisementTokenValuesAsync(id, f.PiUserId);

        values["ProjectTitle"].Should().Be("Recruitment Test Project");
        values["ProjectFileNo"].Should().Be("SAN-R1");
        values["SalaryJrf"].Should().Contain("per month");
        values.Should().ContainKey("AdvertisementDate");
    }

    [Fact]
    public async Task GetAdvertisementTokenValuesAsync_ByNonOwner_ThrowsProjectAccessDeniedException()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);

        var act = () => f.Service.GetAdvertisementTokenValuesAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    // ----------------------------------------------------------- Readvertise

    [Fact]
    public async Task ReadvertiseAsync_WithTemplateId_StoresSectionsForTheNewRoundOnly()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "round one free text", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);

        await f.Service.ReadvertiseAsync(
            new ReadvertiseInput(
                id, 2, Published.AddMonths(1), Closing.AddMonths(1), "ignored", templateId),
            f.PiUserId);

        var request = await f.Db.RecruitmentRequests.FirstAsync(r => r.Id == id);
        request.AdvertisementRound.Should().Be(2, "the lifecycle increment is unchanged");
        request.Stage.Should().Be(RecruitmentStage.Advertised);

        var first = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id && a.Round == 1);
        first.CandidateCountAtClose.Should().Be(2, "the closing round's count is still recorded");
        first.Text.Should().Be("round one free text", "the earlier round's text is untouched");

        var second = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id && a.Round == 2);
        second.Text.Should().Contain("Essential Qualifications:");

        // {{AdvertisementNo}} must reflect the new round, not the closed one.
        var resolved = await f.Templates.ResolveAsync(templateId, id, f.PiUserId, 2, Published.AddMonths(1));
        resolved.UnresolvedTokens.Should().BeEmpty();

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        f.Documents.LastModel!.ResolvedAdvertisementSections.Should().NotBeNull();
        f.Documents.LastModel!.AdvertisementRound.Should().Be(2);
    }

    [Fact]
    public async Task ReadvertiseAsync_WithoutTemplateId_BehavesExactlyAsBefore()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "round one", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);

        await f.Service.ReadvertiseAsync(
            new ReadvertiseInput(id, 1, Published.AddMonths(1), Closing.AddMonths(1), "round two"),
            f.PiUserId);

        var second = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id && a.Round == 2);
        second.Text.Should().Be("round two");

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        f.Documents.LastModel!.ResolvedAdvertisementSections.Should().BeNull();
    }

    [Fact]
    public async Task ReadvertiseAsync_WithoutTemplate_AfterATemplatedRound_DoesNotReuseTheOldSections()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "free", "Submitted for RnC office approval", templateId), f.PiUserId);

        // AdvertiseAsync's first call auto-forwards to the RnC office, so
        // re-issuing the same round requires a Return first (final
        // whole-branch review finding 2 -- a second AdvertiseAsync call while
        // the instance is actively under review is refused, not silently
        // allowed). This mirrors the real resubmit path exactly.
        await f.Service.ReturnAdvertisementAsync(
            id, Guid.NewGuid(), AdvertisementApprovalHarness.RnCOfficeRoles, "revise wording");

        // Re-issuing the same round without a template must clear the cache,
        // otherwise the PDF would keep printing the withdrawn wording.
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "plain wording now", "Submitted for RnC office approval"), f.PiUserId);

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == id);
        ad.Text.Should().Be("plain wording now");

        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);
        f.Documents.LastModel!.ResolvedAdvertisementSections.Should().BeNull();
    }

    // ------------------------------------------------------- Document render

    [Fact]
    public async Task GenerateDocumentAsync_AdvertisementKindWithTemplate_RendersResolvedSectionsInThePdfHtml()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "free text", "Submitted for RnC office approval", templateId), f.PiUserId);
        await f.Service.GenerateDocumentAsync(id, RecruitmentDocumentKind.Advertisement, f.PiUserId);

        var html = RecruitmentTemplates.Advertisement(f.Documents.LastModel!);

        html.Should().Contain("<strong>Essential Qualifications:</strong>");
        html.Should().Contain("<strong>Salary:</strong>");
        html.Should().Contain("<strong>Tenure of Appointment:</strong>");
        html.Should().Contain("<strong>Note:</strong>");
        html.Should().Contain("As per DST norms");

        // Section-driven rendering drops the fixed rows the sections replace,
        // so neither is printed twice.
        html.Should().NotContain("<th>Fellowship</th>");
        html.Should().NotContain("As per the sanctioned duration of the project");

        // The structural rows that are never template sections are still there.
        html.Should().Contain("Research Project Entitled");
        html.Should().Contain("Last Date of Application");
        html.Should().Contain("Advertisement for the Post of Junior Research Fellow");
    }

    [Fact]
    public void Advertisement_EscapesSectionContentAndKeepsLineBreaks()
    {
        var model = ModelWithSections(
            new ResolvedAdvertisementSectionModel(
                AdvertisementSectionKey.Notes, "A <script>alert(1)</script>\nSecond line", true));

        var html = RecruitmentTemplates.Advertisement(model);

        html.Should().NotContain("<script>");
        html.Should().Contain("&lt;script&gt;");
        html.Should().Contain("Second line");
        html.Should().Contain("<br>");
    }

    [Fact]
    public void Advertisement_RendersSanitizedHtmlUnescaped()
    {
        var model = new RecruitmentDocumentModel(
            "Project Title", "DST", "SAN-R1", "Prof. PI", "Professor", "CSE",
            "Junior Research Fellow", 1, 31_000m, 0m, 1,
            Published, Closing, "<p><strong>Apply now</strong></p>", null, null, null,
            [], [], [], null, null);

        var html = RecruitmentTemplates.Advertisement(model);

        html.Should().Contain("<strong>Apply now</strong>");
        html.Should().NotContain("&lt;strong&gt;");
    }

    [Fact]
    public void Advertisement_RewritesRelativeUploadedImageSrcToAbsoluteUrl()
    {
        var model = new RecruitmentDocumentModel(
            "Project Title", "DST", "SAN-R1", "Prof. PI", "Professor", "CSE",
            "Junior Research Fellow", 1, 31_000m, 0m, 1,
            Published, Closing,
            "<p>Apply now</p><img src=\"/uploads/advertisement-images/abc123.jpg\" alt=\"Logo\">",
            null, null, null, [], [], [], null, null);

        var html = RecruitmentTemplates.Advertisement(model, baseUrl: "https://portal.example.edu");

        html.Should().Contain("src=\"https://portal.example.edu/uploads/advertisement-images/abc123.jpg\"");
        html.Should().NotContain("src=\"/uploads/advertisement-images/abc123.jpg\"");
    }

    [Fact]
    public void Advertisement_LeavesNonUploadedImageSrcUntouched()
    {
        var model = new RecruitmentDocumentModel(
            "Project Title", "DST", "SAN-R1", "Prof. PI", "Professor", "CSE",
            "Junior Research Fellow", 1, 31_000m, 0m, 1,
            Published, Closing, "<p><strong>Apply now</strong></p>", null, null, null,
            [], [], [], null, null);

        var html = RecruitmentTemplates.Advertisement(model, baseUrl: "https://portal.example.edu");

        html.Should().Contain("<strong>Apply now</strong>");
    }

    // ------------------------------------------------- Applicant-facing listing

    [Fact]
    public async Task ListOpenAsync_StripsHtmlFromAdvertisementTextForThePreview()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(
                id, Published, Closing,
                "<p>Apply now</p><ul><li>M.Tech required</li></ul>",
                "Submitted for RnC office approval"),
            f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);

        var summaries = await f.Service.ListOpenAsync();

        var summary = summaries.Should().ContainSingle(s => s.Id == id).Subject;

        // The stored Advertisement.Text is sanitized HTML (this is what the
        // PDF generator renders directly), but the applicant-facing open-
        // recruitments listing card shows this summary's Text as a plain-text
        // preview, so it must come back tag-free here.
        summary.Text.Should().NotContain("<");
        summary.Text.Should().NotContain(">");
        summary.Text.Should().Contain("Apply now");
        summary.Text.Should().Contain("M.Tech required");
    }

    [Fact]
    public async Task GetAsync_PreservesAdvertisementHtml_ForThePiReopenToEditPrefill()
    {
        var f = Create();
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(
                id, Published, Closing,
                "<p>Apply now</p><ul><li>M.Tech required</li></ul>",
                "Submitted for RnC office approval"),
            f.PiUserId);

        // Unlike ListOpenAsync (the applicant-facing listing), the PI's own
        // recruitment detail -- which GenerateAdvertisementModal's
        // reopen-to-edit prefill reads from -- must see the original
        // sanitized HTML unstripped, or the PI would lose formatting on
        // reopen even though nothing was actually changed.
        var summary = await f.Service.GetAsync(id, f.PiUserId);

        summary.Text.Should().Contain("<p>Apply now</p>");
        summary.Text.Should().Contain("<li>M.Tech required</li>");
    }

    // --------------------------------------------------- Other kinds intact

    [Fact]
    public async Task GenerateDocumentAsync_OtherKinds_AreNeverGivenResolvedSections()
    {
        var f = Create();
        var templateId = await SeedDefaultTemplateAsync(f);
        var id = await CreateRequestAsync(f);

        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "free text", "Submitted for RnC office approval", templateId), f.PiUserId);

        // Even with sections cached for this recruitment, every other kind
        // must receive a model with none -- their templates are untouched.
        foreach (var kind in new[]
        {
            RecruitmentDocumentKind.ScreeningProforma,
            RecruitmentDocumentKind.SelectionProforma,
            RecruitmentDocumentKind.MinutesOfSelection,
            RecruitmentDocumentKind.MeritList,
        })
        {
            await f.Service.GenerateDocumentAsync(id, kind, f.PiUserId);
            f.Documents.LastModel!.ResolvedAdvertisementSections.Should().BeNull(
                $"{kind} must render exactly as it did before advertisement templates");
        }
    }

    [Fact]
    public void OtherTemplates_IgnoreResolvedSectionsEntirely()
    {
        var withSections = ModelWithSections(
            new ResolvedAdvertisementSectionModel(AdvertisementSectionKey.Notes, "Some note", true));
        var without = withSections with { ResolvedAdvertisementSections = null };

        RecruitmentTemplates.ScreeningProforma(withSections)
            .Should().Be(RecruitmentTemplates.ScreeningProforma(without));
        RecruitmentTemplates.SelectionProforma(withSections)
            .Should().Be(RecruitmentTemplates.SelectionProforma(without));
        RecruitmentTemplates.MinutesOfSelection(withSections)
            .Should().Be(RecruitmentTemplates.MinutesOfSelection(without));
        RecruitmentTemplates.MeritList(withSections)
            .Should().Be(RecruitmentTemplates.MeritList(without));
    }

    private static RecruitmentDocumentModel ModelWithSections(
        params ResolvedAdvertisementSectionModel[] sections) =>
        new(
            "Project Title", "DST", "SAN-R1", "Prof. PI", "Professor", "CSE",
            "Junior Research Fellow", 1, 31_000m, 0m, 1,
            Published, Closing, "legacy free text", null, null, null,
            [], [], [], null, sections);
}
