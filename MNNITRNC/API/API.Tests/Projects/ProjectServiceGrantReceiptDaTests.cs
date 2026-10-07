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

public class ProjectServiceGrantReceiptDaTests
{
    private static readonly Guid DefaultDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static async Task<(ProjectService Service, TestProjectsDbContext Db, WorkflowEngineService Workflow)> CreateServiceAsync()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var workflow = new WorkflowEngineService(db);
        var service = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(),
            new FakeDepartment(DefaultDepartmentId),
            new InstituteWideScopeResolver(db, new FakeDepartment(DefaultDepartmentId)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        return (service, db, workflow);
    }

    private static async Task<(Project Project, BudgetHead Head)> CreateSampleProjectAsync(
        ProjectService service, Guid ownerUserId, decimal sanctionedYear1 = 10_000m)
    {
        var project = await service.CreateAsync(
            ownerUserId,
            ProjectType.TypeIResearch,
            "SAN-DA-GR-1",
            new DateOnly(2024, 6, 1),
            "Sample Project",
            new DateOnly(2024, 6, 1),
            "DST",
            36,
            1_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, sanctionedYear1, 0m, 0m)],
            [],
            []);

        var head = project.BudgetHeads.Single();
        return (project, head);
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ProjectHasDaAssigned_NewInstanceAssignedToDaUser()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var daUserId = Guid.NewGuid();
        var trackedProject = await db.Projects.FirstAsync(p => p.Id == project.Id);
        trackedProject.CurrentDaUserId = daUserId;
        await db.SaveChangesAsync();

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 1_000m,
            overheadSplit: null, remarks: "First tranche received.");

        var instance = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instance.Should().NotBeNull();
        instance!.AssignedToUserId.Should().Be(daUserId);
        instance!.IsAssignedViaProjectDa.Should().BeTrue();
    }
}
