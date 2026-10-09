using API.Application.Access;
using API.Application.Audit;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

/// <summary>
/// <see cref="IIndentPendingQueryService"/> -- the dashboard's "pending my
/// action" panel for indents. Unlike ResearchProposal/Recruitment/GrantReceipt
/// (Tasks 2-4), indents are handled by three concrete service classes
/// (ConsumableIndentService/ContingencyIndentService/EquipmentIndentService,
/// DynamicIndent merged in by each per IndentType), so this test builds real
/// instances against a real in-memory TestProcurementDbContext rather than
/// mocking, following IndentServiceTests.cs's exact fixture pattern.
/// </summary>
public class IndentPendingQueryServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly string[] HodRole = ["HOD"];

    private sealed class FakeDepartmentPerUser(Dictionary<Guid, Guid?> byUser, Guid? fallback) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(byUser.TryGetValue(userId, out var dept) ? dept : fallback);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentService Consumable,
        ContingencyIndentService Contingency,
        EquipmentIndentService Equipment,
        IndentPendingQueryService PendingQuery,
        Dictionary<Guid, Guid?> DepartmentByUser);

    private static async Task<Fixture> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        await IndentWorkflowSeeder.SeedAsync(db);

        var yearCalculator = new ProjectYearCalculator();
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var workflowDefinitions = new WorkflowDefinitionService(db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();

        var departmentByUser = new Dictionary<Guid, Guid?>();
        var departmentProvider = new FakeDepartmentPerUser(departmentByUser, null);

        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new StubAuditService(), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var consumable = new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService);
        var contingency = new ContingencyIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService);
        var equipment = new EquipmentIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService);

        var pendingQuery = new IndentPendingQueryService(
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)),
            projectService,
            consumable,
            contingency,
            equipment);

        return new Fixture(db, consumable, contingency, equipment, pendingQuery, departmentByUser);
    }

    private sealed class StubAuditService : IAuditService
    {
        public Task LogAsync(
            string entityType, Guid entityId, string action, Guid actorUserId,
            string? detail = null, CancellationToken ct = default) => Task.CompletedTask;

        public Task<IReadOnlyList<AuditLog>> QueryAsync(
            string? entityType = null, Guid? entityId = null, DateOnly? from = null, DateOnly? to = null,
            CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditLog>>([]);
    }

    private static async Task<(Guid ProjectId, Guid BudgetHeadId)> SeedProjectAsync(
        TestProcurementDbContext db, Guid ownerUserId, Guid departmentId, decimal year1Budget = 1_000_000m)
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
            ProjectTitle = "Test Project",
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
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = year1Budget,
            Year2Amount = year1Budget,
            Year3Amount = year1Budget,
            Total = year1Budget * 3,
        });
        await db.SaveChangesAsync();

        return (projectId, budgetHeadId);
    }

    private static RaiseIndentInput Input(Guid projectId, Guid budgetHeadId, decimal cost = 40_000m, Guid? sanctionedEquipmentId = null) =>
        new(
            ProjectId: projectId,
            BudgetHeadId: budgetHeadId,
            Name: "Test Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research use",
            GemAvailability: GemAvailability.Yes,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: null,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            SanctionedEquipmentId: sanctionedEquipmentId,
            CommitteeMembers: [],
            GemQuotationPdf: null);

    /// <summary>Moves the given workflow instance's stage directly to IndentWithHOD.</summary>
    private static async Task MoveToHodStageAsync(TestProcurementDbContext db, Guid workflowInstanceId)
    {
        var instance = await db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instance.CurrentStage = WorkflowStage.IndentWithHOD;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task HodSeesOnlyIndentsInVisibleProjectsAtItsOwnStage()
    {
        var f = await CreateAsync();

        var departmentA = Guid.NewGuid();
        var departmentB = Guid.NewGuid();

        var ownerA = Guid.NewGuid();
        f.DepartmentByUser[ownerA] = departmentA;
        var (projectAId, headAId) = await SeedProjectAsync(f.Db, ownerA, departmentA);

        var ownerB = Guid.NewGuid();
        f.DepartmentByUser[ownerB] = departmentB;
        var (projectBId, headBId) = await SeedProjectAsync(f.Db, ownerB, departmentB);

        // 1. Consumable indent in department A's project, moved to IndentWithHOD.
        var indent1Id = await f.Consumable.RaiseAsync(Input(projectAId, headAId), ownerA);
        var indent1 = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indent1Id);
        await MoveToHodStageAsync(f.Db, indent1.WorkflowInstanceId);

        // 2. Second Consumable indent in department A's project, left at IndentRaised.
        await f.Consumable.RaiseAsync(Input(projectAId, headAId), ownerA);

        // 3. Third Consumable indent in department B's project, moved to IndentWithHOD.
        var indent3Id = await f.Consumable.RaiseAsync(Input(projectBId, headBId), ownerB);
        var indent3 = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indent3Id);
        await MoveToHodStageAsync(f.Db, indent3.WorkflowInstanceId);

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = departmentA;

        var result = await f.PendingQuery.ListPendingForCallerAsync(hodUserId, HodRole);

        result.Should().ContainSingle(i => i.Id == indent1Id);
        result.Single().ProjectId.Should().Be(projectAId);
        result.Single().CurrentStage.Should().Be(WorkflowStage.IndentWithHOD);
    }

    [Fact]
    public async Task AggregatesAcrossAllThreeConcreteIndentServices()
    {
        var f = await CreateAsync();

        var departmentA = Guid.NewGuid();
        var ownerA = Guid.NewGuid();
        f.DepartmentByUser[ownerA] = departmentA;
        var (projectAId, headAId) = await SeedProjectAsync(f.Db, ownerA, departmentA);

        var consumableId = await f.Consumable.RaiseAsync(Input(projectAId, headAId), ownerA);
        var consumableIndent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == consumableId);
        await MoveToHodStageAsync(f.Db, consumableIndent.WorkflowInstanceId);

        var sanctionedEquipmentId = Guid.NewGuid();
        f.Db.SanctionedEquipment.Add(new SanctionedEquipment
        {
            Id = sanctionedEquipmentId,
            ProjectId = projectAId,
            Name = "Vacuum Pump",
            Unit = "Nos",
            Amount = 300_000m,
        });
        await f.Db.SaveChangesAsync();

        var equipmentId = await f.Equipment.RaiseAsync(Input(projectAId, headAId, sanctionedEquipmentId: sanctionedEquipmentId), ownerA);
        var equipmentIndent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == equipmentId);
        await MoveToHodStageAsync(f.Db, equipmentIndent.WorkflowInstanceId);

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = departmentA;

        var result = await f.PendingQuery.ListPendingForCallerAsync(hodUserId, HodRole);

        result.Should().HaveCount(2);
        result.Should().Contain(i => i.Id == consumableId);
        result.Should().Contain(i => i.Id == equipmentId);
    }
}
