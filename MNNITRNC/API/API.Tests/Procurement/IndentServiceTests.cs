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

public class IndentServiceTests
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
        Guid DepartmentId,
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
        var departmentId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var sanctionedEquipmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            DepartmentId = departmentId,
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
        // Consumable/Equipment/Contingency/DynamicIndent route through
        // IndentWithHOD (see WorkflowEngineService.UploadSignedCopyAsync),
        // which only IndentWorkflowSeeder's route contains -- the unseeded
        // fallback (WorkflowDefinitionSeeder.BuildShippedRoute) does not.
        IndentWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

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
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new StubAuditService(), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(
            db,
            new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            new ContingencyIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            new EquipmentIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService),
            workflow,
            docGen,
            ownerUserId,
            projectId,
            departmentId,
            budgetHeadId,
            sanctionedEquipmentId);
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

    private static RaiseIndentInput Input(
        Fixture f,
        decimal cost = 40_000m,
        GemAvailability gem = GemAvailability.Yes,
        string? certificateNumber = null,
        DateOnly? certificateValidity = null,
        Guid? sanctionedEquipmentId = null,
        IReadOnlyList<(string Name, CommitteeMemberRole Role)>? committee = null,
        string purpose = "Research use") =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.BudgetHeadId,
            Name: "Test Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: purpose,
            GemAvailability: gem,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: certificateNumber,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: certificateValidity,
            SanctionedEquipmentId: sanctionedEquipmentId,
            CommitteeMembers: committee ?? [],
            GemQuotationPdf: null);

    private static ProcessBillInput BillInput(
        string? eWayBillNumber = null, string? measurementBookNumber = null) =>
        new(
            OriginalBillReference: "BILL-1",
            StockEntryConfirmed: true,
            EWayBillNumber: eWayBillNumber,
            MeasurementBookNumber: measurementBookNumber,
            StockBookPage: "12",
            StockDescription: "Prior stock",
            StockQuantity: "1",
            StockActualCost: "30000",
            StockCondition: "Good");

    /// <summary>
    /// Drives an indent's workflow instance from Raised through to Approved
    /// (IndentApproved), walking the full IndentWorkflowSeeder chain:
    /// IndentWithHOD -> IndentWithRnCOffice -> IndentAssignedToDA ->
    /// IndentWithSuperintendent -> IndentWithDeputyRegistrar -> IndentWithDean
    /// -> [Director ->] IndentApproved. IndentWithDean's own Approve either
    /// concludes directly (cost &lt;=1L) or escalates to Director first (>1L),
    /// so this issues a second Approve only if the first one didn't already
    /// reach a terminal stage.
    /// </summary>
    private static async Task ApproveIndentAsync(Fixture f, Guid workflowInstanceId)
    {
        // IndentRaised requires Faculty/PI, unlike the old fallback route's
        // Raised (open, empty AllowedRoles) -- UploadSignedCopyAsync's own
        // raiser exemption only fires for the actual raiser, so this must be
        // f.OwnerUserId (who every RaiseAsync call in this file raises as).
        var actor = f.OwnerUserId;
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);
        // Consumable/Equipment/Contingency/DynamicIndent uploads land on
        // IndentWithHOD (see WorkflowEngineService.UploadSignedCopyAsync),
        // where only Forward/Return are valid -- Assign only becomes valid
        // once HOD forwards to IndentWithRnCOffice (see IndentWorkflowSeeder).
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Hod, "HOD verification complete.");   // -> IndentWithRnCOffice
        await f.Workflow.AssignAsync(workflowInstanceId, actor, actor, Office, null);                   // stays at IndentWithRnCOffice
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);                        // -> IndentAssignedToDA
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);                        // -> IndentWithSuperintendent
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);                        // -> IndentWithDeputyRegistrar
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);                        // -> IndentWithDean
        await f.Workflow.ApproveAsync(workflowInstanceId, actor, Dean, null);                          // -> IndentApproved (<=1L) or Director (>1L)

        var afterDean = await f.Workflow.GetAsync(workflowInstanceId);
        if (afterDean!.CurrentStage == WorkflowStage.Director)
        {
            await f.Workflow.ApproveAsync(workflowInstanceId, actor, Director, null);                 // -> IndentApproved
        }
    }

    [Fact]
    public async Task RaiseAsync_ValidConsumableIndent_PersistsIndentAndCreatesWorkflowInstance()
    {
        var f = Create();

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        indent.EstimatedCost.Should().Be(40_000m);
        indent.ProjectId.Should().Be(f.ProjectId);

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Consumable);
        instance.RequestId.Should().Be(indentId);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
        // IndentWorkflowSeeder's route has IndentRaised, not the generic
        // route's Raised, as Consumable's initial stage.
        instance.CurrentStage.Should().Be(WorkflowStage.IndentRaised);

        f.DocGen.IndentCalls.Should().ContainSingle()
            .Which.Tier.Should().Be(ProcurementTier.GemUpTo50k);
    }

    [Fact]
    public async Task RaiseAsync_RecordsTheGeneratedAnnexureAsADocument()
    {
        var f = Create();

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var document = await f.Db.Documents.FirstOrDefaultAsync(d => d.OwnerId == indentId);
        document.Should().NotBeNull();
        document!.OwnerType.Should().Be("ConsumableIndent");
        document.Kind.Should().Be(DocumentKind.Indent);
    }

    [Fact]
    public async Task RaiseAsync_NonGemWithoutCertificateNumber_ThrowsArgumentException()
    {
        var f = Create();

        var act = () => f.Consumable.RaiseAsync(
            Input(f, gem: GemAvailability.No, certificateNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_NonGemWithExpiredCertificateValidity_ThrowsArgumentException()
    {
        var f = Create();
        var expired = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        var act = () => f.Consumable.RaiseAsync(
            Input(f, gem: GemAvailability.No, certificateNumber: "NAC-1", certificateValidity: expired),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_ExceedingBudget_ThrowsInsufficientBudgetException()
    {
        var f = Create(year1Budget: 30_000m);

        var act = () => f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task RaiseAsync_WithBlankPurpose_Throws()
    {
        var f = Create();

        var act = () => f.Consumable.RaiseAsync(Input(f, purpose: "   "), f.OwnerUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RaiseAsync_NonGemAbove25Lakh_ThrowsBiddingTierNotSupportedException()
    {
        var f = Create(year1Budget: 10_000_000m);

        var act = () => f.Consumable.RaiseAsync(
            Input(f, cost: 3_000_000m, gem: GemAvailability.No, certificateNumber: "NAC-1"),
            f.OwnerUserId);

        await act.Should().ThrowAsync<BiddingTierNotSupportedException>();
    }

    [Fact]
    public async Task RaiseAsync_NonGem2LakhTo25LakhTier_PersistsCommitteeMembers()
    {
        var f = Create();
        var committee = new List<(string, CommitteeMemberRole)>
        {
            ("Prof. C Rao", CommitteeMemberRole.Chairperson),
            ("Dr. D Singh", CommitteeMemberRole.FacultyMember),
        };

        var indentId = await f.Consumable.RaiseAsync(
            Input(f, cost: 500_000m, gem: GemAvailability.No, certificateNumber: "NAC-1", committee: committee),
            f.OwnerUserId);

        var persisted = await f.Db.ProcurementCommittees
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.IndentType == IndentType.Consumable && c.IndentId == indentId);

        persisted.Should().NotBeNull();
        persisted!.Members.Should().HaveCount(2);
        persisted.Members.Select(m => m.Name).Should().Contain(["Prof. C Rao", "Dr. D Singh"]);
    }

    [Fact]
    public async Task RaiseAsync_CommitteeTier_PassesMembersToTheGeneratedAnnexure()
    {
        var f = Create();
        var committee = new List<(string, CommitteeMemberRole)>
        {
            ("Prof. C Rao", CommitteeMemberRole.Chairperson),
        };

        await f.Consumable.RaiseAsync(
            Input(f, cost: 500_000m, gem: GemAvailability.No, certificateNumber: "NAC-1", committee: committee),
            f.OwnerUserId);

        var call = f.DocGen.IndentCalls.Should().ContainSingle().Subject;
        call.Tier.Should().Be(ProcurementTier.NonGem2LakhTo25Lakh);
        call.Model.CommitteeMembers.Should().ContainSingle()
            .Which.Name.Should().Be("Prof. C Rao");
    }

    [Fact]
    public async Task RaiseAsync_GemTier_DoesNotPersistCommitteeMembers()
    {
        var f = Create();
        var committee = new List<(string, CommitteeMemberRole)>
        {
            ("Prof. C Rao", CommitteeMemberRole.Chairperson),
        };

        var indentId = await f.Consumable.RaiseAsync(
            Input(f, cost: 40_000m, gem: GemAvailability.Yes, committee: committee), f.OwnerUserId);

        var persisted = await f.Db.ProcurementCommittees
            .FirstOrDefaultAsync(c => c.IndentType == IndentType.Consumable && c.IndentId == indentId);

        persisted.Should().BeNull();
    }

    [Fact]
    public async Task RaiseAsync_BudgetHeadFromAnotherProject_ThrowsArgumentException()
    {
        var f = Create();
        var foreignHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = foreignHeadId,
            ProjectId = Guid.NewGuid(),
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 500_000m,
            Year2Amount = 0m,
            Year3Amount = 0m,
            Total = 500_000m,
        });
        await f.Db.SaveChangesAsync(CancellationToken.None);

        var input = Input(f) with { BudgetHeadId = foreignHeadId };
        var act = () => f.Consumable.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_DifferentProjectOwner_ThrowsProjectAccessDeniedException()
    {
        var f = Create();

        var act = () => f.Consumable.RaiseAsync(Input(f), Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task ListForProjectAsync_ReturnsTheProjectsIndentsWithTheirStage()
    {
        var f = Create();
        await f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);
        await f.Consumable.RaiseAsync(Input(f, cost: 60_000m), f.OwnerUserId);

        var summaries = await f.Consumable.ListForProjectAsync(f.ProjectId, f.OwnerUserId);

        summaries.Should().HaveCount(2);
        summaries.Should().OnlyContain(s => s.CurrentStage == WorkflowStage.IndentRaised);
        summaries.Select(s => s.Tier).Should()
            .Contain([ProcurementTier.GemUpTo50k, ProcurementTier.Gem50kTo1Lakh]);
    }

    [Fact]
    public async Task ProcessBillAsync_BeforeIndentApproved_Throws()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(), f.OwnerUserId);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task ProcessBillAsync_Above50kWithoutEWayBill_ThrowsArgumentException()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 60_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ProcessBillAsync_Above50kWithEWayBill_CreatesBillPhaseWorkflowInstance()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 60_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        await f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: "EWB-123"), f.OwnerUserId);

        var billInstance = await f.Db.WorkflowInstances
            .FirstOrDefaultAsync(w => w.RequestId == indentId && w.Phase == WorkflowPhase.Bill);
        billInstance.Should().NotBeNull();

        var reloaded = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        reloaded.EWayBillNumber.Should().Be("EWB-123");
        reloaded.OriginalBillReference.Should().Be("BILL-1");
        f.DocGen.BillCoverLetterCalls.Should().ContainSingle();
    }

    [Fact]
    public async Task ProcessBillAsync_Below50kWithoutEWayBill_Succeeds()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: null), f.OwnerUserId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ProcessBillAsync_WhenStageIsIndentApproved_Succeeds()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.CurrentStage = WorkflowStage.IndentApproved;
        await f.Db.SaveChangesAsync();

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: null), f.OwnerUserId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_ThrowsProjectAccessDeniedException()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Consumable.GetAsync(indentId, Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetAsync_OwnerStillWorks()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var summary = await f.Consumable.GetAsync(indentId, f.OwnerUserId, requestingUserRoles: ["Faculty"]);

        summary.Id.Should().Be(indentId);
    }

    [Fact]
    public async Task GetAsync_UnrelatedUserWithNoQualifyingRole_StillThrowsProjectAccessDeniedException()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Consumable.GetAsync(indentId, Guid.NewGuid(), requestingUserRoles: ["Faculty"]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    /// <summary>
    /// Pins the final-review fix: the detail page's own load path (GetAsync) must
    /// use the same visibility model ProjectService.GetAsync/ListVisibleToAsync
    /// already use for the queue -- not the strict PI-only ownership check that
    /// predates this plan. An HOD who does not own the project but whose
    /// department matches the project's department can view the indent (here at
    /// the Raised stage; the exact CurrentStage does not change GetAsync's
    /// authorization, which is model-wide, not stage-specific).
    /// </summary>
    [Fact]
    public async Task GetAsync_HodOfTheProjectsDepartment_CanViewAnIndentTheyDoNotOwn()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var hodUserId = Guid.NewGuid();
        f.Db.Departments.Add(new Department { Id = f.DepartmentId, Name = "Test Department", Code = "TESTDEPT" });
        await f.Db.SaveChangesAsync(CancellationToken.None);

        // The base-fixture ProjectService is built with StubUserDepartmentProvider
        // (always null) -- swap in a department-aware IndentServiceBase built with
        // a ProjectService whose IUserDepartmentProvider actually resolves the HOD
        // to the project's own department, mirroring
        // ConsumableIndentsControllerTests.FakeDepartment's pattern.
        var hodDepartmentProvider = new FakeDepartment(f.DepartmentId);
        var yearCalculator = new ProjectYearCalculator();
        var projectServiceForHod = new ProjectService(
            f.Db, f.Workflow, yearCalculator, new OverheadSplitValidator(), hodDepartmentProvider,
            new InstituteWideScopeResolver(f.Db, hodDepartmentProvider), new StubAuditService(),
            new WorkflowPendingQueryService(f.Db, new WorkflowDefinitionService(f.Db)));
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(f.Db, yearCalculator);
        var workflowDefinitions = new WorkflowDefinitionService(f.Db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();
        var consumableForHod = new ConsumableIndentService(
            f.Db, tierCalculator, budgetValidator, f.Workflow, workflowDefinitions, docGen, storage, faculty,
            projectServiceForHod);

        var summary = await consumableForHod.GetAsync(indentId, hodUserId, requestingUserRoles: ["HOD"]);

        summary.Id.Should().Be(indentId);
    }

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    [Fact]
    public async Task GetAsync_UnknownIndent_ThrowsIndentNotFoundException()
    {
        var f = Create();

        var act = () => f.Consumable.GetAsync(Guid.NewGuid(), f.OwnerUserId);

        await act.Should().ThrowAsync<IndentNotFoundException>();
    }

    [Fact]
    public async Task RaiseAsync_Contingency_PersistsWithContingencyRequestType()
    {
        var f = Create();

        var indentId = await f.Contingency.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ContingencyIndents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Contingency);
    }

    [Fact]
    public async Task RaiseAsync_Equipment_LinksToSanctionedEquipment()
    {
        var f = Create();

        var indentId = await f.Equipment.RaiseAsync(
            Input(f, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);

        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        indent.SanctionedEquipmentId.Should().Be(f.SanctionedEquipmentId);

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Equipment);
    }

    [Fact]
    public async Task RaiseAsync_EquipmentWithoutSanctionedEquipmentId_ThrowsArgumentException()
    {
        var f = Create();

        var act = () => f.Equipment.RaiseAsync(Input(f, sanctionedEquipmentId: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_EquipmentReferencingAnotherProjectsEquipment_ThrowsArgumentException()
    {
        var f = Create();
        var foreignEquipmentId = Guid.NewGuid();
        f.Db.SanctionedEquipment.Add(new SanctionedEquipment
        {
            Id = foreignEquipmentId,
            ProjectId = Guid.NewGuid(),
            Name = "Other Pump",
            Unit = "Nos",
            Amount = 100_000m,
        });
        await f.Db.SaveChangesAsync(CancellationToken.None);

        var act = () => f.Equipment.RaiseAsync(
            Input(f, sanctionedEquipmentId: foreignEquipmentId), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ProcessBillAsync_EquipmentWithoutMeasurementBookNumber_ThrowsArgumentException()
    {
        var f = Create();
        var indentId = await f.Equipment.RaiseAsync(
            Input(f, cost: 40_000m, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);
        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Equipment.ProcessBillAsync(
            indentId, BillInput(measurementBookNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ProcessBillAsync_EquipmentWithMeasurementBookNumber_PersistsIt()
    {
        var f = Create();
        var indentId = await f.Equipment.RaiseAsync(
            Input(f, cost: 40_000m, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);
        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        await f.Equipment.ProcessBillAsync(
            indentId, BillInput(measurementBookNumber: "MB-77"), f.OwnerUserId);

        var reloaded = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        reloaded.MeasurementBookNumber.Should().Be("MB-77");
    }
}
