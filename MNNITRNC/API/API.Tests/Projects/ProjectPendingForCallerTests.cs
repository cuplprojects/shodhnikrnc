using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

/// <summary>
/// Tests for <see cref="IProjectService.ListPendingProjectsForCallerAsync"/> --
/// ensuring that Project items pending approval show up on the dashboard's "Pending Your Action" panel.
/// </summary>
public class ProjectPendingForCallerTests
{
    private static readonly Guid PiDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartmentPerUser(Dictionary<Guid, Guid?> byUser, Guid? fallback) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(byUser.TryGetValue(userId, out var dept) ? dept : fallback);
    }

    private sealed record Fixture(ProjectService Service, TestProjectsDbContext Db, Dictionary<Guid, Guid?> DepartmentByUser);

    private static async Task<Fixture> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        await ProjectWorkflowSeeder.SeedAsync(db);

        db.Departments.Add(new Department
        {
            Id = PiDepartmentId, Code = "CSE", Name = "Computer Science", IsInstituteWide = false,
        });
        await db.SaveChangesAsync();

        var departmentByUser = new Dictionary<Guid, Guid?>();
        var userDepartment = new FakeDepartmentPerUser(departmentByUser, PiDepartmentId);
        var workflow = new WorkflowEngineService(db);
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var service = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), userDepartment,
            new InstituteWideScopeResolver(db, userDepartment), new AuditService(db), pendingQuery);

        return new Fixture(service, db, departmentByUser);
    }

    [Fact]
    public async Task HodSeesProjectSubmittedForApprovalInSameDepartment()
    {
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;

        var project = await f.Service.CreateAsync(
            ownerUserId, ProjectType.TypeIResearch, "SAN-101", new DateOnly(2024, 6, 1),
            "Test Project 101", new DateOnly(2024, 6, 1), "CSIR", 12, 100_000m,
            [], [new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 50_000m, 0m, 0m)], [], []);

        await f.Service.SubmitForApprovalAsync(project.Id, ownerUserId, "Submitting for approval");

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId;

        var result = await f.Service.ListPendingProjectsForCallerAsync(hodUserId, ["HOD"]);

        result.Should().ContainSingle(p => p.Id == project.Id);
        result.Single().ProjectTitle.Should().Be("Test Project 101");
        result.Single().CurrentStage.Should().Be(WorkflowStage.WithHOD);
    }

    [Fact]
    public async Task PiSeesReturnedProjectInPendingList()
    {
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;

        var project = await f.Service.CreateAsync(
            ownerUserId, ProjectType.TypeIResearch, "SAN-102", new DateOnly(2024, 6, 1),
            "Test Project 102", new DateOnly(2024, 6, 1), "CSIR", 12, 100_000m,
            [], [new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 50_000m, 0m, 0m)], [], []);

        await f.Service.SubmitForApprovalAsync(project.Id, ownerUserId, "Submitting for approval");

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId;
        await f.Service.ReturnProjectAsync(project.Id, hodUserId, ["HOD"], "Needs revision");

        var result = await f.Service.ListPendingProjectsForCallerAsync(ownerUserId, ["Faculty"]);

        result.Should().ContainSingle(p => p.Id == project.Id);
        result.Single().CurrentStage.Should().Be(WorkflowStage.ReturnedToPI);
    }
}
