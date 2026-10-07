using API.Application.Access;
using API.Application.Audit;
using API.Application.Documents;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Proposals;

/// <summary>
/// The service layer over the proposal chain. The rule that matters most is
/// stated as a test, not just documentation: RecordSanctionAsync is the only
/// path in this service -- or, so far as this phase adds, anywhere in the
/// application -- that may create a Project.
/// </summary>
public class ResearchProposalServiceTests
{
    private static readonly Guid DepartmentId = Guid.NewGuid();
    private static readonly Guid HodDepartmentId = Guid.NewGuid();
    private static readonly Guid PiUserId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        TestDbContext Db, ResearchProposalService Service, WorkflowEngineService Workflow, string DatabaseName);

    /// <summary>
    /// True by default (department = DepartmentId), so most tests need not
    /// think about it. False plus a null piDepartmentId is how a test asks for
    /// a PI who genuinely has none -- distinct from "not specified", which
    /// piDepartmentId ?? DepartmentId could not tell apart from an explicit null.
    /// </summary>
    private static async Task<Fixture> CreateAsync(Guid? piDepartmentId = null, bool hasDepartment = true)
    {
        var dbName = Guid.NewGuid().ToString();
        return await CreateOnDatabaseAsync(dbName, piDepartmentId, hasDepartment);
    }

    /// <summary>
    /// A second, independent DbContext/service pointed at the same in-memory
    /// database name as an existing fixture -- simulates two concurrent HTTP
    /// requests, each with their own DbContext (the real per-request lifetime),
    /// racing against the same underlying data. A single shared DbContext (what
    /// every other test in this file uses) cannot reproduce a race condition:
    /// its change tracker sees every prior write immediately, which is exactly
    /// the guarantee two real concurrent requests do not have.
    /// </summary>
    private static async Task<Fixture> CreateSecondConnectionAsync(Fixture existing) =>
        await CreateOnDatabaseAsync(existing.DatabaseName, DepartmentId, hasDepartment: true);

    private static async Task<Fixture> CreateOnDatabaseAsync(string dbName, Guid? piDepartmentId, bool hasDepartment)
    {
        var db = new TestDbContext(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options);

        // Without this, IWorkflowDefinitionService's fallback for an
        // unconfigured (RequestType, Phase) applies -- the shipped office
        // route, whose initial stage is Raised, not Draft. That fallback is
        // correct for production (Phase 5's outage-prevention fix), but it
        // means these tests need the real proposal route seeded to exercise
        // the actual chain rather than a coincidentally similar one.
        await ResearchProposalWorkflowSeeder.SeedAsync(db);

        // Mirrors DbSeeder's production configuration for a research proposal's
        // Indent-phase checklist: SignedCopy and EndorsementCertificate are
        // mandatory; CoverLetter, BudgetCopy, and SupportingDocument are
        // optional. All five rows are seeded here (not just the two mandatory
        // ones) so tests that assert an optional document's absence does not
        // block submission actually exercise the IsMandatory == false branch
        // of SubmitForApprovalAsync's filter, instead of trivially passing
        // because no optional row existed to check in the first place.
        db.DocumentChecklistItems.AddRange(
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.SignedCopy,
                Name = "Signed Copy of Proposal",
                IsMandatory = true,
                DisplayOrder = 1,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.EndorsementCertificate,
                Name = "Endorsement Certificate",
                IsMandatory = true,
                DisplayOrder = 2,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.CoverLetter,
                Name = "Cover Letter",
                IsMandatory = false,
                DisplayOrder = 3,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.BudgetCopy,
                Name = "Budget Copy (with overhead column)",
                IsMandatory = false,
                DisplayOrder = 4,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.SupportingDocument,
                Name = "Supporting Documents",
                IsMandatory = false,
                DisplayOrder = 5,
            });
        await db.SaveChangesAsync();

        var workflow = new WorkflowEngineService(db);
        var department = hasDepartment ? (piDepartmentId ?? DepartmentId) : (Guid?)null;
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), new FakeDepartment(department),
            new InstituteWideScopeResolver(db, new FakeDepartment(department)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        var service = new ResearchProposalService(
            db, workflow, new FakeDepartment(department), projectService,
            new InstituteWideScopeResolver(db, new FakeDepartment(department)),
            new DocumentChecklistService(db), new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(db, service, workflow, dbName);
    }

    private static CreateProposalDraftInput ValidDraft() => new(
        Title: "Novel catalysts",
        ProposalType: ProposalType.ResearchProject,
        Agency: "DST",
        AdvertisementReference: "DST/2026/001",
        DurationMonths: 24,
        OverheadPercent: 10m,
        BudgetLines:
        [
            new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [150_000m, 150_000m], IncludeInOverhead: true),
            new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [350_000m, 350_000m], IncludeInOverhead: false),
        ]);

    [Fact]
    public async Task CreateDraftAsync_ComputesOverheadFromCheckedLinesOnly_MatchingReferenceExample()
    {
        var f = await CreateAsync();

        // Mirrors the client's reference image: 6 heads summing to 16,00,000,
        // all checked for overhead, at 25% -> 4,00,000 overhead, 20,00,000 total.
        var input = new CreateProposalDraftInput(
            Title: "Reference budget example",
            ProposalType: ProposalType.ResearchProject,
            Agency: "DST",
            AdvertisementReference: null,
            DurationMonths: 36,
            OverheadPercent: 25m,
            BudgetLines:
            [
                new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [810_000m, 115_000m, 0m], IncludeInOverhead: true), // 925,000
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [140_000m, 110_000m, 75_000m], IncludeInOverhead: true), // 325,000
                new ProposalBudgetLineInput(BudgetHeadName.RecurringManpower, [40_000m, 40_000m, 40_000m], IncludeInOverhead: true), // 120,000
                new ProposalBudgetLineInput(BudgetHeadName.RecurringTravel, [40_000m, 40_000m, 30_000m], IncludeInOverhead: true), // 110,000
                new ProposalBudgetLineInput(BudgetHeadName.RecurringContingency, [30_000m, 20_000m, 20_000m], IncludeInOverhead: true), // 70,000
                new ProposalBudgetLineInput(BudgetHeadName.RecurringFieldCharges, [16_666m, 16_667m, 16_667m], IncludeInOverhead: true), // 50,000
            ]);

        var id = await f.Service.CreateDraftAsync(input, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.ProposedAmount.Should().Be(1_600_000m);
        summary.OverheadAmount.Should().Be(400_000m);
        summary.TotalAmount.Should().Be(2_000_000m);
    }

    [Fact]
    public async Task CreateDraftAsync_ExcludesUncheckedLinesFromOverheadBase()
    {
        var f = await CreateAsync();

        var input = new CreateProposalDraftInput(
            Title: "Partial overhead base",
            ProposalType: ProposalType.ResearchProject,
            Agency: "DST",
            AdvertisementReference: null,
            DurationMonths: 12,
            OverheadPercent: 20m,
            BudgetLines:
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100_000m], IncludeInOverhead: true),
                new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [50_000m], IncludeInOverhead: false),
            ]);

        var id = await f.Service.CreateDraftAsync(input, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.ProposedAmount.Should().Be(150_000m); // both lines count toward the proposed total
        summary.OverheadAmount.Should().Be(20_000m);  // only the checked 100,000 line feeds the overhead base: 100,000 * 20% = 20,000
        summary.TotalAmount.Should().Be(170_000m);
    }

    // ---- CreateDraftAsync -----------------------------------------------------

    [Fact]
    public async Task CreateDraftAsync_StartsAsDraftWithNoWorkflowInstance()
    {
        var f = await CreateAsync();

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Draft);
        summary.WorkflowInstanceId.Should().BeNull();
        summary.ProjectId.Should().BeNull();
    }

    [Fact]
    public async Task CreateDraftAsync_SnapshotsThePisCurrentDepartment()
    {
        var f = await CreateAsync(piDepartmentId: DepartmentId);

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.DepartmentId.Should().Be(DepartmentId);
    }

    [Fact]
    public async Task CreateDraftAsync_WithNoDepartment_Throws()
    {
        var f = await CreateAsync(hasDepartment: false);

        var act = () => f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        await act.Should().ThrowAsync<PiHasNoDepartmentException>();
    }

    [Fact]
    public async Task CreateDraftAsync_TwoOtherLinesWithDistinctLabels_Succeeds()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 12, 10,
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [10000m]),
                new ProposalBudgetLineInput(BudgetHeadName.Other, [5000m], true, "Publication Charges"),
                new ProposalBudgetLineInput(BudgetHeadName.Other, [3000m], true, "Travel Insurance"),
            ]);

        var id = await fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        var proposal = await fixture.Db.ResearchProposals
            .Include(p => p.BudgetLines)
            .SingleAsync(p => p.Id == id);
        proposal.BudgetLines.Should().HaveCount(3);
        proposal.BudgetLines.Count(l => l.HeadName == BudgetHeadName.Other).Should().Be(2);
    }

    [Fact]
    public async Task CreateDraftAsync_TwoOtherLinesWithSameLabel_Throws()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 12, 10,
            [
                new ProposalBudgetLineInput(BudgetHeadName.Other, [5000m], true, "Publication Charges"),
                new ProposalBudgetLineInput(BudgetHeadName.Other, [3000m], true, "Publication Charges"),
            ]);

        var act = () => fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Publication Charges*");
    }

    [Fact]
    public async Task CreateDraftAsync_TwoOtherLinesWithSameLabelDifferentCase_Throws()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 12, 10,
            [
                new ProposalBudgetLineInput(BudgetHeadName.Other, [5000m], true, "Publication Charges"),
                new ProposalBudgetLineInput(BudgetHeadName.Other, [3000m], true, "  publication charges  "),
            ]);

        var act = () => fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task UpdateAsync_SingleUnracedEdit_DoesNotThrowConcurrencyException()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var input = new UpdateProposalInput(
            Title: "Novel catalysts (revised)",
            ProposalType: ProposalType.ResearchProject,
            Agency: "DST",
            AdvertisementReference: "DST/2026/001",
            DurationMonths: 24,
            OverheadPercent: 10m,
            BudgetLines:
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [150_000m, 150_000m], IncludeInOverhead: true),
                new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [350_000m, 350_000m], IncludeInOverhead: false),
            ],
            // Non-empty: an earlier version of this fix covered BudgetLines but
            // missed that ProposalEquipment/ProposalManpowerPosition hit the
            // identical Modified-instead-of-Added tracking bug, which a test
            // with empty Equipment/Manpower could never catch.
            Equipment: [new ProposalEquipmentInput("Centrifuge", "unit", 200_000m)],
            Manpower: [new ProposalManpowerPositionInput("JRF", 1, 20m, [31000m, 31000m])]);

        var act = () => f.Service.UpdateAsync(id, PiUserId, [], input);

        await act.Should().NotThrowAsync();

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Title.Should().Be("Novel catalysts (revised)");
        summary.Equipment.Should().ContainSingle(e => e.Name == "Centrifuge");
        summary.Manpower.Should().ContainSingle(m => m.Designation == "JRF");
        summary.BudgetLines.Should().HaveCount(2);
    }

    [Fact]
    public async Task CreateDraftAsync_PersistsDeclaredCoPis()
    {
        var f = await CreateAsync();

        var input = ValidDraft() with
        {
            CoPis = [new ProposalCoPiInput("Dr. A. Sharma", "Computer Science", "Associate Professor")],
        };

        var id = await f.Service.CreateDraftAsync(input, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CoPis.Should().ContainSingle(c =>
            c.Name == "Dr. A. Sharma" && c.Department == "Computer Science" && c.Designation == "Associate Professor");
    }

    private static async Task UploadDocumentAsync(Fixture f, Guid proposalId, DocumentKind kind)
    {
        f.Db.Documents.Add(new Document
        {
            Id = Guid.NewGuid(),
            OwnerType = "ResearchProposal",
            OwnerId = proposalId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = $"proposals/{proposalId}/{kind}.pdf",
            UploadedByUserId = PiUserId,
            UploadedAt = DateTimeOffset.UtcNow,
        });
        await f.Db.SaveChangesAsync();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_MissingSignedCopyAndEndorsementCertificate_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        await act.Should().ThrowAsync<MandatoryDocumentMissingException>();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_MissingOnlyEndorsementCertificate_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        await act.Should().ThrowAsync<MandatoryDocumentMissingException>();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithBothMandatoryDocuments_Succeeds()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval);
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithUserSuppliedRemarks_StoresThemOnTheForwardStep()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Please expedite, deadline is Friday");

        var summary = await f.Service.GetAsync(id, PiUserId);
        var forwardStep = await f.Db.WorkflowSteps
            .Where(s => s.WorkflowInstanceId == summary.WorkflowInstanceId && s.Action == WorkflowAction.Forward)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();
        forwardStep.Should().NotBeNull();
        forwardStep!.Remarks.Should().Be("Please expedite, deadline is Friday");
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithNullRemarks_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithWhitespaceRemarks_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "   ");

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithRemarks_Succeeds()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for HOD review.");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval);
    }

    [Fact]
    public async Task SubmitForApprovalAsync_MissingOnlyOptionalDocuments_Succeeds()
    {
        // CoverLetter/BudgetCopy/SupportingDocument are optional -- their
        // absence must not block submission. The fixture now seeds all three
        // optional checklist rows (see CreateOnDatabaseAsync), and this test
        // deliberately never uploads any of them, so it actually exercises
        // SubmitForApprovalAsync's IsMandatory && !IsSatisfied filter against
        // unsatisfied, non-mandatory rows -- rather than trivially passing
        // because no optional row was configured to check in the first place.
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        // Deliberately NOT uploading CoverLetter, BudgetCopy, or
        // SupportingDocument -- they are optional and unsatisfied.

        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval);
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithCoPisButNoConsentUploaded_Throws()
    {
        var f = await CreateAsync();
        var input = ValidDraft() with
        {
            CoPis = [new ProposalCoPiInput("Dr. A. Sharma", "Computer Science", "Associate Professor")],
        };
        var id = await f.Service.CreateDraftAsync(input, PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        // Deliberately no CoPiConsent upload.

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        await act.Should().ThrowAsync<MandatoryDocumentMissingException>();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithCoPisAndConsentUploaded_Succeeds()
    {
        var f = await CreateAsync();
        var input = ValidDraft() with
        {
            CoPis = [new ProposalCoPiInput("Dr. A. Sharma", "Computer Science", "Associate Professor")],
        };
        var id = await f.Service.CreateDraftAsync(input, PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        await UploadDocumentAsync(f, id, DocumentKind.CoPiConsent);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_WithNoCoPis_DoesNotRequireConsent()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId); // no CoPis
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task CreateDraftAsync_ComputesProposedAmountAsSumOfEveryLineEveryYear()
    {
        var f = await CreateAsync();

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.ProposedAmount.Should().Be(1_000_000m);
    }

    [Fact]
    public async Task CreateDraftAsync_ComputesOverheadAsPercentOfCheckedLinesOnly()
    {
        var f = await CreateAsync();

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        // RecurringConsumable (checked): 300,000 * 10% = 30,000. EquipmentNonRecurring (unchecked): excluded.
        summary.OverheadAmount.Should().Be(30_000m);
    }

    [Fact]
    public async Task CreateDraftAsync_ComputesTotalAmountAsProposedPlusOverhead()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Total Amount Test", ProposalType.ResearchProject, "DST", null, 12, 10m,
            [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100000m], IncludeInOverhead: true)],
            [], []);

        var proposalId = await f.Service.CreateDraftAsync(input, PiUserId);
        var summary = await f.Service.GetAsync(proposalId, PiUserId);

        summary.ProposedAmount.Should().Be(100000m);
        summary.OverheadAmount.Should().Be(10000m);
        summary.TotalAmount.Should().Be(110000m);
    }

    [Fact]
    public async Task CreateDraftAsync_WithRecurringOverheadLine_DoesNotDoubleCountOverheadInTotalAmount()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 12, 10,
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100000m], true),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringOverhead, [10000m], false),
            ]);

        var id = await fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        var proposal = await fixture.Db.ResearchProposals.SingleAsync(p => p.Id == id);
        proposal.ProposedAmount.Should().Be(100000m);
        proposal.OverheadAmount.Should().Be(10000m);
        proposal.TotalAmount.Should().Be(110000m);
    }

    /// <summary>
    /// Overhead must be computed per year (that year's own checked-lines
    /// total x percent), not as one lump total summed across every year and
    /// then split evenly -- a front-loaded budget must produce front-loaded
    /// overhead. Figures below are a real reported case: 5 checked lines
    /// over 3 years at 20% overhead, expected per-year overhead confirmed by
    /// hand against each year's own total (Y1=3,757,800 -> 751,560;
    /// Y2=1,732,800 -> 346,560; Y3=779,800 -> 155,960).
    /// </summary>
    [Fact]
    public async Task CreateDraftAsync_OverheadVariesByYear_MatchesEachYearsOwnBase()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 36, 20,
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100000m, 75000m, 75000m], true),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringTravel, [75000m, 75000m, 50000m], true),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringManpower, [532800m, 532800m, 604800m], true),
                new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [3000000m, 1000000m, 0m], true),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringContingency, [50000m, 50000m, 50000m], true),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringOverhead, [751560m, 346560m, 155960m], false),
            ]);

        var id = await fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        var proposal = await fixture.Db.ResearchProposals.SingleAsync(p => p.Id == id);
        proposal.OverheadAmount.Should().Be(1254080m); // 751560 + 346560 + 155960
        proposal.ProposedAmount.Should().Be(6270400m); // sum of the 5 checked lines, RecurringOverhead excluded
        proposal.TotalAmount.Should().Be(7524480m);
    }

    [Fact]
    public async Task GetAsync_ProjectsBudgetLinesWithTheirYearAmountsAndIncludeInOverhead()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);

        summary.BudgetLines.Should().HaveCount(2);
        var consumable = summary.BudgetLines.Single(l => l.HeadName == BudgetHeadName.RecurringConsumable);
        consumable.IncludeInOverhead.Should().BeTrue();
        consumable.YearAmounts.Should().Equal(150_000m, 150_000m);
    }

    [Fact]
    public async Task CreateDraftAsync_PersistsEquipmentAndManpower()
    {
        var f = await CreateAsync();
        var input = ValidDraft() with
        {
            Equipment = [new ProposalEquipmentInput("Spectrometer", "1", 500_000m)],
            Manpower = [new ProposalManpowerPositionInput("JRF", 2, 20m, [31_000m, 31_000m])],
        };

        var id = await f.Service.CreateDraftAsync(input, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Equipment.Should().ContainSingle(e => e.Name == "Spectrometer" && e.Amount == 500_000m);
        summary.Manpower.Should().ContainSingle(m =>
            m.Designation == "JRF" && m.Positions == 2 &&
            m.StipendByYear.SequenceEqual(new[] { 31_000m, 31_000m }) &&
            m.HraByYear.SequenceEqual(new[] { 6_200m, 6_200m }));
    }

    [Fact]
    public async Task CreateDraftAsync_WithNoEquipmentOrManpower_PersistsEmptyLists()
    {
        var f = await CreateAsync();

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Equipment.Should().BeEmpty();
        summary.Manpower.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateDraftAsync_LineWithFewerYearsThanDurationImplies_Throws()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "DST", null, DurationMonths: 24, OverheadPercent: 0m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100_000m])]); // only 1 year, duration implies 2

        var act = () => f.Service.CreateDraftAsync(input, PiUserId);

        await act.Should().ThrowAsync<InvalidBudgetYearCountException>();
    }

    [Fact]
    public async Task CreateDraftAsync_LineWithMoreYearsThanDurationImplies_Throws()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "DST", null, DurationMonths: 12, OverheadPercent: 0m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [50_000m, 50_000m])]); // 2 years, duration implies 1

        var act = () => f.Service.CreateDraftAsync(input, PiUserId);

        await act.Should().ThrowAsync<InvalidBudgetYearCountException>();
    }

    [Fact]
    public async Task CreateDraftAsync_WithOtherHeadAndNoCustomLabel_ThrowsArgumentException()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Other Head Proposal", ProposalType.ResearchProject, "DST", null, DurationMonths: 12, OverheadPercent: 10m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.Other, [50_000m], CustomLabel: null)]);

        var act = () => f.Service.CreateDraftAsync(input, PiUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateDraftAsync_WithOtherHeadAndCustomLabel_PersistsTheLabel()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Other Head Proposal 2", ProposalType.ResearchProject, "DST", null, DurationMonths: 12, OverheadPercent: 10m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.Other, [50_000m], CustomLabel: "Field trial costs")]);

        var id = await f.Service.CreateDraftAsync(input, PiUserId);
        var summary = await f.Service.GetAsync(id, PiUserId);

        summary.BudgetLines.Should().ContainSingle(l => l.CustomLabel == "Field trial costs");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(61)]
    public async Task CreateDraftAsync_DurationOutsideOneToSixty_ThrowsArgumentException(int months)
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "DST", null, DurationMonths: months, OverheadPercent: 0m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100_000m])]);

        var act = () => f.Service.CreateDraftAsync(input, PiUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Theory]
    [InlineData(28, 3)] // part of year 3 is used -> 3 columns, matching the client's own example
    [InlineData(60, 5)]
    [InlineData(1, 1)]
    [InlineData(12, 1)]
    [InlineData(13, 2)]
    public async Task CreateDraftAsync_YearColumnCount_IsCeilingOfDurationOverTwelve(int months, int expectedYears)
    {
        var f = await CreateAsync();
        var yearAmounts = Enumerable.Repeat(10_000m, expectedYears).ToList();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "DST", null, DurationMonths: months, OverheadPercent: 0m,
            BudgetLines: [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, yearAmounts)]);

        var id = await f.Service.CreateDraftAsync(input, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.ProposedAmount.Should().Be(10_000m * expectedYears);
    }

    // ---- SubmitForApprovalAsync -------------------------------------------------

    [Fact]
    public async Task SubmitForApprovalAsync_RaisesTheWorkflowInstanceAtDraftAndForwardsToHod()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval);
        summary.WorkflowInstanceId.Should().NotBeNull();
        summary.CurrentStage.Should().Be(WorkflowStage.WithHOD);
    }

    [Fact]
    public async Task SubmitForApprovalAsync_ByAnotherUser_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var act = () => f.Service.SubmitForApprovalAsync(id, Guid.NewGuid(), "Submitting for review");

        await act.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_Twice_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        var act = () => f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting again");

        await act.Should().ThrowAsync<InvalidProposalStatusException>();
    }

    [Fact]
    public async Task SubmitForApprovalAsync_ConcurrentUpdateFromAnotherContext_ThrowsRatherThanSilentlyLosingTheWrite()
    {
        // Reproduces the mechanism behind a live bug: a proposal was found in the
        // shared dev DB with Status = UnderApproval but WorkflowInstanceId = NULL,
        // so it could never show a Forward button to the HOD -- ProposalChainActions
        // .showForward requires a non-null currentStage, which requires a workflow
        // instance. ResearchProposal carried no concurrency token, so two requests
        // racing on the same row (a double-click, a retried request) could each
        // read-modify-write independently; on a real database the second write can
        // land after the first without EF ever knowing the row changed underneath
        // it, silently discarding whichever fields the first write set that the
        // second request's stale in-memory copy did not carry forward. Concurrency
        // tokens turn that silent loss into a DbUpdateConcurrencyException instead.
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);

        var second = await CreateSecondConnectionAsync(f);
        var proposalInFirstContext = await f.Db.ResearchProposals.FirstAsync(p => p.Id == id);
        var proposalInSecondContext = await second.Db.ResearchProposals.FirstAsync(p => p.Id == id);

        // First context wins the race and commits.
        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        // Second context still holds the pre-submit snapshot and tries to save
        // over it -- exactly what a second concurrent SubmitForApprovalAsync call
        // would do internally after it too passed the Draft check before the
        // first request committed.
        proposalInSecondContext.Title = "Should not silently overwrite the real submission";
        var act = () => second.Db.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateConcurrencyException>(
            "a concurrency token on ResearchProposal should refuse a write based on stale data " +
            "rather than let it silently overwrite WorkflowInstanceId/Status underneath the winner");
    }

    // ---- The full chain, forward through every stage --------------------------

    private static async Task<Guid> RaisedAndForwardedToAsync(
        Fixture f, WorkflowStage targetStage)
    {
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");

        // Indexed by the CURRENT stage: Forward checks the role the instance is
        // sitting at, before moving it on.
        var forwardOutOf = new (WorkflowStage Stage, Guid Actor, IReadOnlyCollection<string> Roles)[]
        {
            (WorkflowStage.WithHOD, Guid.NewGuid(), ["HOD"]),
            (WorkflowStage.WithRnCOffice, Guid.NewGuid(), Office),
            (WorkflowStage.AssignedToDealingAssistant, Guid.NewGuid(), Office),
            (WorkflowStage.WithSuperintendent, Guid.NewGuid(), Office),
            (WorkflowStage.WithDeputyRegistrar, Guid.NewGuid(), Office),
        };

        foreach (var (stage, actor, roles) in forwardOutOf)
        {
            if (stage == targetStage)
            {
                break;
            }

            await f.Service.ForwardAsync(id, actor, roles, "Reviewed, forwarding on");
        }

        return id;
    }

    [Fact]
    public async Task ForwardAsync_MovesThroughEveryStageInBrdOrder()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.WithDean);
        summary.Status.Should().Be(ProposalStatus.UnderApproval, "the chain has not concluded yet");
    }

    [Fact]
    public async Task AssignToDealingAssistantAsync_AtWithRnCOffice_SetsAssigneeAndAdvances()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithRnCOffice);
        var assignee = Guid.NewGuid();

        await f.Service.AssignToDealingAssistantAsync(id, assignee, Guid.NewGuid(), Office, "assigning to clerk1");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.AssignedToDealingAssistant);
    }

    [Fact]
    public async Task ForwardAsync_AtAssignedToDealingAssistant_ByADifferentRegularStaffAccount_Throws()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithRnCOffice);
        var assignee = Guid.NewGuid();
        await f.Service.AssignToDealingAssistantAsync(id, assignee, Guid.NewGuid(), Office, null);

        var act = () => f.Service.ForwardAsync(id, Guid.NewGuid(), ["RegularStaff"], null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task ForwardAsync_AtAssignedToDealingAssistant_ByTheAssignee_Succeeds()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithRnCOffice);
        var assignee = Guid.NewGuid();
        await f.Service.AssignToDealingAssistantAsync(id, assignee, Guid.NewGuid(), Office, null);

        await f.Service.ForwardAsync(id, assignee, ["RegularStaff"], "reviewed, forwarding on");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.WithSuperintendent);
    }

    [Fact]
    public async Task ApproveAsync_AtWithDean_EndorsesInternally_ButDoesNotFundAnything()
    {
        // The central rule of the whole phase.
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);

        await f.Service.ApproveAsync(id, Guid.NewGuid(), Dean, "endorsed");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Approved);
        summary.ProjectId.Should().BeNull("internal approval endorses submission, it does not commit funding");
        f.Db.Projects.Should().BeEmpty("nothing but RecordSanctionAsync may ever create a Project");
    }

    [Fact]
    public async Task WorkflowRoutedActions_AreNotDoubleLoggedToAuditLog()
    {
        // Phase 10's AuditLog is for write paths WorkflowStep does not
        // already cover. Approve, Forward, Reject and Return are all
        // WorkflowStep's own record -- WorkflowEngineService takes no
        // IAuditService dependency at all, and this proves it end to end
        // through a real chain rather than by reading the constructor.
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);

        await f.Service.ApproveAsync(id, Guid.NewGuid(), Dean, "endorsed");

        f.Db.AuditLogs.Should().BeEmpty();
    }

    [Fact]
    public async Task RejectAsync_AtWithSuperintendent_PermittedForOffice()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithSuperintendent);

        await f.Service.RejectAsync(id, Guid.NewGuid(), ["Superintendent"], "insufficient endorsement");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Rejected);
    }

    [Fact]
    public async Task RejectAsync_AtWithDean_PermittedForDeanAndDirector()
    {
        var f = await CreateAsync();
        var deanId = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);

        await f.Service.RejectAsync(deanId, Guid.NewGuid(), Dean, "insufficient endorsement");

        var deanSummary = await f.Service.GetAsync(deanId, PiUserId);
        deanSummary.Status.Should().Be(ProposalStatus.Rejected);

        var directorId = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);

        await f.Service.RejectAsync(directorId, Guid.NewGuid(), Director, "insufficient endorsement");

        var directorSummary = await f.Service.GetAsync(directorId, PiUserId);
        directorSummary.Status.Should().Be(ProposalStatus.Rejected);
    }

    [Fact]
    public async Task RejectAsync_AtWithDeputyRegistrar_PermittedForOffice()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);

        await f.Service.RejectAsync(id, Guid.NewGuid(), ["DeputyRegistrar"], "insufficient endorsement");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Rejected);
    }

    [Fact]
    public async Task ReturnAsync_AtWithDeputyRegistrar_PermittedForDeputyRegistrar()
    {
        // DeputyRegistrar gained explicit return rights under the new
        // CanReturn split (previously return rode on CanReject, which was
        // also true here, so the stage itself is not new -- what is new is
        // that Reject no longer works at this same stage, see above).
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);

        await f.Service.ReturnAsync(id, Guid.NewGuid(), Office, "please attach the endorsement certificate");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.ReturnedToPI);
        summary.Status.Should().Be(ProposalStatus.UnderApproval,
            "a returned proposal has moved backward within the chain, not left it");
    }

    [Fact]
    public async Task AfterReturn_ThePi_NotOfficeStaff_CanForwardOutOfTheReEntryPoint()
    {
        // ReturnedToPI carries no AllowedRoles, mirroring Draft: the engine's
        // role gate alone would let anyone through, so the service enforces
        // ownership itself here -- only the proposal's own owner may act.
        // Office staff must not be able to forward past the PI's own
        // correction stage on the PI's behalf.
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), Office, "fix this");

        var officeAttempt = () => f.Service.ForwardAsync(id, Guid.NewGuid(), Office, "resubmitted on the PI's behalf");
        await officeAttempt.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    [Fact]
    public async Task AfterReturn_ThePiCanForwardAgainFromTheReEntryPoint()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), Office, "fix this");

        await f.Service.ForwardAsync(id, PiUserId, [], "resubmitted");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.AssignedToDealingAssistant);
    }

    [Fact]
    public async Task AfterReturnAndPiForward_TheChainResumesNormally()
    {
        // Confirms the proposal is not merely at the right stage but actually
        // still live: the office can carry on forwarding it the rest of the way.
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), Office, "fix this");
        await f.Service.ForwardAsync(id, PiUserId, [], "resubmitted");

        await f.Service.ForwardAsync(id, Guid.NewGuid(), Office, "reviewed again");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.WithSuperintendent);
    }

    [Fact]
    public async Task ReturnAsync_AtWithHOD_PermittedForHOD()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithHOD);

        await f.Service.ReturnAsync(id, Guid.NewGuid(), ["HOD"], "please clarify the budget justification");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.ReturnedToPI);
        summary.Status.Should().Be(ProposalStatus.UnderApproval,
            "a returned proposal has moved backward within the chain, not left it");
    }

    [Fact]
    public async Task AfterHODReturn_ThePiCanForwardAgainFromTheReEntryPoint_AndItGoesBackToHOD()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithHOD);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), ["HOD"], "please clarify the budget justification");

        await f.Service.ForwardAsync(id, PiUserId, [], "clarified, resubmitting");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.WithHOD, "an HOD return must resubmit back through HOD, not to the office");
    }

    [Fact]
    public async Task AfterHODReturnAndPiForward_HODCanActOnItAgain()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithHOD);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), ["HOD"], "please clarify the budget justification");
        await f.Service.ForwardAsync(id, PiUserId, [], "clarified, resubmitting");

        await f.Service.ForwardAsync(id, Guid.NewGuid(), ["HOD"], "looks good now");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.WithRnCOffice);
    }

    [Fact]
    public async Task ReturnAsync_AtWithDeputyRegistrar_StillReEntersAtAssignedToDealingAssistant_NotWithHOD()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDeputyRegistrar);
        await f.Service.ReturnAsync(id, Guid.NewGuid(), Office, "fix this");

        await f.Service.ForwardAsync(id, PiUserId, [], "resubmitted");

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.CurrentStage.Should().Be(WorkflowStage.AssignedToDealingAssistant, "unchanged office-return behavior");
    }

    // ---- Agency submission and sanction -----------------------------------------

    private static async Task<Guid> ApprovedAsync(Fixture f)
    {
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);
        await f.Service.ApproveAsync(id, Guid.NewGuid(), Dean, null);
        await UploadDocumentAsync(f, id, DocumentKind.SanctionLetter);
        return id;
    }

    [Fact]
    public async Task RecordAgencySubmissionAsync_RequiresApprovedFirst()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var act = () => f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, DateOnly.FromDateTime(DateTime.UtcNow));

        await act.Should().ThrowAsync<InvalidProposalStatusException>();
    }

    [Fact]
    public async Task RecordSanctionAsync_RequiresSubmittedToAgencyFirst()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);

        var act = () => f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-1", DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow), 1_000_000m));

        await act.Should().ThrowAsync<InvalidProposalStatusException>();
    }

    [Fact]
    public async Task RecordSanctionAsync_CreatesAProjectAndLinksIt()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var submittedOn = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, submittedOn);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean,
            new RecordSanctionInput("SAN-2026-001", submittedOn, submittedOn, 1_000_000m));

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Sanctioned);
        summary.ProjectId.Should().Be(projectId);

        var project = f.Db.Projects.Single(p => p.Id == projectId);
        project.SanctionNo.Should().Be("SAN-2026-001");
        project.ProjectType.Should().Be(ProjectType.TypeIResearch);
    }

    [Fact]
    public async Task RecordSanctionAsync_WithNullProjectStartDate_DefaultsToSanctionDate()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var sanctionDate = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, sanctionDate);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean,
            new RecordSanctionInput("SAN-OPTIONAL-DATE", sanctionDate, null, 1_000_000m));

        var project = f.Db.Projects.Single(p => p.Id == projectId);
        project.StartDate.Should().Be(sanctionDate);
    }

    [Fact]
    public async Task RecordSanctionAsync_WithProjectStartDateEarlierThanSanctionDate_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var sanctionDate = new DateOnly(2026, 9, 20);
        var earlierStartDate = new DateOnly(2026, 9, 19);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, sanctionDate);

        var act = () => f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean,
            new RecordSanctionInput("SAN-EARLIER-DATE", sanctionDate, earlierStartDate, 1_000_000m));

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*cannot be earlier than sanction date*");
    }

    [Fact]
    public async Task RecordSanctionAsync_CarriesOverTheBlendedOverheadPercentToTheProject()
    {
        var f = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Overhead Carryover Test", ProposalType.ResearchProject, "DST", null, 12, 20m,
            [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [100000m], IncludeInOverhead: true)],
            [], []);
        var proposalId = await f.Service.CreateDraftAsync(input, PiUserId);
        await UploadDocumentAsync(f, proposalId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, proposalId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(proposalId, PiUserId, "Submitting for review");
        await f.Service.ForwardAsync(proposalId, Guid.NewGuid(), ["HOD"], "looks good");
        await f.Service.ForwardAsync(proposalId, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(proposalId, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(proposalId, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(proposalId, Guid.NewGuid(), Office, null);
        await f.Service.ApproveAsync(proposalId, Guid.NewGuid(), Dean, null);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(proposalId, Guid.NewGuid(), Dean, today);
        await UploadDocumentAsync(f, proposalId, DocumentKind.SanctionLetter);

        var projectId = await f.Service.RecordSanctionAsync(
            proposalId, Guid.NewGuid(), Dean,
            new RecordSanctionInput("SAN-CARRY-1", today, today, 120000m));

        var project = f.Db.Projects.Single(p => p.Id == projectId);
        project.OverheadPercent.Should().Be(20m); // 20000 overhead / 100000 proposed * 100
    }

    [Fact]
    public async Task RecordSanctionAsync_CarriesEveryBudgetLineOverAsABudgetHead()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, today);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-3", today, today, 1_000_000m));

        var heads = f.Db.BudgetHeads.Where(b => b.ProjectId == projectId).ToList();
        heads.Should().HaveCount(2);
        heads.Should().Contain(h => h.HeadName == BudgetHeadName.EquipmentNonRecurring && h.Total == 700_000m);
    }

    [Fact]
    public async Task RecordSanctionAsync_CarriesEveryYearOfEveryBudgetLineOver()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, today);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-YEARS", today, today, 1_000_000m));

        // ValidDraft()'s RecurringConsumable line: Year1=150,000, Year2=150,000.
        var head = f.Db.BudgetHeads.Single(b => b.ProjectId == projectId && b.HeadName == BudgetHeadName.RecurringConsumable);
        head.Year1Amount.Should().Be(150_000m);
        head.Year2Amount.Should().Be(150_000m);
        head.Year3Amount.Should().Be(0m);
        head.Total.Should().Be(300_000m);
    }

    [Fact]
    public async Task RecordSanctionAsync_CarriesEquipmentAndManpowerIntoTheProject()
    {
        var f = await CreateAsync();
        var draft = ValidDraft() with
        {
            Equipment = [new ProposalEquipmentInput("Spectrometer", "1", 500_000m)],
            Manpower = [new ProposalManpowerPositionInput("JRF", 2, 20m, [31_000m, 31_000m])],
        };
        var id = await f.Service.CreateDraftAsync(draft, PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review");
        await f.Service.ForwardAsync(id, Guid.NewGuid(), ["HOD"], "looks good");
        await f.Service.ForwardAsync(id, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(id, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(id, Guid.NewGuid(), Office, null);
        await f.Service.ForwardAsync(id, Guid.NewGuid(), Office, null);
        await f.Service.ApproveAsync(id, Guid.NewGuid(), Dean, null);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, today);
        await UploadDocumentAsync(f, id, DocumentKind.SanctionLetter);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-EQMP", today, today, 1_000_000m));

        f.Db.SanctionedEquipment.Should().ContainSingle(e => e.ProjectId == projectId && e.Name == "Spectrometer" && e.Amount == 500_000m);
        f.Db.SanctionedManpowerPositions.Should().ContainSingle(m => m.ProjectId == projectId && m.Designation == "JRF" && m.Positions == 2);
    }

    [Fact]
    public async Task RecordSanctionAsync_LineWithFewerThanFiveYears_LeavesRemainingYearsZero()
    {
        // ValidDraft() is a 24-month (2-year) proposal, so its BudgetHead rows
        // must carry Year3/4/5Amount = 0, not garbage or an out-of-range error.
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, today);

        var projectId = await f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-2YR", today, today, 1_000_000m));

        var head = f.Db.BudgetHeads.Single(b => b.ProjectId == projectId && b.HeadName == BudgetHeadName.EquipmentNonRecurring);
        head.Year3Amount.Should().Be(0m);
        head.Year4Amount.Should().Be(0m);
        head.Year5Amount.Should().Be(0m);
    }

    [Fact]
    public async Task RecordNotFundedAsync_EndsTheProposalWithoutAProject()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, DateOnly.FromDateTime(DateTime.UtcNow));

        await f.Service.RecordNotFundedAsync(id, Guid.NewGuid(), Dean);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.NotFunded);
        summary.ProjectId.Should().BeNull();
        f.Db.Projects.Should().BeEmpty();
    }

    // ---- Office-or-owner reach for the post-chain agency actions -----------------

    [Fact]
    public async Task RecordAgencySubmissionAsync_ByThePiThemselves_Succeeds()
    {
        // Confirms live 403: a PI recording their own approved proposal's
        // submission date must not need an Office role.
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);

        await f.Service.RecordAgencySubmissionAsync(
            id, PiUserId, TestRoles.Raiser, DateOnly.FromDateTime(DateTime.UtcNow));

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.SubmittedToAgency);
    }

    [Fact]
    public async Task RecordAgencySubmissionAsync_ByAnUnrelatedFacultyAccount_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);

        var act = () => f.Service.RecordAgencySubmissionAsync(
            id, Guid.NewGuid(), TestRoles.Raiser, DateOnly.FromDateTime(DateTime.UtcNow));

        await act.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    [Fact]
    public async Task RecordSanctionAsync_ByThePiThemselves_Succeeds()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);

        var projectId = await f.Service.RecordSanctionAsync(
            id, PiUserId, TestRoles.Raiser, new RecordSanctionInput("SAN-PI-1", today, today, 1_000_000m));

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Sanctioned);
        summary.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public async Task RecordSanctionAsync_ByAnUnrelatedFacultyAccount_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);

        var act = () => f.Service.RecordSanctionAsync(
            id, Guid.NewGuid(), TestRoles.Raiser, new RecordSanctionInput("SAN-PI-2", today, today, 1_000_000m));

        await act.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    [Fact]
    public async Task RecordNotFundedAsync_ByThePiThemselves_Succeeds()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        await f.Service.RecordAgencySubmissionAsync(
            id, PiUserId, TestRoles.Raiser, DateOnly.FromDateTime(DateTime.UtcNow));

        await f.Service.RecordNotFundedAsync(id, PiUserId, TestRoles.Raiser);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.NotFunded);
    }

    [Fact]
    public async Task RecordNotFundedAsync_ByAnUnrelatedFacultyAccount_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        await f.Service.RecordAgencySubmissionAsync(
            id, PiUserId, TestRoles.Raiser, DateOnly.FromDateTime(DateTime.UtcNow));

        var act = () => f.Service.RecordNotFundedAsync(id, Guid.NewGuid(), TestRoles.Raiser);

        await act.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    // ---- Withdrawal --------------------------------------------------------------

    [Fact]
    public async Task WithdrawAsync_FromDraft_Succeeds()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        await f.Service.WithdrawAsync(id, PiUserId);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Withdrawn);
    }

    [Fact]
    public async Task WithdrawAsync_AfterSanction_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, Guid.NewGuid(), Dean, today);
        await f.Service.RecordSanctionAsync(id, Guid.NewGuid(), Dean, new RecordSanctionInput("SAN-4", today, today, 1_000_000m));

        var act = () => f.Service.WithdrawAsync(id, PiUserId);

        await act.Should().ThrowAsync<InvalidProposalStatusException>();
    }

    [Fact]
    public async Task WithdrawAsync_ByAnotherUser_Throws()
    {
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var act = () => f.Service.WithdrawAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<NotTheProposalOwnerException>();
    }

    // ---- HOD department scoping ---------------------------------------------------

    [Fact]
    public async Task ListForHodAsync_ReturnsOnlyTheHodsOwnDepartment()
    {
        var f = await CreateAsync();

        // A proposal from the PI service (whose department the fixture sets to
        // DepartmentId), and a second one moved into a different department
        // after creation, simulating two PIs in two departments sharing one
        // ResearchProposalService instance -- the department a proposal is
        // scoped by lives on the row, not on whoever happens to call the
        // service, so this is a faithful way to get a second-department row.
        var ownId = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, ownId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, ownId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(ownId, PiUserId, "Submitting for review");

        var otherPi = Guid.NewGuid();
        var otherId = await f.Service.CreateDraftAsync(ValidDraft() with { Title = "Other dept" }, otherPi);
        f.Db.ResearchProposals.Single(p => p.Id == otherId).DepartmentId = HodDepartmentId;
        await f.Db.SaveChangesAsync();
        await UploadDocumentAsync(f, otherId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, otherId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(otherId, otherPi, "Submitting for review");

        var queue = await f.Service.ListForHodAsync(Guid.NewGuid()); // HOD is in DepartmentId per the fixture

        queue.Should().ContainSingle(p => p.Id == ownId);
        queue.Should().NotContain(p => p.Id == otherId);
    }

    [Fact]
    public async Task ListForHodAsync_OnlyShowsProposalsUnderApproval()
    {
        var f = await CreateAsync();
        var draftId = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        // Left in Draft: not yet submitted, so not the HOD's business yet.

        var queue = await f.Service.ListForHodAsync(Guid.NewGuid());

        queue.Should().NotContain(p => p.Id == draftId);
    }

    // ---- ListForRnCOfficeAsync --------------------------------------------------

    [Fact]
    public async Task ListForRnCOfficeAsync_RequiresTheCallerToBeInAnInstituteWideDepartment()
    {
        // Mirrors PageAccessService.IsInstituteWideAsync exactly: institute-wide
        // sight comes from R&C department membership, not role rank. An office
        // role whose own department is not flagged institute-wide (a
        // misconfigured account, or simply not RnC staff) sees nothing, rather
        // than every department's proposals by virtue of holding an office role.
        var f = await CreateAsync();
        f.Db.Departments.Add(new Department
        {
            Id = DepartmentId, Code = "CSE", Name = "Computer Science", IsInstituteWide = false,
        });
        await f.Db.SaveChangesAsync();

        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, id, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, id, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(id, PiUserId, "Submitting for review"); // -> WithHOD
        await f.Service.ForwardAsync(id, Guid.NewGuid(), ["HOD"], "looks good"); // WithHOD -> WithRnCOffice

        var officeUserId = Guid.NewGuid(); // also in DepartmentId, per FakeDepartment
        var queue = await f.Service.ListForRnCOfficeAsync(officeUserId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForRnCOfficeAsync_WithInstituteWideMembership_SeesEveryDepartmentsOfficeStageProposals()
    {
        var f = await CreateAsync();
        f.Db.Departments.Add(new Department
        {
            Id = DepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        await f.Db.SaveChangesAsync();

        var ownDeptId = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);
        await UploadDocumentAsync(f, ownDeptId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, ownDeptId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(ownDeptId, PiUserId, "Submitting for review"); // -> WithHOD
        await f.Service.ForwardAsync(ownDeptId, Guid.NewGuid(), ["HOD"], "looks good"); // -> WithRnCOffice

        var otherPi = Guid.NewGuid();
        var otherDeptId = await f.Service.CreateDraftAsync(ValidDraft() with { Title = "Other dept" }, otherPi);
        f.Db.ResearchProposals.Single(p => p.Id == otherDeptId).DepartmentId = HodDepartmentId;
        await f.Db.SaveChangesAsync();
        await UploadDocumentAsync(f, otherDeptId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, otherDeptId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(otherDeptId, otherPi, "Submitting for review"); // -> WithHOD
        await f.Service.ForwardAsync(otherDeptId, Guid.NewGuid(), ["HOD"], "looks good"); // -> WithRnCOffice, different department

        var officeUserId = Guid.NewGuid();
        var queue = await f.Service.ListForRnCOfficeAsync(officeUserId);

        queue.Should().Contain(p => p.Id == ownDeptId);
        queue.Should().Contain(p => p.Id == otherDeptId, "office staff act across every department, not just their own");
    }

    [Fact]
    public async Task ListForRnCOfficeAsync_OnlyShowsTheOfficeChainStages()
    {
        // Draft and WithHOD are the PI's/HOD's business, not the office's yet.
        var f = await CreateAsync();
        f.Db.Departments.Add(new Department
        {
            Id = DepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        await f.Db.SaveChangesAsync();

        var draftId = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var atHodId = await f.Service.CreateDraftAsync(ValidDraft() with { Title = "At HOD" }, PiUserId);
        await UploadDocumentAsync(f, atHodId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, atHodId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(atHodId, PiUserId, "Submitting for review"); // -> WithHOD

        var atOfficeId = await f.Service.CreateDraftAsync(ValidDraft() with { Title = "At office" }, PiUserId);
        await UploadDocumentAsync(f, atOfficeId, DocumentKind.SignedCopy);
        await UploadDocumentAsync(f, atOfficeId, DocumentKind.EndorsementCertificate);
        await f.Service.SubmitForApprovalAsync(atOfficeId, PiUserId, "Submitting for review"); // -> WithHOD
        await f.Service.ForwardAsync(atOfficeId, Guid.NewGuid(), ["HOD"], "looks good"); // -> WithRnCOffice

        var queue = await f.Service.ListForRnCOfficeAsync(Guid.NewGuid());

        queue.Should().NotContain(p => p.Id == draftId);
        queue.Should().NotContain(p => p.Id == atHodId);
        queue.Should().Contain(p => p.Id == atOfficeId);
    }

    // ---- ExtendExpiryAsync -----------------------------------------------------

    // ---- UndoLastActionAsync: keeping Status in sync with CurrentStage -------

    [Fact]
    public async Task UndoLastActionAsync_AfterApprove_RevertsStatusBackToUnderApproval()
    {
        // ApproveAsync sets Status = Approved OUTSIDE the engine, after
        // delegating to WorkflowEngineService.ApproveAsync. The engine's own
        // UndoLastActionAsync only knows about CurrentStage/WorkflowStep --
        // it has no idea Status exists -- so without this fix, undoing an
        // Approve correctly reverts CurrentStage to WithDean but leaves
        // Status stuck at Approved, and RequireUnderApprovalAsync (which every
        // subsequent chain action goes through) would then throw forever.
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);
        var approver = Guid.NewGuid();

        await f.Service.ApproveAsync(id, approver, Dean, "endorsed");
        (await f.Service.GetAsync(id, PiUserId)).Status.Should().Be(ProposalStatus.Approved);

        await f.Service.UndoLastActionAsync(id, approver, Dean);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval,
            "otherwise the proposal is permanently bricked -- no path resets Status back from Approved");
        summary.CurrentStage.Should().Be(WorkflowStage.WithDean);

        // A subsequent Approve must succeed, not throw InvalidProposalStatusException.
        await f.Service.ApproveAsync(id, approver, Dean, "endorsed again");
        (await f.Service.GetAsync(id, PiUserId)).Status.Should().Be(ProposalStatus.Approved);
    }

    [Fact]
    public async Task UndoLastActionAsync_AfterReject_RevertsStatusBackToUnderApproval()
    {
        var f = await CreateAsync();
        var id = await RaisedAndForwardedToAsync(f, WorkflowStage.WithDean);
        var rejecter = Guid.NewGuid();

        await f.Service.RejectAsync(id, rejecter, Dean, "insufficient endorsement");
        (await f.Service.GetAsync(id, PiUserId)).Status.Should().Be(ProposalStatus.Rejected);

        await f.Service.UndoLastActionAsync(id, rejecter, Dean);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.UnderApproval,
            "otherwise the proposal is permanently bricked -- no path resets Status back from Rejected");

        // A subsequent Approve must succeed now that Status is no longer stuck.
        await f.Service.ApproveAsync(id, rejecter, Dean, "endorsed after all");
        (await f.Service.GetAsync(id, PiUserId)).Status.Should().Be(ProposalStatus.Approved);
    }

    // ---- UndoLastActionAsync: the Sanction-unwind path -----------------------

    [Fact]
    public async Task UndoLastActionAsync_SanctionedWithNoDownstreamActivity_HardDeletesTheProjectAndRevertsStatus()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);
        var sanctioningActor = Guid.NewGuid();
        var projectId = await f.Service.RecordSanctionAsync(
            id, sanctioningActor, Dean, new RecordSanctionInput("SAN-UNDO-1", today, today, 1_000_000m));

        f.Db.Projects.Should().ContainSingle(p => p.Id == projectId);

        await f.Service.UndoLastActionAsync(id, sanctioningActor, Dean);

        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.SubmittedToAgency);
        summary.ProjectId.Should().BeNull();
        f.Db.Projects.Should().NotContain(p => p.Id == projectId, "the Project must be hard-deleted, not merely unlinked");
    }

    [Fact]
    public async Task UndoLastActionAsync_SanctionedByADifferentActor_Throws()
    {
        // RecordSanctionAsync never calls AppendStep, so there is no
        // WorkflowStep for the engine's own actor check to compare against --
        // ResearchProposalService.UndoLastActionAsync's Sanction branch must
        // enforce the same "only the original actor may undo" rule itself,
        // against SanctionedByUserId. Before this fix, any office role (or
        // the PI) could hard-delete a Project they had no part in sanctioning.
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);
        var sanctioningActor = Guid.NewGuid();
        var someoneElse = Guid.NewGuid();
        var projectId = await f.Service.RecordSanctionAsync(
            id, sanctioningActor, Dean, new RecordSanctionInput("SAN-UNDO-4", today, today, 1_000_000m));

        var act = () => f.Service.UndoLastActionAsync(id, someoneElse, Dean);

        await act.Should().ThrowAsync<CannotUndoException>();

        // Confirm the refusal is genuinely a no-op: nothing was touched.
        f.Db.Projects.Should().ContainSingle(p => p.Id == projectId);
        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Sanctioned);
        summary.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public async Task UndoLastActionAsync_SanctionedWithAGrantReceiptAlreadyRecorded_Throws()
    {
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);
        var sanctioningActor = Guid.NewGuid();
        var projectId = await f.Service.RecordSanctionAsync(
            id, sanctioningActor, Dean, new RecordSanctionInput("SAN-UNDO-2", today, today, 1_000_000m));

        var budgetHeadId = f.Db.BudgetHeads.First(b => b.ProjectId == projectId).Id;
        f.Db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            ReceivedDate = today,
            Amount = 50_000m,
            Type = GrantReceiptType.Head,
        });
        await f.Db.SaveChangesAsync();

        var act = () => f.Service.UndoLastActionAsync(id, sanctioningActor, Dean);

        await act.Should().ThrowAsync<CannotUndoException>();

        // Confirm the refusal is genuinely a no-op: nothing was touched.
        f.Db.Projects.Should().ContainSingle(p => p.Id == projectId);
        f.Db.GrantReceipts.Should().ContainSingle(g => g.ProjectId == projectId);
        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Sanctioned);
        summary.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public async Task UndoLastActionAsync_SanctionedWithAnExpenditureAlreadyRecorded_Throws()
    {
        // Expenditure carries a ProjectId with no FK/cascade protection at all
        // (only an index) -- unlike GrantReceipts and BudgetReappropriationLogs,
        // a hard delete of the Project would not even fail loudly here, it
        // would just silently orphan the row. The "untouched" check must catch
        // this case too, not just the two cascade-configured tables.
        var f = await CreateAsync();
        var id = await ApprovedAsync(f);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await f.Service.RecordAgencySubmissionAsync(id, PiUserId, TestRoles.Raiser, today);
        var sanctioningActor = Guid.NewGuid();
        var projectId = await f.Service.RecordSanctionAsync(
            id, sanctioningActor, Dean, new RecordSanctionInput("SAN-UNDO-3", today, today, 1_000_000m));

        f.Db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            SectionType = "Consumables",
            TransactionDate = today,
            Amount = 10_000m,
        });
        await f.Db.SaveChangesAsync();

        var act = () => f.Service.UndoLastActionAsync(id, sanctioningActor, Dean);

        await act.Should().ThrowAsync<CannotUndoException>();

        // Confirm the refusal is genuinely a no-op: nothing was touched.
        f.Db.Projects.Should().ContainSingle(p => p.Id == projectId);
        f.Db.Expenditure.Should().ContainSingle(e => e.ProjectId == projectId);
        var summary = await f.Service.GetAsync(id, PiUserId);
        summary.Status.Should().Be(ProposalStatus.Sanctioned);
        summary.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public async Task ExtendExpiryAsync_NonPositiveAdditionalDays_Throws()
    {
        // additionalDays reaches AddDays with no validation -- a negative
        // value would move ExpiresAt backward instead of extending it,
        // effectively expiring the proposal's current stage early.
        var f = await CreateAsync();
        var id = await f.Service.CreateDraftAsync(ValidDraft(), PiUserId);

        var act = () => f.Service.ExtendExpiryAsync(id, Guid.NewGuid(), additionalDays: -5);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateDraftAsync_ManpowerStipendVariesByYear_PersistsPerYearAndComputesHraDynamically()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 36, 0,
            [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [10000m, 10000m, 10000m])],
            Manpower:
            [
                new ProposalManpowerPositionInput("JRF", 1, 20m, [25000m, 27000m, 30000m]),
            ]);

        var id = await fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        var proposal = await fixture.Db.ResearchProposals
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .SingleAsync(p => p.Id == id);

        var position = proposal.Manpower.Single();
        position.Designation.Should().Be("JRF");
        position.Positions.Should().Be(1);
        position.HraPercent.Should().Be(20m);
        position.Years.OrderBy(y => y.Year).Select(y => y.Stipend).Should().Equal(25000m, 27000m, 30000m);
    }

    [Fact]
    public async Task CreateDraftAsync_ManpowerStipendYearCountMismatch_Throws()
    {
        var fixture = await CreateAsync();
        var input = new CreateProposalDraftInput(
            "Title", ProposalType.ResearchProject, "Agency", null, 36, 0,
            [new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [10000m, 10000m, 10000m])],
            Manpower: [new ProposalManpowerPositionInput("JRF", 1, 20m, [25000m])]);

        var act = () => fixture.Service.CreateDraftAsync(input, Guid.NewGuid());

        await act.Should().ThrowAsync<Exception>();
    }
}
