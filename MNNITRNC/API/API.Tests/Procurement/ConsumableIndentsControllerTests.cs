using System.Security.Claims;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

/// <summary>
/// GetAllProcurementIndents ("api/procurement/all-indents") is IndentApprovalPage's
/// data source. It previously carried [AllowAnonymous] and queried every
/// non-deleted project institute-wide with no auth or department check at all --
/// any unauthenticated caller could read every project's procurement financial
/// data. These tests pin the fix: the endpoint requires a signed-in user and
/// scopes results the same way ProjectService.ListVisibleToAsync already scopes
/// the project list (HOD -> own department only).
/// </summary>
public class ConsumableIndentsControllerTests
{
    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(TestProcurementDbContext Db, ConsumableIndentsController Controller);

    private static Fixture Create(Guid? callerDepartmentId)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var yearCalculator = new ProjectYearCalculator();
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var workflowDefinitions = new WorkflowDefinitionService(db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();
        var faculty = new StubFacultyProfileProvider();
        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), new FakeDepartment(callerDepartmentId),
            new InstituteWideScopeResolver(db, new FakeDepartment(callerDepartmentId)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var indentService = new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, workflowDefinitions, docGen, storage, faculty, projectService);

        var controller = new ConsumableIndentsController(indentService, budgetValidator, db, projectService);
        return new Fixture(db, controller);
    }

    private static void SetUser(ConsumableIndentsController controller, Guid? userId, params string[] roles)
    {
        var httpContext = new DefaultHttpContext();
        if (userId is not null)
        {
            var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.Value.ToString()) };
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        }
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    private static Project MakeProject(Guid departmentId) => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = Guid.NewGuid(),
        DepartmentId = departmentId,
        ProjectType = ProjectType.TypeIResearch,
        SanctionNo = $"SAN-{Guid.NewGuid():N}",
        SanctionDate = new DateOnly(2024, 6, 1),
        ProjectTitle = "Test Project",
        StartDate = new DateOnly(2024, 6, 1),
        Agency = "DST",
        DurationMonths = 36,
        TotalSanctioned = 1_000_000m,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task GetAllProcurementIndents_NoUser_ReturnsUnauthorized()
    {
        var f = Create(callerDepartmentId: Guid.NewGuid());
        SetUser(f.Controller, userId: null);

        var result = await f.Controller.GetAllProcurementIndents(CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task GetAllProcurementIndents_Hod_OnlySeesOwnDepartmentsIndents()
    {
        var ownDepartment = Guid.NewGuid();
        var otherDepartment = Guid.NewGuid();

        var f = Create(callerDepartmentId: ownDepartment);

        var ownProject = MakeProject(ownDepartment);
        var otherProject = MakeProject(otherDepartment);
        f.Db.Projects.AddRange(ownProject, otherProject);

        f.Db.ConsumableIndents.AddRange(
            new ConsumableIndent
            {
                Id = Guid.NewGuid(),
                ProjectId = ownProject.Id,
                BudgetHeadId = Guid.NewGuid(),
                WorkflowInstanceId = Guid.NewGuid(),
                Name = "Own department item",
                TechnicalSpecs = "n/a",
                UnitOfMeasurement = "Nos",
                Purpose = "Testing",
                EstimatedCost = 1000m,
                CreatedAt = DateTimeOffset.UtcNow,
            },
            new ConsumableIndent
            {
                Id = Guid.NewGuid(),
                ProjectId = otherProject.Id,
                BudgetHeadId = Guid.NewGuid(),
                WorkflowInstanceId = Guid.NewGuid(),
                Name = "Other department item",
                TechnicalSpecs = "n/a",
                UnitOfMeasurement = "Nos",
                Purpose = "Testing",
                EstimatedCost = 2000m,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, userId: Guid.NewGuid(), "HOD");

        var result = await f.Controller.GetAllProcurementIndents(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = Assert.IsAssignableFrom<System.Collections.IEnumerable>(ok.Value).Cast<object>().ToList();

        // Pins that a department-scoped HOD sees only their own department's
        // indents -- the removed AllowAnonymous + unscoped db.Projects query
        // would have returned both rows here regardless of caller.
        items.Should().HaveCount(1);
        var itemName = items[0].GetType().GetProperty("itemName")!.GetValue(items[0]);
        itemName.Should().Be("Own department item");
    }

    /// <summary>
    /// GetBudget now reuses ProjectService.GetAsync's full visibility rule
    /// instead of a narrower owner-or-Fellow-only check, so an HOD of the
    /// project's own department (previously 403'd) can view a head's
    /// budget snapshot -- needed to review an indent request's figures.
    /// </summary>
    [Fact]
    public async Task GetBudget_CallerIsHodOfProjectsDepartment_Succeeds()
    {
        var departmentId = Guid.NewGuid();
        var f = Create(callerDepartmentId: departmentId);

        var project = MakeProject(departmentId);
        var budgetHead = new BudgetHead
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 50_000m,
            Total = 50_000m,
        };
        f.Db.Projects.Add(project);
        f.Db.BudgetHeads.Add(budgetHead);
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, userId: Guid.NewGuid(), "HOD");

        var result = await f.Controller.GetBudget(budgetHead.Id, subHead: null, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().BeOfType<API.Contracts.Procurement.IndentBudgetSnapshotResponse>();
    }

    /// <summary>
    /// A caller with no relationship to the project (not owner, not
    /// Fellow, not HOD of its department, no RnC Office role) is still
    /// rejected -- widening the gate to include HOD/RnC Office must not
    /// widen it to everyone.
    /// </summary>
    [Fact]
    public async Task GetBudget_CallerUnrelatedToProject_ThrowsProjectAccessDenied()
    {
        var f = Create(callerDepartmentId: Guid.NewGuid());

        var project = MakeProject(Guid.NewGuid());
        var budgetHead = new BudgetHead
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 50_000m,
            Total = 50_000m,
        };
        f.Db.Projects.Add(project);
        f.Db.BudgetHeads.Add(budgetHead);
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, userId: Guid.NewGuid());

        var act = async () => await f.Controller.GetBudget(budgetHead.Id, subHead: null, CancellationToken.None);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }
}
