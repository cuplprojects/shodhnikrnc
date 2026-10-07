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
/// Task 6: ListForHodGrantReceiptQueueAsync/ListForRnCOfficeGrantReceiptQueueAsync/
/// ListForDeanGrantReceiptQueueAsync, mirroring
/// ResearchProposalService.ListForHodAsync/ListForRnCOfficeAsync's own test
/// coverage exactly -- most importantly the R&amp;C-office/Dean department-scope
/// refusal, which the Advertisement plan's Task 6 originally shipped without
/// and its final review caught as a Critical cross-department information
/// disclosure bug (see ProjectService.ListForRnCOfficeGrantReceiptQueueAsync's
/// own remarks).
/// </summary>
public class GrantReceiptQueueTests
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
        var service = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), userDepartment,
            new InstituteWideScopeResolver(db, userDepartment), new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

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
    private static readonly string[] RnCRole = ["RegularStaff"];

    // ---- ListForHodGrantReceiptQueueAsync ----------------------------------

    [Fact]
    public async Task ListForHodGrantReceiptQueueAsync_ReturnsOnlyReceiptsAtWithHODInTheHodsOwnDepartment()
    {
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);

        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId;

        var queue = await f.Service.ListForHodGrantReceiptQueueAsync(hodUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
        queue.Single().ProjectId.Should().Be(project.Id);
        queue.Single().CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    [Fact]
    public async Task ListForHodGrantReceiptQueueAsync_ExcludesOtherDepartments()
    {
        var f = await CreateAsync();
        var otherDepartmentId = Guid.NewGuid();
        f.Db.Departments.Add(new Department
        {
            Id = otherDepartmentId, Code = "EE", Name = "Electrical Engineering", IsInstituteWide = false,
        });
        await f.Db.SaveChangesAsync();

        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = otherDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);
        await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId; // different department than the project

        var queue = await f.Service.ListForHodGrantReceiptQueueAsync(hodUserId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForHodGrantReceiptQueueAsync_ExcludesReceiptsPastTheHodStage()
    {
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);

        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        // HOD forwards -> WithRnCOfficeGrantReceipt, past the HOD's own stage.
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var hodUserId = Guid.NewGuid();
        f.DepartmentByUser[hodUserId] = PiDepartmentId;

        var queue = await f.Service.ListForHodGrantReceiptQueueAsync(hodUserId);

        queue.Should().BeEmpty();
    }

    // ---- ListForRnCOfficeGrantReceiptQueueAsync ----------------------------

    [Fact]
    public async Task ListForRnCOfficeGrantReceiptQueueAsync_RequiresTheCallerToBeInAnInstituteWideDepartment()
    {
        // Mirrors ResearchProposalService.ListForRnCOfficeAsync's own test
        // exactly: an office role whose own department is not flagged
        // institute-wide must see nothing, not every department's queue.
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);

        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var officeUserId = Guid.NewGuid();
        f.DepartmentByUser[officeUserId] = PiDepartmentId; // NOT institute-wide (IsInstituteWide = false)

        var queue = await f.Service.ListForRnCOfficeGrantReceiptQueueAsync(officeUserId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForRnCOfficeGrantReceiptQueueAsync_WithInstituteWideMembership_SeesEveryDepartmentsReceipts()
    {
        // WithRnCOfficeGrantReceipt is no longer reachable by ordinary
        // forwarding since the chain expansion (Task 1) split it into
        // AssignedToDAGrantReceipt/WithSuperintendentGrantReceipt/
        // WithDeputyRegistrarGrantReceipt -- this old stage stays a valid,
        // resolvable route member forever (per WorkflowStage's "never
        // delete" rule) so ListForRnCOfficeGrantReceiptQueueAsync itself is
        // unchanged and still needs covering, but a receipt can only be put
        // there directly now, matching how any other now-unused-by-new-flow
        // stage would be tested.
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
        instance.CurrentStage = WorkflowStage.WithRnCOfficeGrantReceipt;
        await f.Db.SaveChangesAsync();

        var officeUserId = Guid.NewGuid();
        f.DepartmentByUser[officeUserId] = rncDepartmentId;

        var queue = await f.Service.ListForRnCOfficeGrantReceiptQueueAsync(officeUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id, "office staff act across every department, not just their own");
        queue.Single().CurrentStage.Should().Be(WorkflowStage.WithRnCOfficeGrantReceipt);
    }

    [Fact]
    public async Task ListForRnCOfficeGrantReceiptQueueAsync_OnlyShowsTheRnCOfficeStage()
    {
        var f = await CreateAsync();
        var rncDepartmentId = Guid.NewGuid();
        f.Db.Departments.Add(new Department
        {
            Id = rncDepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        await f.Db.SaveChangesAsync();

        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId, sanctionedYear1: 100_000m);

        // Still at WithHODGrantReceipt -- the HOD's stage, not the office's.
        await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        var officeUserId = Guid.NewGuid();
        f.DepartmentByUser[officeUserId] = rncDepartmentId;

        var queue = await f.Service.ListForRnCOfficeGrantReceiptQueueAsync(officeUserId);

        queue.Should().BeEmpty();
    }

    // ---- ListForDeanGrantReceiptQueueAsync ---------------------------------

    [Fact]
    public async Task ListForDeanGrantReceiptQueueAsync_RequiresTheCallerToBeInAnInstituteWideDepartment()
    {
        var f = await CreateAsync();
        var ownerUserId = Guid.NewGuid();
        f.DepartmentByUser[ownerUserId] = PiDepartmentId;
        var (project, head) = await CreateSampleProjectAsync(f.Service, ownerUserId);

        var receipt = await f.Service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "RnC ok", default);

        var deanUserId = Guid.NewGuid();
        f.DepartmentByUser[deanUserId] = PiDepartmentId; // NOT institute-wide

        var queue = await f.Service.ListForDeanGrantReceiptQueueAsync(deanUserId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForDeanGrantReceiptQueueAsync_WithInstituteWideMembership_SeesTheReceiptAtWithDean()
    {
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "DA ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), ["Superintendent"], "Superintendent ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), ["DeputyRegistrar"], "DeputyRegistrar ok", default);

        var deanUserId = Guid.NewGuid();
        f.DepartmentByUser[deanUserId] = rncDepartmentId;

        var queue = await f.Service.ListForDeanGrantReceiptQueueAsync(deanUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
        queue.Single().CurrentStage.Should().Be(WorkflowStage.WithDeanGrantReceipt);
    }

    // ---- ListForDaGrantReceiptQueueAsync / ListForSuperintendentGrantReceiptQueueAsync / ListForDeputyRegistrarGrantReceiptQueueAsync ----

    [Fact]
    public async Task ListForDaGrantReceiptQueueAsync_ReturnsReceiptsAtTheDaStage()
    {
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var daUserId = Guid.NewGuid();
        f.DepartmentByUser[daUserId] = rncDepartmentId;

        var queue = await f.Service.ListForDaGrantReceiptQueueAsync(daUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
        queue.Single().CurrentStage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);
    }

    [Fact]
    public async Task ListForSuperintendentGrantReceiptQueueAsync_ReturnsReceiptsAtTheSuperintendentStage()
    {
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "DA ok", default);

        var superintendentUserId = Guid.NewGuid();
        f.DepartmentByUser[superintendentUserId] = rncDepartmentId;

        var queue = await f.Service.ListForSuperintendentGrantReceiptQueueAsync(superintendentUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
        queue.Single().CurrentStage.Should().Be(WorkflowStage.WithSuperintendentGrantReceipt);
    }

    [Fact]
    public async Task ListForDeputyRegistrarGrantReceiptQueueAsync_ReturnsReceiptsAtTheDeputyRegistrarStage()
    {
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "DA ok", default);
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), ["Superintendent"], "Superintendent ok", default);

        var drUserId = Guid.NewGuid();
        f.DepartmentByUser[drUserId] = rncDepartmentId;

        var queue = await f.Service.ListForDeputyRegistrarGrantReceiptQueueAsync(drUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
        queue.Single().CurrentStage.Should().Be(WorkflowStage.WithDeputyRegistrarGrantReceipt);
    }

    [Fact]
    public async Task ListForDaGrantReceiptQueueAsync_ExcludesReceiptsLockedToADifferentDa()
    {
        // AssignedToDAGrantReceipt's AllowedRoles is "RegularStaff", the same
        // generalized rule WorkflowEngineService.RequireRoleAsync narrows by
        // IsAssignedViaProjectDa/AssignedToUserId for every RegularStaff-listed
        // stage. The DA queue must apply the same narrowing the engine itself
        // would enforce on an actual Forward/Reject/Return call, or a DA's
        // "select all" could include another DA's locked receipt and fail the
        // whole bulk batch when the engine rejects it.
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var otherDaUserId = Guid.NewGuid();
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == receipt.WorkflowInstanceId);
        instance.AssignedToUserId = otherDaUserId;
        instance.IsAssignedViaProjectDa = true;
        await f.Db.SaveChangesAsync();

        var callingDaUserId = Guid.NewGuid();
        f.DepartmentByUser[callingDaUserId] = rncDepartmentId;

        var queue = await f.Service.ListForDaGrantReceiptQueueAsync(callingDaUserId);

        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForDaGrantReceiptQueueAsync_IncludesReceiptsLockedToTheCallingDa()
    {
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var callingDaUserId = Guid.NewGuid();
        f.DepartmentByUser[callingDaUserId] = rncDepartmentId;
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == receipt.WorkflowInstanceId);
        instance.AssignedToUserId = callingDaUserId;
        instance.IsAssignedViaProjectDa = true;
        await f.Db.SaveChangesAsync();

        var queue = await f.Service.ListForDaGrantReceiptQueueAsync(callingDaUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
    }

    [Fact]
    public async Task ListForDaGrantReceiptQueueAsync_IncludesUnassignedReceipts()
    {
        // IsAssignedViaProjectDa defaults false -- a receipt whose project has
        // no permanent DA assignment must still show up for any DA.
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
        await f.Service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        var callingDaUserId = Guid.NewGuid();
        f.DepartmentByUser[callingDaUserId] = rncDepartmentId;

        var queue = await f.Service.ListForDaGrantReceiptQueueAsync(callingDaUserId);

        queue.Should().ContainSingle(q => q.Id == receipt.Id);
    }
}
