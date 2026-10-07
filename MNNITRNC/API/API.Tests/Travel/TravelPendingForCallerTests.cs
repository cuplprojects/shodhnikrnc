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
/// <see cref="ITravelRequestService.ListPendingForCallerAsync"/> -- the
/// dashboard's "pending my action" panel for travel requests. Mirrors
/// <c>IndentPendingQueryServiceTests.HodSeesOnlyIndentsInVisibleProjectsAtItsOwnStage</c>:
/// a real <see cref="TravelRequestService"/> against a real in-memory
/// <see cref="TestProcurementDbContext"/>, with a fake per-user department
/// provider so an HOD's visibility can be scoped to one department.
/// </summary>
public class TravelPendingForCallerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Onward = new(2024, 7, 10);
    private static readonly DateOnly Return = new(2024, 7, 14);
    private static readonly string[] HodRole = ["HOD"];

    private sealed class FakeDepartmentPerUser(Dictionary<Guid, Guid?> byUser, Guid? fallback) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(byUser.TryGetValue(userId, out var dept) ? dept : fallback);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db,
        TravelRequestService Service,
        Dictionary<Guid, Guid?> DepartmentByUser);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var budgetValidator = new IndentBudgetValidator(db, new ProjectYearCalculator());
        var workflow = new WorkflowEngineService(db);
        var docGen = new StubTravelDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();

        var departmentByUser = new Dictionary<Guid, Guid?>();
        var departmentProvider = new FakeDepartmentPerUser(departmentByUser, null);

        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), pendingQuery);

        var service = new TravelRequestService(
            db, budgetValidator, workflow, docGen, storage, faculty, projectService, pendingQuery);

        return new Fixture(db, service, departmentByUser);
    }

    private static async Task<(Guid ProjectId, Guid BudgetHeadId)> SeedProjectAsync(
        TestProcurementDbContext db, Guid ownerUserId, Guid departmentId, decimal year1Budget = 500_000m)
    {
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = $"SAN-{Guid.NewGuid():N}"[..10],
            SanctionDate = ProjectStart,
            ProjectTitle = "Travel Pending Test Project",
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
        await db.SaveChangesAsync();

        return (projectId, budgetHeadId);
    }

    private static RaiseTravelInput Input(Guid projectId, Guid budgetHeadId) =>
        new(
            ProjectId: projectId,
            BudgetHeadIds: [budgetHeadId],
            TravelerType: TravelerType.Self,
            ManpowerId: null,
            CoPiName: null,
            CoPiDesignation: null,
            Place: "New Delhi",
            Purpose: "Conference presentation",
            OnwardDate: Onward,
            ReturnDate: Return,
            PrimaryMode: TravelMode.Rail,
            TaxiReimbursementOptedIn: false,
            AccommodationDetails: "Guest house",
            AccommodationCost: 5_000m,
            OtherExpensesDetails: "Registration fee",
            OtherExpensesCost: 2_000m,
            Journeys:
            [
                new JourneyLegInput("Prayagraj", "New Delhi", Onward, TravelMode.Rail, BookingPlatform.IRCTC, 1_500m, null),
                new JourneyLegInput("New Delhi", "Prayagraj", Return, TravelMode.Rail, BookingPlatform.IRCTC, 1_500m, null),
            ],
            TaxiReason: null);

    /// <summary>
    /// Moves the given workflow instance directly to SignedCopyUploaded --
    /// the generic ShippedRoute's HOD stage (WorkflowDefinitionSeeder.ShippedRoute
    /// sequence 2: "HOD"), reached from Raised by UploadSignedCopyAsync in
    /// production. Set directly here, mirroring
    /// IndentPendingQueryServiceTests.MoveToHodStageAsync, since only the
    /// resulting stage matters for this test.
    /// </summary>
    private static async Task MoveToHodStageAsync(TestProcurementDbContext db, Guid workflowInstanceId)
    {
        var instance = await db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task HodSeesOnlyTravelRequestsInVisibleProjectsAtOwnStage()
    {
        var f = Create();

        var departmentA = Guid.NewGuid();
        var departmentB = Guid.NewGuid();

        var ownerA = Guid.NewGuid();
        f.DepartmentByUser[ownerA] = departmentA;
        var (projectAId, headAId) = await SeedProjectAsync(f.Db, ownerA, departmentA);

        var ownerB = Guid.NewGuid();
        f.DepartmentByUser[ownerB] = departmentB;
        var (projectBId, headBId) = await SeedProjectAsync(f.Db, ownerB, departmentB);

        // 1. Travel request in department A's project, moved to the HOD stage.
        var request1Id = await f.Service.RaiseAsync(Input(projectAId, headAId), ownerA);
        var request1 = await f.Db.TravelRequests.FirstAsync(t => t.Id == request1Id);
        await MoveToHodStageAsync(f.Db, request1.WorkflowInstanceId);

        // 2. Second travel request in department A's project, left at Raised.
        await f.Service.RaiseAsync(Input(projectAId, headAId), ownerA);

        // 3. Third travel request in department B's (non-visible) project, also at the HOD stage.
        var request3Id = await f.Service.RaiseAsync(Input(projectBId, headBId), ownerB);
        var request3 = await f.Db.TravelRequests.FirstAsync(t => t.Id == request3Id);
        await MoveToHodStageAsync(f.Db, request3.WorkflowInstanceId);

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = departmentA;

        var result = await f.Service.ListPendingForCallerAsync(hodUserId, HodRole);

        result.Should().ContainSingle(t => t.Id == request1Id);
        result.Single().ProjectId.Should().Be(projectAId);
        result.Single().CurrentStage.Should().Be(WorkflowStage.SignedCopyUploaded);
    }
}
