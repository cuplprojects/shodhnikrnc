using System.Reflection;
using API.Application.Audit;
using API.Application.Projects;
using API.Authorization;
using API.Contracts.Projects;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

/// <summary>
/// This codebase has no WebApplicationFactory/TestServer fixture anywhere
/// (confirmed by the same search AdminUsersControllerAuthorizationTests.cs
/// and DynamicIndentControllerTests.cs document -- every controller-adjacent
/// test is a plain unit test that instantiates the controller directly and
/// stubs ControllerContext.HttpContext.User with claims). This file follows
/// that exact precedent: DynamicIndentControllerTests' SetUser helper for
/// stubbing an authenticated ClaimsPrincipal with specific roles, and
/// AdminUsersControllerAuthorizationTests' reflection-based assertion for
/// proving the [PageAccess] gate is actually attached (since a 403 from the
/// real ASP.NET authorization pipeline cannot be exercised without a hosted
/// TestServer, which this project does not have).
/// </summary>
public class HistoricalEntriesControllerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProjectsDbContext Db, HistoricalEntriesController Controller,
        Guid ProjectId, Guid BudgetHeadId, Guid DepartmentId, Guid OwnerUserId);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);

        var departmentId = Guid.NewGuid();
        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Departments.Add(new Department
        {
            Id = departmentId, Code = "CSE", Name = "Computer Science & Engineering",
        });
        db.Users.Add(new ApplicationUser
        {
            Id = ownerUserId, FullName = "Dr. Test PI", UserName = "test-pi", Email = "test-pi@example.com",
        });
        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = ownerUserId, DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-HIST-CTRL-1", SanctionDate = ProjectStart, ProjectTitle = "Historical Entries Controller Test",
            StartDate = ProjectStart, Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId, ProjectId = projectId, HeadName = BudgetHeadName.RecurringTravel,
            Year1Amount = 100_000m, Year2Amount = 100_000m, Year3Amount = 100_000m,
        });
        db.SaveChanges();

        var service = new HistoricalEntryService(db, new ProjectYearCalculator(), new AuditService(db));
        var controller = new HistoricalEntriesController(service, db);

        return new Fixture(db, controller, projectId, budgetHeadId, departmentId, ownerUserId);
    }

    private static void SetUser(HistoricalEntriesController controller, Guid userId, params string[] roles)
    {
        var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()),
        };
        claims.AddRange(roles.Select(r => new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, r)));
        httpContext.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    [Fact]
    public async Task RecordExpenditure_CalledBySuperintendent_ReturnsOkWithResponse()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        var request = new RecordHistoricalExpenditureRequest(
            f.BudgetHeadId, 12_000m, "Year 1 travel, from offline register", new DateOnly(2024, 8, 1));

        var result = await f.Controller.RecordExpenditure(f.ProjectId, request, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<HistoricalExpenditureResponse>().Subject;
        response.ProjectId.Should().Be(f.ProjectId);
        response.BudgetHeadId.Should().Be(f.BudgetHeadId);
        response.Amount.Should().Be(12_000m);
        response.HeadName.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void RecordExpenditure_IsGatedOnTheHistoricalEntriesPage()
    {
        // The controller has no TestServer to exercise the real 403 against a
        // caller holding only "Faculty" (not an Office role), so -- following
        // AdminUsersControllerAuthorizationTests' precedent exactly -- this
        // asserts the class carries [PageAccess("projects.historical-entries")],
        // which resolves to the ASP.NET policy
        // "page:projects.historical-entries". PageCatalogue.cs seeds that page
        // to Office (Dean, DeputyRegistrar, Superintendent, RegularStaff)
        // alone, so any role outside that set -- including Faculty -- is
        // provably excluded by construction once the policy name matches:
        // PageAccessPolicyProvider/PageAccessHandler refuse any caller
        // PageAccessDecision does not report as holding this exact key.
        var attribute = typeof(HistoricalEntriesController).GetCustomAttribute<PageAccessAttribute>()
            ?? throw new InvalidOperationException("HistoricalEntriesController no longer carries a [PageAccess] attribute.");

        attribute.Policy.Should().Be(PageAccessAttribute.PolicyPrefix + "projects.historical-entries");
    }

    [Fact]
    public async Task RecordGrantReceipt_ValidBody_ReturnsOkWithResponse()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        var request = new RecordHistoricalGrantReceiptRequest(
            f.BudgetHeadId, 15_000m, new DateOnly(2024, 7, 1), "Year 1 travel receipt");

        var result = await f.Controller.RecordGrantReceipt(f.ProjectId, request, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<HistoricalGrantReceiptResponse>().Subject;
        response.ProjectId.Should().Be(f.ProjectId);
        response.BudgetHeadId.Should().Be(f.BudgetHeadId);
        response.Amount.Should().Be(15_000m);
        response.Remarks.Should().Be("Year 1 travel receipt");
    }

    [Fact]
    public async Task DeleteExpenditure_ExistingRow_ReturnsNoContent_ThenSecondDeleteReturnsNotFound()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        var recordRequest = new RecordHistoricalExpenditureRequest(
            f.BudgetHeadId, 5_000m, "typo, wrong amount", new DateOnly(2024, 8, 1));
        var recordResult = await f.Controller.RecordExpenditure(f.ProjectId, recordRequest, CancellationToken.None);
        var expenditureId = ((HistoricalExpenditureResponse)((OkObjectResult)recordResult.Result!).Value!).Id;

        var firstDelete = await f.Controller.DeleteExpenditure(expenditureId, CancellationToken.None);
        firstDelete.Should().BeOfType<NoContentResult>();

        var secondDelete = await f.Controller.DeleteExpenditure(expenditureId, CancellationToken.None);
        secondDelete.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task ListForProject_AfterTwoPosts_ReturnsBothListsPopulated()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        await f.Controller.RecordExpenditure(
            f.ProjectId,
            new RecordHistoricalExpenditureRequest(f.BudgetHeadId, 4_000m, "offline expenditure", new DateOnly(2024, 8, 1)),
            CancellationToken.None);
        await f.Controller.RecordGrantReceipt(
            f.ProjectId,
            new RecordHistoricalGrantReceiptRequest(f.BudgetHeadId, 6_000m, new DateOnly(2024, 7, 1), "offline receipt"),
            CancellationToken.None);

        var result = await f.Controller.ListForProject(f.ProjectId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<HistoricalEntriesResponse>().Subject;
        response.Expenditures.Should().ContainSingle(e => e.Description == "offline expenditure");
        response.GrantReceipts.Should().ContainSingle(g => g.Remarks == "offline receipt");
    }

    [Fact]
    public async Task ListProjects_ReturnsProjectsWithDepartmentAndOwnerNamePopulated()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        var result = await f.Controller.ListProjects(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = ok.Value.Should().BeAssignableTo<IReadOnlyList<HistoricalEntryProjectItem>>().Subject;
        var item = items.Should().ContainSingle(i => i.ProjectId == f.ProjectId).Subject;
        item.DepartmentName.Should().NotBeNullOrEmpty();
        item.OwnerName.Should().NotBeNullOrEmpty();
        item.DepartmentId.Should().Be(f.DepartmentId);
        item.OwnerUserId.Should().Be(f.OwnerUserId);
    }
}
