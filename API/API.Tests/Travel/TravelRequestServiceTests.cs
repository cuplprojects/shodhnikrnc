using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Travel;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Travel;

public class TravelRequestServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Onward = new(2024, 7, 10);
    private static readonly DateOnly Return = new(2024, 7, 14);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        TravelRequestService Service,
        WorkflowEngineService Workflow,
        StubTravelDocumentGenerationService DocGen,
        StubDocumentStorageService Storage,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId,
        Guid ManpowerId);

    private static Fixture Create(decimal year1Budget = 500_000m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var manpowerId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-T1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Travel Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 5_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringTravel,
            Year1Amount = year1Budget,
            Year2Amount = year1Budget,
            Year3Amount = year1Budget,
            Total = year1Budget * 3,
        });
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = manpowerId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 31_000m,
            Hra = 0m,
        });
        db.SaveChanges();

        var budgetValidator = new IndentBudgetValidator(db, new ProjectYearCalculator());
        var workflow = new WorkflowEngineService(db);
        var docGen = new StubTravelDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));

        var service = new TravelRequestService(
            db, budgetValidator, workflow, docGen, storage, new StubFacultyProfileProvider(), projectService,
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));

        return new Fixture(
            db, service, workflow, docGen, storage,
            ownerUserId, projectId, budgetHeadId, manpowerId);
    }

    private static RaiseTravelInput Input(
        Fixture f,
        TravelerType travelerType = TravelerType.Self,
        Guid? manpowerId = null,
        string? coPiName = null,
        string? coPiDesignation = null,
        bool taxiOptedIn = false,
        string? taxiReason = null,
        decimal accommodation = 5_000m,
        decimal other = 2_000m,
        IReadOnlyList<JourneyLegInput>? journeys = null,
        DateOnly? onward = null,
        DateOnly? ret = null,
        string purpose = "Conference presentation") =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadIds: [f.BudgetHeadId],
            TravelerType: travelerType,
            ManpowerId: manpowerId,
            CoPiName: coPiName,
            CoPiDesignation: coPiDesignation,
            Place: "New Delhi",
            Purpose: purpose,
            OnwardDate: onward ?? Onward,
            ReturnDate: ret ?? Return,
            PrimaryMode: TravelMode.Rail,
            TaxiReimbursementOptedIn: taxiOptedIn,
            AccommodationDetails: "Guest house",
            AccommodationCost: accommodation,
            OtherExpensesDetails: "Registration fee",
            OtherExpensesCost: other,
            Journeys: journeys ??
            [
                new JourneyLegInput("Prayagraj", "New Delhi", Onward, TravelMode.Rail, BookingPlatform.IRCTC, 1_500m, null),
                new JourneyLegInput("New Delhi", "Prayagraj", Return, TravelMode.Rail, BookingPlatform.IRCTC, 1_500m, null),
            ],
            TaxiReason: taxiOptedIn ? (taxiReason ?? "Official visit requires private taxi travel.") : null);

    /// <summary>Drives a travel request's workflow instance from Raised to Approved.</summary>
    private static async Task ApproveAsync(Fixture f, Guid workflowInstanceId)
    {
        var actor = f.OwnerUserId;
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);
        // Raiser carries no Faculty role, so UploadSignedCopyAsync always
        // routes a travel request through WithPITravel first (the
        // Fellow-raised path -- see WorkflowEngineService.UploadSignedCopyAsync).
        // Only Forward (not Assign) is valid from WithPITravel; it moves the
        // instance on to SignedCopyUploaded, where Assign becomes valid.
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Hod, "PI review complete.");
        await f.Workflow.AssignAsync(workflowInstanceId, actor, actor, Hod, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ApproveAsync(workflowInstanceId, actor, Dean, null);
    }

    [Fact]
    public async Task RaiseAsync_ComputesCostFromLegsAndExpenses()
    {
        var f = Create();

        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        saved.JourneyTotalCost.Should().Be(3_000m);
        // 1500 + 1500 legs, 5000 accommodation, 2000 other.
        saved.ExpectedCost.Should().Be(10_000m);
    }

    [Fact]
    public async Task RaiseAsync_PersistsLegsInSubmissionOrder()
    {
        var f = Create();

        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var legs = await f.Db.TravelJourneyLegs
            .Where(l => l.TravelRequestId == id)
            .OrderBy(l => l.SequenceOrder)
            .ToListAsync();

        legs.Should().HaveCount(2);
        legs[0].SequenceOrder.Should().Be(1);
        legs[0].JourneyTo.Should().Be("New Delhi");
        legs[1].SequenceOrder.Should().Be(2);
        legs[1].JourneyTo.Should().Be("Prayagraj");
    }

    [Fact]
    public async Task RaiseAsync_GeneratesAndStoresTheRequestForm()
    {
        var f = Create();

        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        f.DocGen.RequestForms.Should().HaveCount(1);
        f.Storage.Saved.Should().HaveCount(1);

        var document = await f.Db.Documents.FirstAsync(d => d.OwnerId == id);
        document.OwnerType.Should().Be("TravelRequest");
        document.Kind.Should().Be(DocumentKind.TravelRequestForm);
    }

    [Fact]
    public async Task RaiseAsync_RaisesAnIndentPhaseWorkflowInstance()
    {
        var f = Create();

        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);

        instance.RequestType.Should().Be(RequestType.Travel);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
        instance.CurrentStage.Should().Be(WorkflowStage.Raised);
    }

    [Fact]
    public async Task RaiseAsync_ProjectHasDaAssigned_NewInstanceAssignedToDaUser()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        var travelRequestId = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == travelRequestId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.AssignedToUserId.Should().Be(daUserId);
        instance.IsAssignedViaProjectDa.Should().BeTrue();
    }

    [Fact]
    public async Task RaiseAsync_WithBlankPurpose_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(Input(f, purpose: "   "), f.OwnerUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RaiseAsync_ExceedingAvailableBudget_Throws()
    {
        var f = Create(year1Budget: 5_000m);

        var act = () => f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task RaiseAsync_WithNoJourneyLegs_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(Input(f, journeys: []), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*at least one journey leg*");
    }

    [Fact]
    public async Task RaiseAsync_ReturnBeforeOnward_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(
            Input(f, onward: new DateOnly(2024, 7, 14), ret: new DateOnly(2024, 7, 10)),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*return date cannot be earlier*");
    }

    [Fact]
    public async Task RaiseAsync_LegOutsideTravelWindow_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(
            Input(f, journeys:
            [
                new JourneyLegInput("Prayagraj", "New Delhi", new DateOnly(2024, 8, 1),
                    TravelMode.Rail, BookingPlatform.IRCTC, 1_500m, null),
            ]),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*outside the travel period*");
    }

    [Theory]
    [InlineData(TravelerType.Self, "Someone", "Professor", null)]
    [InlineData(TravelerType.CoPi, null, null, null)]
    [InlineData(TravelerType.Manpower, "Someone", "Professor", null)]
    public async Task RaiseAsync_InconsistentTravelerFields_Throws(
        TravelerType type, string? coPiName, string? coPiDesignation, Guid? manpowerId)
    {
        var f = Create();

        // Manpower with co-PI fields set is invalid regardless of the id.
        var mid = type == TravelerType.Manpower ? f.ManpowerId : manpowerId;

        var act = () => f.Service.RaiseAsync(
            Input(f, travelerType: type, manpowerId: mid,
                coPiName: coPiName, coPiDesignation: coPiDesignation),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_ValidCoPiRequest_Succeeds()
    {
        var f = Create();

        var id = await f.Service.RaiseAsync(
            Input(f, travelerType: TravelerType.CoPi,
                coPiName: "Dr. B Verma", coPiDesignation: "Associate Professor"),
            f.OwnerUserId);

        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        saved.TravelerType.Should().Be(TravelerType.CoPi);
        saved.CoPiName.Should().Be("Dr. B Verma");
    }

    [Fact]
    public async Task RaiseAsync_ForAnotherUsersProject_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(Input(f), Guid.NewGuid());

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ProcessBillAsync_BeforeApproval_Throws()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Service.ProcessBillAsync(
            id, new ProcessTravelBillInput("BILL-1", null, 9_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*must be approved*");
    }

    /// <summary>
    /// The BRD's hard rule: taxi reimbursement is only available when it was
    /// selected at submission.
    /// </summary>
    [Fact]
    public async Task ProcessBillAsync_TaxiCostWithoutOptIn_Throws()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f, taxiOptedIn: false), f.OwnerUserId);
        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        await ApproveAsync(f, saved.WorkflowInstanceId);

        var act = () => f.Service.ProcessBillAsync(
            id, new ProcessTravelBillInput("BILL-1", 800m, 9_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<TaxiNotOptedInException>();
    }

    [Fact]
    public async Task ProcessBillAsync_TaxiCostWithOptIn_Succeeds()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f, taxiOptedIn: true), f.OwnerUserId);
        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        await ApproveAsync(f, saved.WorkflowInstanceId);

        await f.Service.ProcessBillAsync(
            id, new ProcessTravelBillInput("BILL-1", 800m, 9_000m), f.OwnerUserId);

        var billed = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        billed.TaxiCost.Should().Be(800m);
        billed.ActualCost.Should().Be(9_000m);
        billed.OriginalBillReference.Should().Be("BILL-1");
    }

    [Fact]
    public async Task ProcessBillAsync_ProjectHasDa_BillPhaseInstanceIsAssignedToDa()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f, taxiOptedIn: true), f.OwnerUserId);
        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        await ApproveAsync(f, saved.WorkflowInstanceId);

        // Assign the project's DA only AFTER the initial instance was
        // raised and approved, proving the LATER, separate Bill-phase
        // instance still picks it up even though it didn't exist yet at
        // the initial raise.
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        await f.Service.ProcessBillAsync(
            id, new ProcessTravelBillInput("BILL-DA-1", 800m, 9_000m), f.OwnerUserId);

        var billInstance = await f.Db.WorkflowInstances
            .FirstAsync(w => w.RequestId == id && w.Phase == WorkflowPhase.Bill);
        billInstance.AssignedToUserId.Should().Be(daUserId);
        billInstance.IsAssignedViaProjectDa.Should().BeTrue();
    }

    /// <summary>
    /// A request that did not opt in may still be billed -- the rule blocks the
    /// taxi component only, not reimbursement as a whole.
    /// </summary>
    [Fact]
    public async Task ProcessBillAsync_WithoutOptInAndWithoutTaxiCost_Succeeds()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f, taxiOptedIn: false), f.OwnerUserId);
        var saved = await f.Db.TravelRequests.FirstAsync(t => t.Id == id);
        await ApproveAsync(f, saved.WorkflowInstanceId);

        await f.Service.ProcessBillAsync(
            id, new ProcessTravelBillInput("BILL-2", null, 9_500m), f.OwnerUserId);

        f.DocGen.CoverLetters.Should().HaveCount(1);
        var billPhase = await f.Db.WorkflowInstances
            .FirstOrDefaultAsync(w => w.RequestId == id && w.Phase == WorkflowPhase.Bill);
        billPhase.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAsync_ReturnsLegsInOrder()
    {
        var f = Create();
        var id = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var detail = await f.Service.GetAsync(id, f.OwnerUserId);

        detail.Journeys.Should().HaveCount(2);
        detail.Journeys[0].To.Should().Be("New Delhi");
        detail.Summary.ExpectedCost.Should().Be(10_000m);
    }

    [Fact]
    public async Task ListForProjectAsync_ReturnsRaisedRequests()
    {
        var f = Create();
        await f.Service.RaiseAsync(Input(f), f.OwnerUserId);
        await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var list = await f.Service.ListForProjectAsync(f.ProjectId, f.OwnerUserId);

        list.Should().HaveCount(2);
        list.Should().OnlyContain(t => t.CurrentStage == WorkflowStage.Raised);
    }

    [Fact]
    public async Task RaiseAsync_TaxiOptedInWithoutReason_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(
            Input(f, taxiOptedIn: true, taxiReason: ""), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*strong mandatory reason for taxi travel is required*");
    }

    [Fact]
    public async Task RaiseAsync_AirTravelWithOtherBookingPlatform_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(
            Input(f, journeys:
            [
                new JourneyLegInput("Prayagraj", "New Delhi", Onward, TravelMode.Air, BookingPlatform.Other, 5_000m, null)
            ]),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Eligible booking platforms for air tickets are strictly restricted*");
    }
}
