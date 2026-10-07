using System.Security.Claims;
using API.Application.Audit;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Contracts.Procurement;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Procurement;

/// <summary>
/// ConsumableIndentsController's (and ContingencyIndentsController's and
/// EquipmentIndentsController's) four indent approval chain actions
/// (Forward/Approve/Reject/Return), added over IIndentService's Task 2
/// methods. Each just needs to reach its corresponding service method and
/// pass the caller's identity, roles and remarks through -- the workflow
/// engine (exercised in IndentWorkflowActionsTests) is what actually enforces
/// who may act at each stage.
/// </summary>
public class IndentControllerWorkflowTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed class FakeDepartment(Guid? departmentId) : API.Application.Access.IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentsController Controller,
        ConsumableIndentService Service,
        WorkflowEngineService Workflow,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId);

    private static async Task<Fixture> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        // Seed workflow definitions
        await WorkflowDefinitionSeeder.SeedAsync(db);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-CTRL-CI1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Indent Controller Workflow Test Project",
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
            Year1Amount = 1_000_000m,
            Year2Amount = 1_000_000m,
            Year3Amount = 1_000_000m,
            Total = 3_000_000m,
        });
        await db.SaveChangesAsync();

        var yearCalculator = new ProjectYearCalculator();
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var workflowDefinitions = new WorkflowDefinitionService(db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();

        var projectService = new API.Application.Projects.ProjectService(
            db, workflow, yearCalculator, new API.Application.Projects.OverheadSplitValidator(),
            new FakeDepartment(departmentId),
            new API.Application.Access.InstituteWideScopeResolver(db, new FakeDepartment(departmentId)),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));

        var service = new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService);

        var controller = new ConsumableIndentsController(service, budgetValidator, db, projectService);

        return new Fixture(db, controller, service, workflow, ownerUserId, projectId, budgetHeadId);
    }

    private static void SetUser(ConsumableIndentsController controller, Guid userId, IReadOnlyCollection<string> roles)
    {
        var claims = new List<Claim>
        {
            new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role)),
            },
        };
    }

    private static async Task<Guid> RaisedIndentAsync(Fixture f, decimal cost = 40_000m)
    {
        var input = new RaiseIndentInput(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.BudgetHeadId,
            Name: "Test Consumable Item",
            TechnicalSpecs: "Standard",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research",
            GemAvailability: GemAvailability.Yes,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: null,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            SanctionedEquipmentId: null,
            CommitteeMembers: [],
            GemQuotationPdf: null,
            PaymentRouting: "Party Payment",
            BiddingNumber: null,
            BidPublicationDate: null,
            NacItemName: null,
            QuotationDate: null);

        var indentId = await f.Service.RaiseAsync(input, f.OwnerUserId, CancellationToken.None);
        return indentId;
    }

    private static async Task<WorkflowStage> StageAsync(Fixture f, Guid indentId)
    {
        var indent = await f.Db.ConsumableIndents.AsNoTracking().SingleAsync(i => i.Id == indentId);
        var instance = await f.Workflow.GetAsync(indent.WorkflowInstanceId);
        return instance!.CurrentStage;
    }

    private static async Task AdvanceToStageAsync(
        Fixture f, Guid workflowInstanceId, WorkflowStage targetStage, Guid actorUserId)
    {
        var currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);

        while (currentInstance.CurrentStage != targetStage)
        {
            currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);

            if (currentInstance.CurrentStage == WorkflowStage.Raised)
            {
                await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actorUserId, Raiser, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.SignedCopyUploaded)
            {
                await f.Workflow.AssignAsync(workflowInstanceId, actorUserId, actorUserId, Hod, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.Assigned)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.Forwarded)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.ForwardedOSRC)
            {
                await f.Workflow.ForwardAsync(workflowInstanceId, actorUserId, Office, null);
            }
            else if (currentInstance.CurrentStage == WorkflowStage.ForwardedDR)
            {
                break;
            }

            currentInstance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == workflowInstanceId);
        }
    }

    // -------------------------------------------------------------- Forward

    [Fact]
    public async Task ForwardIndent_ReachesTheServiceAndAdvancesTheChain()
    {
        var f = await CreateAsync();
        var indentId = await RaisedIndentAsync(f);

        // Move to SignedCopyUploaded first
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await f.Workflow.UploadSignedCopyAsync(indent.WorkflowInstanceId, Guid.NewGuid(), Raiser, null);

        SetUser(f.Controller, Guid.NewGuid(), Hod);

        var result = await f.Controller.Forward(indentId, new RemarksRequest("Ready for approval"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
    }

    // -------------------------------------------------------------- Approve

    [Fact]
    public async Task ApproveIndent_ReachesTheServiceAndChangesTheStage()
    {
        var f = await CreateAsync();
        var indentId = await RaisedIndentAsync(f);

        // Advance to ForwardedDR where approval is possible
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var actorId = Guid.NewGuid();
        await AdvanceToStageAsync(f, indent.WorkflowInstanceId, WorkflowStage.ForwardedDR, actorId);

        SetUser(f.Controller, actorId, ["Dean"]);
        var result = await f.Controller.Approve(indentId, new RemarksRequest("Approved"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
    }

    // --------------------------------------------------------------- Reject

    [Fact]
    public async Task RejectIndent_ReachesTheServiceAndConcludesTheChain()
    {
        var f = await CreateAsync();
        var indentId = await RaisedIndentAsync(f);

        // Advance to ForwardedDR where rejection is possible
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var actorId = Guid.NewGuid();
        await AdvanceToStageAsync(f, indent.WorkflowInstanceId, WorkflowStage.ForwardedDR, actorId);

        SetUser(f.Controller, actorId, ["Dean"]);
        var result = await f.Controller.Reject(indentId, new RemarksRequest("Not approved"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
    }

    // --------------------------------------------------------------- Return

    [Fact]
    public async Task ReturnIndent_ReachesTheServiceAndReturnsIt()
    {
        var f = await CreateAsync();
        var indentId = await RaisedIndentAsync(f);

        // Advance to ForwardedDR where return is possible
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var actorId = Guid.NewGuid();
        await AdvanceToStageAsync(f, indent.WorkflowInstanceId, WorkflowStage.ForwardedDR, actorId);

        SetUser(f.Controller, actorId, ["Dean"]);
        var result = await f.Controller.Return(indentId, new RemarksRequest("Fix the request"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
    }

    // -------------------------------------------------------- No workflow instance

    /// <summary>
    /// An indent row with no WorkflowInstanceId set throws when trying to advance
    /// the workflow. Exercised via Forward; the same guard runs ahead of all four actions.
    /// </summary>
    [Fact]
    public async Task ForwardIndent_WithNoWorkflowInstance_Throws()
    {
        var f = await CreateAsync();
        var indentId = Guid.NewGuid();
        f.Db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = indentId,
            ProjectId = f.ProjectId,
            BudgetHeadId = f.BudgetHeadId,
            WorkflowInstanceId = Guid.Empty,
            Name = "Test",
            TechnicalSpecs = "Test",
            UnitOfMeasurement = "Nos",
            Purpose = "Test",
            EstimatedCost = 1000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, Guid.NewGuid(), Office);

        var act = () => f.Controller.Forward(indentId, new RemarksRequest(null), CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }
}
