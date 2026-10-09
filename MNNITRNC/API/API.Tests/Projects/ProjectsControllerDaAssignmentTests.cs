using System.Security.Claims;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Projects;
using API.Application.Workflow;
using API.Contracts.Projects;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class ProjectsControllerDaAssignmentTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        ApplicationDbContext Db, ProjectsController Controller,
        UserManager<ApplicationUser> UserManager, Guid ProjectId);

    private static async Task<Fixture> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var userStore = new UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>(db);
        var userManager = new UserManager<ApplicationUser>(
            userStore, null!, new PasswordHasher<ApplicationUser>(), [], [],
            new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!, null!);

        var roleStore = new RoleStore<IdentityRole<Guid>, ApplicationDbContext, Guid>(db);
        var roleManager = new RoleManager<IdentityRole<Guid>>(
            roleStore, [], new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!);
        await roleManager.CreateAsync(new IdentityRole<Guid>("RegularStaff"));
        await roleManager.CreateAsync(new IdentityRole<Guid>("Faculty"));

        var projectId = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = Guid.NewGuid(), ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DA-CTRL-1", SanctionDate = ProjectStart, ProjectTitle = "DA Controller Test Project",
            StartDate = ProjectStart, Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var yearCalculator = new ProjectYearCalculator();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new FakeDepartment(null);
        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        var budgetSummaryService = new BudgetSummaryService(db, yearCalculator);
        var refundService = new RefundService(db, new AuditService(db));

        var controller = new ProjectsController(projectService, budgetSummaryService, refundService, db, userManager);
        return new Fixture(db, controller, userManager, projectId);
    }

    private static void SetUser(ProjectsController controller, Guid userId, params string[] roles)
    {
        var httpContext = new DefaultHttpContext();
        var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()) };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    [Fact]
    public async Task AssignDa_TargetUserIsRegularStaff_Succeeds()
    {
        var f = await CreateAsync();
        var daUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "da1", Email = "da1@mnnit.ac.in", FullName = "DA One", IsActive = true, CreatedAt = DateTimeOffset.UtcNow };
        await f.UserManager.CreateAsync(daUser, "Password@123");
        await f.UserManager.AddToRoleAsync(daUser, "RegularStaff");

        SetUser(f.Controller, Guid.NewGuid(), "Superintendent");

        var result = await f.Controller.AssignDa(f.ProjectId, new AssignDaRequest(daUser.Id, "Initial assignment"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId.Should().Be(daUser.Id);
    }

    [Fact]
    public async Task AssignDa_TargetUserNotRegularStaff_ReturnsBadRequest()
    {
        var f = await CreateAsync();
        var facultyUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "faculty9", Email = "faculty9@mnnit.ac.in", FullName = "Faculty Nine", IsActive = true, CreatedAt = DateTimeOffset.UtcNow };
        await f.UserManager.CreateAsync(facultyUser, "Password@123");
        await f.UserManager.AddToRoleAsync(facultyUser, "Faculty");

        SetUser(f.Controller, Guid.NewGuid(), "Dean");

        var result = await f.Controller.AssignDa(f.ProjectId, new AssignDaRequest(facultyUser.Id, "Trying anyway"), CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId.Should().BeNull();
    }

    [Fact]
    public async Task AssignDa_ActorNotSuperintendentOrDean_ReturnsForbidden()
    {
        var f = await CreateAsync();
        var daUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "da2", Email = "da2@mnnit.ac.in", FullName = "DA Two", IsActive = true, CreatedAt = DateTimeOffset.UtcNow };
        await f.UserManager.CreateAsync(daUser, "Password@123");
        await f.UserManager.AddToRoleAsync(daUser, "RegularStaff");

        SetUser(f.Controller, Guid.NewGuid(), "RegularStaff");

        var act = async () => await f.Controller.AssignDa(f.ProjectId, new AssignDaRequest(daUser.Id, "Reason"), CancellationToken.None);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task AssignDa_UnauthorizedActor_NonexistentTarget_RejectedOnActorRoleBeforeTargetLookup()
    {
        // The target id matches no user at all. If the target-role lookup ran
        // first this would be a 400 BadRequest ("must hold RegularStaff"),
        // leaking target information to an unauthorized caller; instead the
        // actor check must reject first with the 403-mapped exception.
        var f = await CreateAsync();
        SetUser(f.Controller, Guid.NewGuid(), "RegularStaff", "Faculty");

        var act = async () => await f.Controller.AssignDa(
            f.ProjectId, new AssignDaRequest(Guid.NewGuid(), "Probing"), CancellationToken.None);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>()
            .WithMessage("*Superintendent or Dean*");
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId.Should().BeNull();
    }

    [Fact]
    public async Task AssignDa_UnauthorizedActor_NonRegularStaffTarget_StillForbiddenNotBadRequest()
    {
        var f = await CreateAsync();
        var facultyUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "faculty10", Email = "faculty10@mnnit.ac.in", FullName = "Faculty Ten", IsActive = true, CreatedAt = DateTimeOffset.UtcNow };
        await f.UserManager.CreateAsync(facultyUser, "Password@123");
        await f.UserManager.AddToRoleAsync(facultyUser, "Faculty");

        SetUser(f.Controller, Guid.NewGuid(), "Faculty");

        var act = async () => await f.Controller.AssignDa(
            f.ProjectId, new AssignDaRequest(facultyUser.Id, "Probing"), CancellationToken.None);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }
}
