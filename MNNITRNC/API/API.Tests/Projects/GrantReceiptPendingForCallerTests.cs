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
/// <see cref="IProjectService.ListPendingGrantReceiptsForCallerAsync"/> --
/// the dashboard's "pending my action" panel for grant receipts. Built on
/// top of <see cref="IWorkflowPendingQueryService"/> (Task 1's stage-matching
/// primitive) plus this service's own department/institute-wide scoping,
/// mirroring <c>ResearchProposalPendingForCallerTests</c>'s fixture
/// conventions and <c>GrantReceiptQueueTests</c>'s ProjectService fixture.
/// </summary>
public class GrantReceiptPendingForCallerTests
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
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

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

    private static async Task<(Project Project, BudgetHead Head)> CreateSampleProjectAsync(
        ProjectService service, Guid ownerUserId, decimal sanctionedYear1 = 10_000m)
    {
        var project = await service.CreateAsync(
            ownerUserId,
            ProjectType.TypeIResearch,
            $"SAN-{Guid.NewGuid():N}"[..12],
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

    private static readonly string[] HodRole = ["HOD"];

    [Fact]
    public async Task HodSeesOnlyOwnDepartmentsReceiptAtWithHodGrantReceiptStage()
    {
        var f = await CreateAsync();

        var otherDepartmentId = Guid.NewGuid();
        f.Db.Departments.Add(new Department
        {
            Id = otherDepartmentId, Code = "EE", Name = "Electrical Engineering", IsInstituteWide = false,
        });
        await f.Db.SaveChangesAsync();

        // Own department: a receipt sitting at WithHODGrantReceipt.
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);
        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        // Another department's receipt, also at WithHODGrantReceipt -- must
        // not leak across departments.
        var otherOwnerUserId = Guid.NewGuid();
        f.DepartmentByUser[otherOwnerUserId] = otherDepartmentId;
        var (otherProject, otherHead) = await CreateSampleProjectAsync(f.Service, otherOwnerUserId);
        await f.Service.RecordGrantReceiptAsync(
            otherProject.Id, otherOwnerUserId, otherHead.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId;

        var result = await f.Service.ListPendingGrantReceiptsForCallerAsync(hodUserId, HodRole);

        result.Should().ContainSingle(r => r.Id == receipt.Id);
        result.Single().ProjectId.Should().Be(project.Id);
        result.Single().CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    private static readonly string[] RegularStaffRole = ["RegularStaff"];

    [Fact]
    public async Task NonInstituteWideRegularStaffDoesNotSeeSameDepartmentsOfficeStageReceipt()
    {
        // WithRnCOfficeGrantReceipt's AllowedRoles is the whole Office group
        // ("RegularStaff,Superintendent,DeputyRegistrar,Dean") -- a
        // RegularStaff account whose own department happens to coincide
        // with the receipt's must NOT see it that way, the same guarantee
        // ListForRnCOfficeGrantReceiptQueueAsync's own gate already
        // provides and this method must not silently bypass. This is the
        // cross-department information-disclosure gap the final
        // whole-branch review caught: a blanket "same department OR
        // institute-wide" check would incorrectly show this receipt.
        var f = await CreateAsync();

        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);
        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == receipt.WorkflowInstanceId);
        instance.CurrentStage = WorkflowStage.WithRnCOfficeGrantReceipt;
        await f.Db.SaveChangesAsync();

        var regularStaffUserId = Guid.NewGuid();
        f.DepartmentByUser[regularStaffUserId] = PiDepartmentId;

        var result = await f.Service.ListPendingGrantReceiptsForCallerAsync(regularStaffUserId, RegularStaffRole);

        result.Should().BeEmpty();
    }

    [Theory]
    [InlineData(WorkflowStage.AssignedToDAGrantReceipt, "RegularStaff")]
    [InlineData(WorkflowStage.WithSuperintendentGrantReceipt, "Superintendent")]
    [InlineData(WorkflowStage.WithDeputyRegistrarGrantReceipt, "DeputyRegistrar")]
    public async Task PendingForCaller_NewOfficeStages_AreVisibleInstituteWideNotJustOwnDepartment(
        WorkflowStage stage, string role)
    {
        // The caller's own department (rncDepartmentId, institute-wide) differs
        // from the receipt's project's department (PiDepartmentId) -- if
        // GrantReceiptOfficeChainStages did not include this stage,
        // ListPendingGrantReceiptsForCallerAsync's IsVisible check would apply
        // its department-only branch instead of the institute-wide one and
        // wrongly return an empty result.
        var f = await CreateAsync();
        var rncDepartmentId = Guid.NewGuid();
        f.Db.Departments.Add(new Department
        {
            Id = rncDepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        await f.Db.SaveChangesAsync();

        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);
        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == receipt.WorkflowInstanceId);
        instance.CurrentStage = stage;
        await f.Db.SaveChangesAsync();

        var officeUserId = Guid.NewGuid();
        f.DepartmentByUser[officeUserId] = rncDepartmentId;

        var result = await f.Service.ListPendingGrantReceiptsForCallerAsync(officeUserId, [role]);

        result.Should().ContainSingle(r => r.Id == receipt.Id);
    }
}
