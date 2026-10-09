using API.Application.Access;
using API.Application.Audit;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class ProjectServiceDaAssignmentTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(TestProcurementDbContext Db, ProjectService Service, Guid ProjectId, Guid OwnerUserId);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = ownerUserId, ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DA-SVC-1", SanctionDate = ProjectStart, ProjectTitle = "DA Service Test Project",
            StartDate = ProjectStart, Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var yearCalculator = new ProjectYearCalculator();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new FakeDepartment(null);
        var service = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new Fixture(db, service, projectId, ownerUserId);
    }

    private static async Task<Guid> AddUserAsync(TestProcurementDbContext db, string fullName)
    {
        var id = Guid.NewGuid();
        db.Users.Add(new API.Domain.Entities.ApplicationUser
        {
            Id = id, UserName = fullName.Replace(" ", "").ToLowerInvariant(),
            Email = $"{id}@mnnit.ac.in", FullName = fullName, IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task AssignDaAsync_FirstAssignment_LogsFromUserIdAsNull()
    {
        var f = Create();
        var daUserId = await AddUserAsync(f.Db, "First DA");
        var actorUserId = Guid.NewGuid();

        await f.Service.AssignDaAsync(f.ProjectId, actorUserId, ["Superintendent"], daUserId, "Initial assignment");

        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId.Should().Be(daUserId);

        var logs = await f.Db.ProjectDaAssignmentLogs.Where(l => l.ProjectId == f.ProjectId).ToListAsync();
        logs.Should().HaveCount(1);
        logs[0].FromUserId.Should().BeNull();
        logs[0].FromUserName.Should().BeNull();
        logs[0].ToUserId.Should().Be(daUserId);
        logs[0].ToUserName.Should().Be("First DA");
        logs[0].Reason.Should().Be("Initial assignment");
        logs[0].PerformedByUserId.Should().Be(actorUserId);
    }

    [Fact]
    public async Task AssignDaAsync_Reassignment_LogsFromUserSnapshotAndUpdatesPointer()
    {
        var f = Create();
        var firstDaUserId = await AddUserAsync(f.Db, "First DA");
        var secondDaUserId = await AddUserAsync(f.Db, "Second DA");

        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], firstDaUserId, "Initial");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], secondDaUserId, "First DA on leave");

        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId.Should().Be(secondDaUserId);

        var logs = await f.Db.ProjectDaAssignmentLogs
            .Where(l => l.ProjectId == f.ProjectId).OrderBy(l => l.CreatedAt).ToListAsync();
        logs.Should().HaveCount(2);
        logs[1].FromUserId.Should().Be(firstDaUserId);
        logs[1].FromUserName.Should().Be("First DA");
        logs[1].ToUserId.Should().Be(secondDaUserId);
        logs[1].Reason.Should().Be("First DA on leave");
    }

    [Fact]
    public async Task AssignDaAsync_ActorNotSuperintendentOrDean_Throws()
    {
        var f = Create();
        var daUserId = await AddUserAsync(f.Db, "Some DA");

        var act = () => f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["RegularStaff"], daUserId, "Trying anyway");

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task AssignDaAsync_BlankReason_ThrowsArgumentException()
    {
        var f = Create();
        var daUserId = await AddUserAsync(f.Db, "Some DA");

        var act = () => f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], daUserId, "   ");

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task AssignDaAsync_ProjectNotFound_ThrowsProjectNotFoundException()
    {
        var f = Create();
        var daUserId = await AddUserAsync(f.Db, "Some DA");

        var act = () => f.Service.AssignDaAsync(Guid.NewGuid(), Guid.NewGuid(), ["Dean"], daUserId, "Reason");

        await act.Should().ThrowAsync<ProjectNotFoundException>();
    }

    [Fact]
    public async Task GetDaAssignmentHistoryAsync_OwnerCanRead_NewestFirst()
    {
        var f = Create();
        var firstDaUserId = await AddUserAsync(f.Db, "First DA");
        var secondDaUserId = await AddUserAsync(f.Db, "Second DA");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], firstDaUserId, "Initial");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], secondDaUserId, "Reassigned");

        var history = await f.Service.GetDaAssignmentHistoryAsync(f.ProjectId, f.OwnerUserId, []);

        history.Should().HaveCount(2);
        history[0].ToUserId.Should().Be(secondDaUserId);
        history[1].ToUserId.Should().Be(firstDaUserId);
    }

    [Fact]
    public async Task GetDaAssignmentHistoryAsync_UnrelatedCaller_ThrowsProjectAccessDenied()
    {
        var f = Create();
        var daUserId = await AddUserAsync(f.Db, "Some DA");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], daUserId, "Initial");

        var act = () => f.Service.GetDaAssignmentHistoryAsync(f.ProjectId, Guid.NewGuid(), []);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetDaAssignmentHistoryAsync_MissingProject_ThrowsProjectNotFound()
    {
        var f = Create();

        var act = () => f.Service.GetDaAssignmentHistoryAsync(Guid.NewGuid(), f.OwnerUserId, ["Superintendent"]);

        await act.Should().ThrowAsync<ProjectNotFoundException>();
    }

    // ------------------------------------------------ reassignment migration

    private static async Task<Guid> AddGrantReceiptInstanceAsync(
        TestProcurementDbContext db, Guid projectId, Guid? assignedTo, bool viaProjectDa,
        WorkflowStage stage = WorkflowStage.WithRnCOfficeGrantReceipt)
    {
        var receiptId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        db.GrantReceipts.Add(new GrantReceipt
        {
            Id = receiptId, ProjectId = projectId, BudgetHeadId = Guid.NewGuid(),
            ReceivedDate = ProjectStart, Amount = 1_000m, WorkflowInstanceId = instanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.GrantReceipt, RequestId = receiptId,
            Phase = WorkflowPhase.Indent, CurrentStage = stage,
            AssignedToUserId = assignedTo, IsAssignedViaProjectDa = viaProjectDa,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return instanceId;
    }

    private static async Task<Guid> AddConsumableIndentInstanceAsync(
        TestProcurementDbContext db, Guid projectId, Guid assignedTo)
    {
        var indentId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = indentId, ProjectId = projectId, BudgetHeadId = Guid.NewGuid(), WorkflowInstanceId = instanceId,
            Name = "Reagent", TechnicalSpecs = "AR grade", UnitOfMeasurement = "Bottle", Quantity = 1,
            Purpose = "Experiment", EstimatedCost = 500m, CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.Consumable, RequestId = indentId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.IndentAssignedToDA,
            AssignedToUserId = assignedTo, IsAssignedViaProjectDa = true,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return instanceId;
    }

    private static async Task<Guid> AddFellowshipClaimInstanceAsync(
        TestProcurementDbContext db, Guid projectId, Guid assignedTo)
    {
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var claimId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId, ProjectId = projectId, Designation = "JRF", Positions = 1, Stipend = 37_000m,
        });
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId, CandidateId = Guid.NewGuid(), SanctionedManpowerPositionId = positionId,
            JoinedOn = ProjectStart, ValidTill = ProjectStart.AddYears(1),
            Status = ManpowerSelectionStatus.Active, CreatedAt = DateTimeOffset.UtcNow,
        });
        db.FellowshipClaims.Add(new FellowshipClaim
        {
            Id = claimId, FellowAppointmentId = appointmentId, ClaimYear = 2024, ClaimMonth = 7,
            WorkflowInstanceId = instanceId, CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.FellowshipClaim, RequestId = claimId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithDAFellowship,
            AssignedToUserId = assignedTo, IsAssignedViaProjectDa = true,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return instanceId;
    }

    private static async Task<Guid> AddOtherProjectAsync(TestProcurementDbContext db)
    {
        var id = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = id, OwnerUserId = Guid.NewGuid(), ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DA-SVC-2", SanctionDate = ProjectStart, ProjectTitle = "Other Project",
            StartDate = ProjectStart, Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task AssignDaAsync_Reassignment_MovesOpenDaAssignedInstancesToNewDa()
    {
        var f = Create();
        var oldDa = await AddUserAsync(f.Db, "Old DA");
        var newDa = await AddUserAsync(f.Db, "New DA");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], oldDa, "Initial");

        var receiptInstance = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, oldDa, viaProjectDa: true);
        var indentInstance = await AddConsumableIndentInstanceAsync(f.Db, f.ProjectId, oldDa);
        var claimInstance = await AddFellowshipClaimInstanceAsync(f.Db, f.ProjectId, oldDa);

        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], newDa, "Old DA transferred");

        foreach (var id in new[] { receiptInstance, indentInstance, claimInstance })
        {
            var instance = await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == id);
            instance.AssignedToUserId.Should().Be(newDa);
            instance.IsAssignedViaProjectDa.Should().BeTrue();
        }
    }

    [Fact]
    public async Task AssignDaAsync_Reassignment_DoesNotMoveInstancesNotAssignedToOldDaOrNotDaOriginated()
    {
        var f = Create();
        var oldDa = await AddUserAsync(f.Db, "Old DA");
        var newDa = await AddUserAsync(f.Db, "New DA");
        var someoneElse = Guid.NewGuid();
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], oldDa, "Initial");

        // Assigned to a different person entirely.
        var otherAssignee = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, someoneElse, viaProjectDa: true);
        // Assigned to the old DA, but via a manual Assign action -- not DA-originated.
        var manualToOldDa = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, oldDa, viaProjectDa: false);
        // DA-locked to the same person, but on a DIFFERENT project.
        var otherProject = await AddOtherProjectAsync(f.Db);
        var otherProjectInstance = await AddGrantReceiptInstanceAsync(f.Db, otherProject, oldDa, viaProjectDa: true);

        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], newDa, "Reassigned");

        (await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == otherAssignee))
            .AssignedToUserId.Should().Be(someoneElse);
        (await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == manualToOldDa))
            .AssignedToUserId.Should().Be(oldDa);
        (await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == otherProjectInstance))
            .AssignedToUserId.Should().Be(oldDa);
    }

    [Theory]
    [InlineData(WorkflowStage.Approved)]
    [InlineData(WorkflowStage.Rejected)]
    [InlineData(WorkflowStage.Cancelled)]
    [InlineData(WorkflowStage.IndentApproved)]
    public async Task AssignDaAsync_Reassignment_DoesNotMoveTerminalInstances(WorkflowStage terminal)
    {
        var f = Create();
        var oldDa = await AddUserAsync(f.Db, "Old DA");
        var newDa = await AddUserAsync(f.Db, "New DA");
        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], oldDa, "Initial");
        var completed = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, oldDa, viaProjectDa: true, terminal);

        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Dean"], newDa, "Reassigned");

        (await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == completed))
            .AssignedToUserId.Should().Be(oldDa);
    }

    [Fact]
    public async Task AssignDaAsync_FirstAssignment_DoesNotTouchExistingInstances()
    {
        var f = Create();
        var da = await AddUserAsync(f.Db, "First DA");
        // An open, unassigned instance and an open manually-assigned one on
        // this project, both raised before the project ever had a DA.
        var unassigned = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, null, viaProjectDa: false);
        var manualAssignee = Guid.NewGuid();
        var manual = await AddGrantReceiptInstanceAsync(f.Db, f.ProjectId, manualAssignee, viaProjectDa: false);

        await f.Service.AssignDaAsync(f.ProjectId, Guid.NewGuid(), ["Superintendent"], da, "Initial");

        var u = await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == unassigned);
        u.AssignedToUserId.Should().BeNull();
        u.IsAssignedViaProjectDa.Should().BeFalse();
        var m = await f.Db.WorkflowInstances.AsNoTracking().FirstAsync(w => w.Id == manual);
        m.AssignedToUserId.Should().Be(manualAssignee);
        m.IsAssignedViaProjectDa.Should().BeFalse();
    }
}
