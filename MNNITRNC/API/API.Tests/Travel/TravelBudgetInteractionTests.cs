using API.Application.Access;
using API.Application.Audit;
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

namespace API.Tests.Travel;

/// <summary>
/// Travel and procurement draw against the same budget heads, so
/// <see cref="IndentBudgetValidator"/> must count both. Without this, each slice
/// would see money the other had already committed and a head could be
/// over-committed by raising one of each.
/// </summary>
public class TravelBudgetInteractionTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Onward = new(2024, 7, 10);
    private static readonly DateOnly Return = new(2024, 7, 12);
    private static readonly DateOnly InYearOne = new(2024, 7, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        TravelRequestService Travel,
        ConsumableIndentService Indents,
        IndentBudgetValidator Validator,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid SharedHeadId);

    /// <summary>
    /// Both services point at one head. A real project would use RecurringTravel
    /// for travel, but sharing a single head is what actually exercises the
    /// combined sum.
    /// </summary>
    private static Fixture Create(decimal year1Budget)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var headId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-X1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Shared Head Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 5_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = headId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringTravel,
            Year1Amount = year1Budget,
            Year2Amount = year1Budget,
            Year3Amount = year1Budget,
            Total = year1Budget * 3,
        });
        db.SaveChanges();

        var validator = new IndentBudgetValidator(db, new ProjectYearCalculator());
        var workflow = new WorkflowEngineService(db);
        var workflowDefinitions = new WorkflowDefinitionService(db);
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();

        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider), new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var travel = new TravelRequestService(
            db, validator, workflow, new StubTravelDocumentGenerationService(), storage, faculty, projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var indents = new ConsumableIndentService(
            db, new ProcurementTierCalculator(), validator, workflow, workflowDefinitions,
            new StubDocumentGenerationService(), storage, faculty, projectService);

        return new Fixture(db, travel, indents, validator, ownerUserId, projectId, headId);
    }

    private static RaiseTravelInput TravelInput(Fixture f, decimal legAmount) =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadIds: [f.SharedHeadId],
            TravelerType: TravelerType.Self,
            ManpowerId: null,
            CoPiName: null,
            CoPiDesignation: null,
            Place: "Bengaluru",
            Purpose: "Field work",
            OnwardDate: Onward,
            ReturnDate: Return,
            PrimaryMode: TravelMode.Air,
            TaxiReimbursementOptedIn: false,
            AccommodationDetails: null,
            AccommodationCost: 0m,
            OtherExpensesDetails: null,
            OtherExpensesCost: 0m,
            Journeys:
            [
                new JourneyLegInput("Prayagraj", "Bengaluru", Onward,
                    TravelMode.Air, BookingPlatform.BalmerLawrie, legAmount, null),
            ]);

    private static RaiseIndentInput IndentInput(Fixture f, decimal cost) =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.SharedHeadId,
            Name: "Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research use",
            GemAvailability: GemAvailability.Yes,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: null,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            SanctionedEquipmentId: null,
            CommitteeMembers: [],
            GemQuotationPdf: null);

    [Fact]
    public async Task CommittedIncludesTravelRequests()
    {
        var f = Create(year1Budget: 100_000m);

        await f.Travel.RaiseAsync(TravelInput(f, 20_000m), f.OwnerUserId);

        var snapshot = await f.Validator.GetSnapshotAsync(f.SharedHeadId, InYearOne);
        snapshot.Committed.Should().Be(20_000m);
        snapshot.Available.Should().Be(80_000m);
    }

    [Fact]
    public async Task CommittedSumsTravelAndIndentsOnTheSameHead()
    {
        var f = Create(year1Budget: 100_000m);

        await f.Travel.RaiseAsync(TravelInput(f, 20_000m), f.OwnerUserId);
        await f.Indents.RaiseAsync(IndentInput(f, 30_000m), f.OwnerUserId);

        var snapshot = await f.Validator.GetSnapshotAsync(f.SharedHeadId, InYearOne);
        snapshot.Committed.Should().Be(50_000m);
        snapshot.Available.Should().Be(50_000m);
    }

    /// <summary>
    /// The regression this whole change exists to prevent: before travel was
    /// counted, this second raise would have succeeded and over-committed the head.
    /// </summary>
    [Fact]
    public async Task IndentIsRejectedWhenTravelHasConsumedTheHead()
    {
        var f = Create(year1Budget: 100_000m);

        await f.Travel.RaiseAsync(TravelInput(f, 90_000m), f.OwnerUserId);

        var act = () => f.Indents.RaiseAsync(IndentInput(f, 20_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task TravelIsRejectedWhenIndentsHaveConsumedTheHead()
    {
        var f = Create(year1Budget: 100_000m);

        await f.Indents.RaiseAsync(IndentInput(f, 90_000m), f.OwnerUserId);

        var act = () => f.Travel.RaiseAsync(TravelInput(f, 20_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }
}
