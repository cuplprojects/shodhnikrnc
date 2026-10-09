using API.Application.Access;
using API.Application.Audit;
using API.Application.Documents;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentServiceBaseDaAssignmentTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db, ConsumableIndentService Consumable,
        Guid OwnerUserId, Guid ProjectId, Guid BudgetHeadId, Guid SanctionedEquipmentId);

    private sealed class StubAuditService : IAuditService
    {
        public Task LogAsync(string entityType, Guid entityId, string action, Guid actorUserId, string? detail = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLog>> QueryAsync(string? entityType = null, Guid? entityId = null, DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditLog>>([]);
    }

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var sanctionedEquipmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = ownerUserId, DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch, SanctionNo = "SAN-BASE-DA-1", SanctionDate = ProjectStart,
            ProjectTitle = "IndentServiceBase DA Test Project", StartDate = ProjectStart, Agency = "DST",
            DurationMonths = 36, TotalSanctioned = 5_000_000m, CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId, ProjectId = projectId, HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 1_000_000m, Year2Amount = 1_000_000m, Year3Amount = 1_000_000m, Total = 3_000_000m,
        });
        db.SanctionedEquipment.Add(new SanctionedEquipment
        {
            Id = sanctionedEquipmentId, ProjectId = projectId, Name = "Vacuum Pump", Unit = "Nos", Amount = 300_000m,
        });
        db.SaveChanges();

        var yearCalculator = new ProjectYearCalculator();
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var workflowDefinitions = new WorkflowDefinitionService(db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new StubAuditService(), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(
            db,
            new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            ownerUserId, projectId, budgetHeadId, sanctionedEquipmentId);
    }

    private static RaiseIndentInput Input(Fixture f, decimal cost = 60_000m) =>
        new(
            ProjectId: f.ProjectId, BudgetHeadId: f.BudgetHeadId, Name: "Test Item", TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos", Quantity: 1, Purpose: "Research use", GemAvailability: GemAvailability.Yes,
            EstimatedCost: cost, NonAvailabilityCertificateNumber: null, NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null, SanctionedEquipmentId: null, CommitteeMembers: [],
            GemQuotationPdf: null);

    private static ProcessBillInput BillInput() =>
        new(
            OriginalBillReference: "BILL-DA-1", StockEntryConfirmed: true, EWayBillNumber: "EWB-DA-1",
            MeasurementBookNumber: null, StockBookPage: "12", StockDescription: "Prior stock",
            StockQuantity: "1", StockActualCost: "30000", StockCondition: "Good");

    [Fact]
    public async Task RaiseAsync_ConsumableIndent_ProjectHasDa_InstanceAssignedToDaUser()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.AssignedToUserId.Should().Be(daUserId);
        instance.IsAssignedViaProjectDa.Should().BeTrue();
    }

    [Fact]
    public async Task RaiseAsync_ConsumableIndent_ProjectHasNoDaAtRaiseTime_StageStaysRoleWide()
    {
        var f = Create();

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.AssignedToUserId.Should().BeNull();
    }

    [Fact]
    public async Task ProcessBillAsync_ProjectHasDa_BillPhaseInstanceIsAssignedToDa()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);

        // Force the instance straight to IndentApproved, mirroring
        // IndentServiceTests.cs's own ProcessBillAsync_WhenStageIsIndentApproved_Succeeds
        // pattern -- sidesteps needing to drive the full approval chain
        // through AssignAsync/ForwardAsync/ApproveAsync, which this test
        // doesn't need to exercise.
        var initialInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        initialInstance.CurrentStage = WorkflowStage.IndentApproved;
        await f.Db.SaveChangesAsync();

        // Assign the project's DA only AFTER the initial instance was
        // raised, proving the LATER, separate Bill-phase instance still
        // picks it up even though it didn't exist yet at the initial
        // raise.
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        await f.Consumable.ProcessBillAsync(indentId, BillInput(), f.OwnerUserId);

        var billInstance = await f.Db.WorkflowInstances
            .FirstAsync(w => w.RequestId == indentId && w.Phase == WorkflowPhase.Bill);
        billInstance.AssignedToUserId.Should().Be(daUserId);
        billInstance.IsAssignedViaProjectDa.Should().BeTrue();
    }
}
