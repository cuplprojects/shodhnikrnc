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
using static API.Tests.TestRoles;

namespace API.Tests.Procurement;

/// <summary>
/// Gates the Non-GeM Rs.2L-25L ("Market Committee") band's ForwardedDR-stage
/// action on <see cref="MarketCommitteeProcess.IsComplete"/>.
/// </summary>
/// <remarks>
/// Per <c>IndentChainActions.jsx</c> (Task 5), the Market Committee band's
/// ForwardedDR button calls <c>forwardIndentToDirector</c> --
/// <see cref="IIndentService.ForwardToDirectorAsync"/> -- not ApproveAsync or
/// plain ForwardAsync (which throws at ForwardedDR once the route's next
/// stage by sequence is Director, per WorkflowEngineService's point-fix).
/// The gate therefore lives on ForwardToDirectorAsync, the action this band
/// actually calls.
/// </remarks>
public class MarketCommitteeGatingTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentService Consumable,
        WorkflowEngineService Workflow,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId);

    private static Fixture Create(decimal year1Budget = 3_000_000m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-1",
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
            new InstituteWideScopeResolver(db, departmentProvider), new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(
            db,
            new ConsumableIndentService(
                db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            workflow,
            ownerUserId,
            projectId,
            budgetHeadId);
    }

    private static RaiseIndentInput Input(
        Fixture f,
        decimal cost,
        GemAvailability gem = GemAvailability.No,
        string? certificateNumber = "NAC-1") =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.BudgetHeadId,
            Name: "Test Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research use",
            GemAvailability: gem,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: gem == GemAvailability.No ? certificateNumber : null,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            SanctionedEquipmentId: null,
            CommitteeMembers: [],
            GemQuotationPdf: null);

    /// <summary>
    /// Advances an indent workflow from IndentRaised to IndentWithDean, walking
    /// IndentWorkflowSeeder's real chain: IndentRaised -> IndentWithHOD ->
    /// IndentWithRnCOffice -> IndentAssignedToDA -> IndentWithSuperintendent ->
    /// IndentWithDeputyRegistrar -> IndentWithDean. IndentWithDean is the
    /// decision stage equivalent of the generic route's ForwardedDR, which is
    /// where the Market Committee gate itself is keyed off of.
    /// </summary>
    private static async Task AdvanceToForwardedDRAsync(
        Fixture f, Guid workflowInstanceId, Guid actorUserId)
    {
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actorUserId, Raiser, null);          // -> IndentWithHOD
        await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Hod, "HOD verification complete."); // -> IndentWithRnCOffice
        await f.Workflow.AssignAsync(workflowInstanceId, actorUserId, actorUserId, Office, null);        // stays at IndentWithRnCOffice
        await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);                    // -> IndentAssignedToDA
        await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);                    // -> IndentWithSuperintendent
        await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);                    // -> IndentWithDeputyRegistrar
        await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);                    // -> IndentWithDean
    }

    [Fact]
    public async Task ForwardToDirectorAsync_AtForwardedDRInMarketCommitteeBand_WithIncompleteProcess_Throws()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Rs.2L-25L, non-GeM -> NonGem2LakhTo25Lakh tier (Market Committee band).
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // No MarketCommitteeProcess row at all.
        var act = () => f.Consumable.ForwardToDirectorAsync(indentId, actor, Dean, null);

        await act.Should().ThrowAsync<MarketCommitteeProcessIncompleteException>();
    }

    [Fact]
    public async Task ForwardToDirectorAsync_AtForwardedDRInMarketCommitteeBand_WithCompleteProcess_Succeeds()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.CommitteeFormed, new DateOnly(2026, 8, 1), actor, Dean);
        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.NoticeIssued, new DateOnly(2026, 8, 5), actor, Dean);
        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.ComparativeStatementSigned, new DateOnly(2026, 8, 10), actor, Dean);

        await f.Consumable.ForwardToDirectorAsync(indentId, actor, Dean, null);

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.Director);
    }

    [Fact]
    public async Task ForwardToDirectorAsync_AtForwardedDROutsideMarketCommitteeBand_IsUnaffectedByTheGate()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Non-GeM, <= Rs.1 Lakh -> not the Market Committee band.
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 50_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // No MarketCommitteeProcess row at all -- still unaffected, since this band's
        // gate condition never applies to it.
        await f.Consumable.ForwardToDirectorAsync(indentId, actor, Dean, null);

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.Director);
    }

    [Fact]
    public async Task ApproveAsync_AtForwardedDROutsideMarketCommitteeBand_IsUnaffectedByTheGate()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // GeM, <= Rs.50,000 -> Dean-approved band, unaffected by the Market Committee gate.
        var indentId = await f.Consumable.RaiseAsync(
            Input(f, cost: 40_000m, gem: GemAvailability.Yes), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        await f.Consumable.ApproveAsync(indentId, actor, Dean, "approved");

        // ConsumableIndentService raises against ConsumableIndents, not the
        // dynamic Indents table WorkflowEngineService.ApproveAsync's <=1L
        // short-circuit reads from (see IndentServiceTests' ApproveIndentAsync
        // helper), so Dean's Approve here always escalates to Director first,
        // regardless of the indent's actual cost -- gate-unaffected either way.
        var afterDean = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        afterDean.CurrentStage.Should().Be(WorkflowStage.Director);

        await f.Consumable.ApproveAsync(indentId, actor, Director, "approved by director");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.IndentApproved);
    }

    [Fact]
    public async Task RecordMarketCommitteeStepAsync_ByWrongRole_ThrowsWorkflowAuthorizationException()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        // IndentWithDean is a Dean stage; RegularStaff is not permitted here.
        var act = () => f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.CommitteeFormed, new DateOnly(2026, 8, 1), actor, ["RegularStaff"]);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task RecordMarketCommitteeStepAsync_TwiceForTheSameStep_OverwritesRatherThanDuplicates()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);

        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.CommitteeFormed, new DateOnly(2026, 8, 1), actor, Dean);
        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.CommitteeFormed, new DateOnly(2026, 8, 15), actor, Dean);

        var rows = await f.Db.MarketCommitteeProcesses
            .Where(m => m.IndentType == IndentType.Consumable && m.IndentId == indentId)
            .ToListAsync();

        rows.Should().HaveCount(1);
        rows[0].CommitteeFormedOn.Should().Be(new DateOnly(2026, 8, 15));
    }

    [Fact]
    public async Task GetMarketCommitteeStepsAsync_WithNoRowYet_ReturnsNull()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);

        var summary = await f.Consumable.GetMarketCommitteeStepsAsync(indentId);

        summary.Should().BeNull();
    }

    [Fact]
    public async Task GetMarketCommitteeStepsAsync_AfterAllStepsRecorded_ReturnsIsCompleteTrue()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var actor = f.OwnerUserId;
        await AdvanceToForwardedDRAsync(f, indent.WorkflowInstanceId, actor);

        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.CommitteeFormed, new DateOnly(2026, 8, 1), actor, Dean);
        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.NoticeIssued, new DateOnly(2026, 8, 5), actor, Dean);
        await f.Consumable.RecordMarketCommitteeStepAsync(
            indentId, MarketCommitteeStep.ComparativeStatementSigned, new DateOnly(2026, 8, 10), actor, Dean);

        var summary = await f.Consumable.GetMarketCommitteeStepsAsync(indentId);

        summary.Should().NotBeNull();
        summary!.IsComplete.Should().BeTrue();
        summary.CommitteeFormedOn.Should().Be(new DateOnly(2026, 8, 1));
        summary.NoticeIssuedOn.Should().Be(new DateOnly(2026, 8, 5));
        summary.ComparativeStatementSignedOn.Should().Be(new DateOnly(2026, 8, 10));
    }
}
