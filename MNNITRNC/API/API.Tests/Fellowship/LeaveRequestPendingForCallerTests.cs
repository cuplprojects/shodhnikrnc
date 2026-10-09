using API.Application.Access;
using API.Application.Fellowship;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// <see cref="ILeaveService.ListPendingForCallerAsync"/> -- the dashboard's
/// "pending my action" panel for leave requests. Same shape as
/// <see cref="FellowshipClaimPendingForCallerTests"/>, using a LeaveRequest +
/// its own department-derivation chain (LeaveRequest -> ManpowerSelection ->
/// SanctionedManpowerPosition -> Project.DepartmentId, confirmed identical to
/// FellowshipClaim's own chain by reading LeaveService.ListRequestsAsync)
/// instead of a FellowshipClaim.
/// </summary>
public class LeaveRequestPendingForCallerTests
{
    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed class NeverInstituteWide : IInstituteWideScopeResolver
    {
        public Task<bool> IsInstituteWideAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(false);
    }

    private static LeaveService BuildService(TestProcurementDbContext db, Guid callerDepartmentId)
    {
        var workflow = new WorkflowEngineService(db);
        var context = new FellowContextService(db);
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var userDepartment = new FakeDepartment(callerDepartmentId);

        return new LeaveService(
            db, context, workflow, pendingQuery, userDepartment, new NeverInstituteWide());
    }

    /// <summary>
    /// Seeds the full chain (Project in <paramref name="departmentId"/> ->
    /// SanctionedManpowerPosition -> ManpowerSelection -> LeaveRequest) plus a
    /// WorkflowInstance planted directly at <paramref name="stage"/> --
    /// bypasses the actual approval chain (irrelevant to this method, which
    /// only reads WorkflowInstanceId + CurrentStage) so each test can plant a
    /// request at exactly the stage it needs. Uses the generic indent route's
    /// stages (this codebase's shared office-escalation vocabulary --
    /// SignedCopyUploaded carries "HOD", Assigned carries "RegularStaff" per
    /// WorkflowDefinitionSeeder.ShippedRoute) since leave requests raise their
    /// workflow instance at WorkflowPhase.Indent with no dedicated
    /// leave-specific seeder, unlike FellowshipClaim's own
    /// FellowshipWorkflowSeeder route.
    /// </summary>
    private static Guid CreateLeaveRequestAsync(
        TestProcurementDbContext db, Guid departmentId, WorkflowStage stage)
    {
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = $"SAN-{requestId:N}",
            SanctionDate = new DateOnly(2026, 1, 1),
            ProjectTitle = "Pending-for-caller fixture project",
            StartDate = new DateOnly(2026, 1, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 37_000m,
            Hra = 7_400m,
        });

        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            CandidateId = Guid.NewGuid(),
            ApplicationUserId = Guid.NewGuid(),
            SanctionedManpowerPositionId = positionId,
            JoinedOn = new DateOnly(2026, 1, 1),
            ValidTill = new DateOnly(2026, 12, 31),
            RecommendedStipend = 37_000m,
            IdCardNumber = "MNNIT/JRF/001",
            IdCardIssuedAt = DateTimeOffset.UtcNow,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId,
            RequestType = RequestType.LeaveRequest,
            RequestId = requestId,
            Phase = WorkflowPhase.Indent,
            CurrentStage = stage,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.LeaveRequests.Add(new LeaveRequest
        {
            Id = requestId,
            FellowAppointmentId = appointmentId,
            WorkflowInstanceId = instanceId,
            LeaveType = LeaveType.Annual,
            Dates = [new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 2), new DateOnly(2026, 3, 3)],
            DayCount = 3,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.SaveChanges();
        return requestId;
    }

    [Fact]
    public async Task HodSeesOnlyOwnDepartmentsLeaveRequestAtItsOwnStage()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.AddRange(
            new Department { Id = deptA, Code = "CSE", Name = "Computer Science", IsInstituteWide = false },
            new Department { Id = deptB, Code = "ECE", Name = "Electronics", IsInstituteWide = false });
        db.SaveChanges();

        // The generic indent route (Raised -> Assigned -> Forwarded -> ...),
        // seeded so WorkflowStage.Assigned carries a real AllowedRoles value
        // ("HOD" per WorkflowDefinitionSeeder.ShippedRoute) rather than the
        // unconfigured-route fallback.
        await WorkflowDefinitionSeeder.SeedAsync(db);

        var pendingInDeptA = CreateLeaveRequestAsync(db, deptA, WorkflowStage.SignedCopyUploaded);
        CreateLeaveRequestAsync(db, deptA, WorkflowStage.Assigned); // RegularStaff's stage, not HOD's
        CreateLeaveRequestAsync(db, deptB, WorkflowStage.SignedCopyUploaded); // wrong department

        var hodUserId = Guid.NewGuid();
        var sut = BuildService(db, deptA);

        var result = await sut.ListPendingForCallerAsync(hodUserId, ["HOD"]);

        result.Should().ContainSingle(r => r.Id == pendingInDeptA);
    }

    [Fact]
    public async Task WrongRoleForTheStageGetsEmpty()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var deptA = Guid.NewGuid();
        db.Departments.Add(
            new Department { Id = deptA, Code = "CSE", Name = "Computer Science", IsInstituteWide = false });
        db.SaveChanges();

        await WorkflowDefinitionSeeder.SeedAsync(db);

        CreateLeaveRequestAsync(db, deptA, WorkflowStage.SignedCopyUploaded);

        var facultyUserId = Guid.NewGuid();
        var sut = BuildService(db, deptA);

        // Faculty is not in SignedCopyUploaded's AllowedRoles ("HOD").
        var result = await sut.ListPendingForCallerAsync(facultyUserId, ["Faculty"]);

        result.Should().BeEmpty();
    }
}
