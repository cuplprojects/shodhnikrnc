using System.Security.Claims;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Documents;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Controllers;
using API.Contracts.Procurement;
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
/// Tests the Market Committee step-recording endpoints (GetMarketCommitteeSteps,
/// RecordMarketCommitteeStep) added in Task 8, and verifies that a 409 from
/// <see cref="MarketCommitteeProcessIncompleteException"/> (Task 7) is
/// reachable through the real HTTP-facing Approve/Forward endpoints.
/// </summary>
public class MarketCommitteeControllerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentService Consumable,
        ConsumableIndentsController Controller,
        WorkflowEngineService Workflow,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId);

    private static Fixture Create()
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
            Year1Amount = 3_000_000m,
            Year2Amount = 3_000_000m,
            Year3Amount = 3_000_000m,
            Total = 9_000_000m,
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

        var projectService = new ProjectService(db, workflow, yearCalculator, new OverheadSplitValidator(),
            new StubDepartmentProvider(), new InstituteWideScopeResolver(db, new StubDepartmentProvider()),
            new StubAuditService(), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var indentService = new ConsumableIndentService(
            db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty,
            projectService);

        var controller = new ConsumableIndentsController(indentService, budgetValidator, db, projectService);

        return new Fixture(db, indentService, controller, workflow, ownerUserId, projectId, budgetHeadId);
    }

    private sealed class StubDepartmentProvider : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<Guid?>(Guid.NewGuid());
    }

    private sealed class StubAuditService : IAuditService
    {
        public Task LogAsync(string entityType, Guid entityId, string action, Guid actorUserId, string? detail = null,
            CancellationToken ct = default) =>
            Task.CompletedTask;

        public Task<IReadOnlyList<AuditLog>> QueryAsync(string? entityType = null, Guid? entityId = null,
            DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<AuditLog>>(Array.Empty<AuditLog>());
    }

    private static void SetUser(ConsumableIndentsController controller, Guid? userId, IReadOnlyCollection<string>? roles = null)
    {
        var httpContext = new DefaultHttpContext();
        if (userId is not null)
        {
            var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.Value.ToString()) };
            if (roles is not null)
            {
                claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
            }
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        }
        else
        {
            httpContext.User = new ClaimsPrincipal();
        }
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    private static RaiseIndentInput Input(Fixture f, decimal cost) =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.BudgetHeadId,
            Name: "Test Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research use",
            GemAvailability: GemAvailability.No,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: "NAC-1",
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            SanctionedEquipmentId: null,
            CommitteeMembers: [],
            GemQuotationPdf: null);

    /// <summary>
    /// Advances an indent workflow from IndentRaised to IndentWithDean, walking
    /// IndentWorkflowSeeder's real chain (see MarketCommitteeGatingTests'
    /// identically-purposed helper for the full stage-by-stage rationale).
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
    public async Task GetMarketCommitteeSteps_NoUser_ReturnsUnauthorized()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);

        // No user set
        SetUser(f.Controller, userId: null);
        var result = await f.Controller.GetMarketCommitteeSteps(indentId, CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task GetMarketCommitteeSteps_WithUser_ReachesService()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var actor = Guid.NewGuid();
        SetUser(f.Controller, actor);

        var result = await f.Controller.GetMarketCommitteeSteps(indentId, CancellationToken.None);

        // Should return OK with null (no steps recorded yet for a Raised indent)
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult?.Value.Should().BeNull();
    }

    [Fact]
    public async Task RecordMarketCommitteeStep_NoUser_ReturnsUnauthorized()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var request = new RecordMarketCommitteeStepRequest(MarketCommitteeStep.CommitteeFormed, new DateOnly(2024, 7, 1));

        // No user set
        SetUser(f.Controller, userId: null);
        var result = await f.Controller.RecordMarketCommitteeStep(indentId, request, CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task RecordMarketCommitteeStep_WithUser_ReachesService()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);

        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var actor = Guid.NewGuid();
        SetUser(f.Controller, actor, Office);

        var request = new RecordMarketCommitteeStepRequest(
            MarketCommitteeStep.CommitteeFormed, new DateOnly(2024, 7, 1));

        var result = await f.Controller.RecordMarketCommitteeStep(indentId, request, CancellationToken.None);

        // Should succeed (NoContent)
        result.Should().BeOfType<NoContentResult>();

        // Verify the step was actually recorded via the service
        var steps = await f.Consumable.GetMarketCommitteeStepsAsync(indentId);
        steps.Should().NotBeNull();
        steps!.CommitteeFormedOn.Should().Be(new DateOnly(2024, 7, 1));
    }

    [Fact]
    public async Task ForwardToDirector_AtForwardedDRInMarketCommitteeBand_WithIncompleteProcess_ThrowsMarketCommitteeProcessIncompleteException()
    {
        var f = Create();
        await WorkflowDefinitionSeeder.SeedAsync(f.Db);
        await IndentWorkflowSeeder.SeedAsync(f.Db);

        // Rs.2L-25L, non-GeM -> NonGem2LakhTo25Lakh tier (Market Committee band)
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 500_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        var workflowInstanceId = indent.WorkflowInstanceId;
        var actor = f.OwnerUserId;

        await AdvanceToForwardedDRAsync(f, workflowInstanceId, actor);
        SetUser(f.Controller, actor, ["Dean"]);

        // No MarketCommitteeProcess row (or incomplete)
        var request = new RemarksRequest("Test remarks");

        // Should throw MarketCommitteeProcessIncompleteException when incomplete
        var act = async () => await f.Controller.ForwardToDirector(indentId, request, CancellationToken.None);
        await act.Should().ThrowAsync<MarketCommitteeProcessIncompleteException>();
    }
}
