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

public class IndentWorkflowActionsTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentService Consumable,
        ContingencyIndentService Contingency,
        EquipmentIndentService Equipment,
        WorkflowEngineService Workflow,
        StubDocumentGenerationService DocGen,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId,
        Guid SanctionedEquipmentId);

    private static Fixture Create(decimal year1Budget = 1_000_000m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var sanctionedEquipmentId = Guid.NewGuid();

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
        db.SanctionedEquipment.Add(new SanctionedEquipment
        {
            Id = sanctionedEquipmentId,
            ProjectId = projectId,
            Name = "Vacuum Pump",
            Unit = "Nos",
            Amount = 300_000m,
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
            new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            new ContingencyIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            new EquipmentIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            workflow,
            docGen,
            ownerUserId,
            projectId,
            budgetHeadId,
            sanctionedEquipmentId);
    }

    private static RaiseIndentInput Input(
        Fixture f,
        decimal cost = 40_000m,
        GemAvailability gem = GemAvailability.Yes,
        string? certificateNumber = null,
        DateOnly? certificateValidity = null,
        Guid? sanctionedEquipmentId = null,
        IReadOnlyList<(string Name, CommitteeMemberRole Role)>? committee = null) =>
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
            NonAvailabilityCertificateNumber: certificateNumber,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: certificateValidity,
            SanctionedEquipmentId: sanctionedEquipmentId,
            CommitteeMembers: committee ?? [],
            GemQuotationPdf: null);

    /// <summary>
    /// Advances an indent workflow from IndentRaised through multiple stages to
    /// the specified target stage, walking IndentWorkflowSeeder's real chain:
    /// IndentRaised -> IndentWithHOD -> IndentWithRnCOffice -> IndentAssignedToDA
    /// -> IndentWithSuperintendent -> IndentWithDeputyRegistrar -> IndentWithDean
    /// -> [Director]. IndentWithDean is the decision stage equivalent of the
    /// generic route's ForwardedDR -- it is where callers here should target
    /// approve/reject/forward-to-director from.
    /// </summary>
    private static async Task AdvanceToStageAsync(
        Fixture f, Guid workflowInstanceId, WorkflowStage targetStage, Guid actorUserId)
    {
        var currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);

        while (currentInstance.CurrentStage != targetStage)
        {
            currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);

            if (currentInstance.CurrentStage == WorkflowStage.IndentRaised)
            {
                await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actorUserId, Raiser, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentWithHOD)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Hod, "HOD verification complete.");
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentWithRnCOffice)
            {
                await f.Workflow.AssignAsync(workflowInstanceId, actorUserId, actorUserId, Office, null);
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentAssignedToDA)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentWithSuperintendent)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentWithDeputyRegistrar)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.IndentWithDean)
            {
                // IndentWithDean is a decision stage, cannot advance further without approval/rejection
                break;
            }
            else if (currentInstance.CurrentStage == WorkflowStage.Director)
            {
                break;
            }
            else
            {
                // Unreachable stage for this chain -- avoid spinning forever.
                break;
            }

            currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        }
    }

    [Fact]
    public async Task ForwardAsync_AtIndentWithHOD_AdvancesToIndentWithRnCOffice()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Move to IndentWithHOD stage
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithHOD);

        // Forward from IndentWithHOD to IndentWithRnCOffice
        await f.Consumable.ForwardAsync(indentId, actor, Hod, "HOD verification complete.");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.IndentWithRnCOffice);
    }

    [Fact]
    public async Task ForwardAsync_ByWrongRole_ThrowsWorkflowAuthorizationException()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Move to IndentWithHOD stage
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithHOD);

        // Try to forward with RegularStaff role (only HOD is allowed at IndentWithHOD)
        var act = () => f.Consumable.ForwardAsync(indentId, actor, ["RegularStaff"], "attempt");

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task RejectAsync_AtIndentWithDean_ReachesRejectedStage()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Advance to IndentWithDean stage (the real chain's ForwardedDR equivalent)
        await AdvanceToStageAsync(f, workflowInstanceId, WorkflowStage.IndentWithDean, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // Reject as Dean
        await f.Consumable.RejectAsync(indentId, actor, Dean, "not viable");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.Rejected);
    }

    [Fact]
    public async Task ReturnAsync_AtIndentWithDean_ReachesIndentRaisedStage()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Advance to IndentWithDean stage
        await AdvanceToStageAsync(f, workflowInstanceId, WorkflowStage.IndentWithDean, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // Return as Dean
        await f.Consumable.ReturnAsync(indentId, actor, Dean, "please revise");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        // IndentWorkflowSeeder.ResubmitEntrySequence is 1 (IndentRaised), so
        // ReturnAsync re-enters there.
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.IndentRaised);
    }

    [Fact]
    public async Task ApproveAsync_AtIndentWithDean_ReachesApprovedStage()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Above 1 lakh so the Dean's Approve escalates to Director rather than
        // concluding directly -- kept distinct from the ForwardToDirectorAsync
        // test below, which exercises the explicit escalation action instead.
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 150_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Advance to IndentWithDean stage
        await AdvanceToStageAsync(f, workflowInstanceId, WorkflowStage.IndentWithDean, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // Approve as Dean -- cost is 1.5L (>1L), so this escalates to Director
        // rather than reaching IndentApproved directly.
        await f.Consumable.ApproveAsync(indentId, actor, Dean, "looks good");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.Director);

        await f.Consumable.ApproveAsync(indentId, actor, Director, "approved by director");

        var finalInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        finalInstance.CurrentStage.Should().Be(WorkflowStage.IndentApproved);
    }

    [Fact]
    public async Task ForwardToDirectorAsync_AtIndentWithDean_ReachesDirectorStage()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Advance to IndentWithDean stage
        await AdvanceToStageAsync(f, workflowInstanceId, WorkflowStage.IndentWithDean, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // Escalate to Director, distinct from both plain ApproveAsync (which
        // may conclude at IndentApproved for low-cost indents) and plain
        // ForwardAsync (which throws at this stage, since it is a decision
        // stage with CanApprove = true and no "next" by sequence).
        await f.Consumable.ForwardToDirectorAsync(indentId, actor, Dean, "escalating");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.Director);
    }

    [Fact]
    public async Task ForwardAsync_ContingencyIndent_ProvesBaseImplementationWorksForAllTypes()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Raise a Contingency indent
        var indentId = await f.Contingency.RaiseAsync(Input(f), f.OwnerUserId);
        var indent = await f.Db.ContingencyIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Move to IndentWithHOD stage
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);

        // Forward using ContingencyIndentService's inherited method
        await f.Contingency.ForwardAsync(indentId, actor, Hod, "HOD verification complete.");

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.IndentWithRnCOffice);
    }

    [Fact]
    public async Task ApproveAsync_EquipmentIndent_ProvesBaseImplementationWorksForAllTypes()
    {
        var f = Create();

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Raise an Equipment indent. EquipmentIndentService raises against the
        // EquipmentIndents table, not the dynamic Indents table the <=1L
        // short-circuit in WorkflowEngineService.ApproveAsync reads from, so
        // (as in IndentServiceTests) that short-circuit never applies here and
        // Dean's Approve always escalates to Director first.
        var indentId = await f.Equipment.RaiseAsync(
            Input(f, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);
        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;

        var actor = f.OwnerUserId;

        // Advance to IndentWithDean stage
        await AdvanceToStageAsync(f, workflowInstanceId, WorkflowStage.IndentWithDean, actor);

        var instanceBefore = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceBefore.CurrentStage.Should().Be(WorkflowStage.IndentWithDean);

        // Approve using EquipmentIndentService's inherited method -- escalates
        // to Director (see comment above), then Director approves to conclude.
        await f.Equipment.ApproveAsync(indentId, actor, Dean, "approved");

        var afterDean = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        afterDean.CurrentStage.Should().Be(WorkflowStage.Director);

        await f.Equipment.ApproveAsync(indentId, actor, Director, "approved by director");

        var instanceAfter = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        instanceAfter.CurrentStage.Should().Be(WorkflowStage.IndentApproved);
    }
}
