using API.Application.Access;
using API.Application.Fellowship;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Fellowship;

public class LeaveServiceTests
{
    private static readonly DateOnly Joined = new(2026, 1, 1);
    private static readonly DateOnly ValidTill = new(2027, 12, 31);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        LeaveService Leave,
        WorkflowEngineService Workflow,
        Guid PiUserId,
        Guid FellowUserId,
        Guid AppointmentId);

    private static Fixture Create(bool withIdCard = true)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var piUserId = Guid.NewGuid();
        var fellowUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-L1",
            SanctionDate = Joined,
            ProjectTitle = "Leave Test Project",
            StartDate = Joined,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "JRF",
            Positions = 1,
            Stipend = 37_000m,
            Hra = 7_400m,
        });
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            CandidateId = Guid.NewGuid(),
            ApplicationUserId = fellowUserId,
            SanctionedManpowerPositionId = positionId,
            JoinedOn = Joined,
            ValidTill = ValidTill,
            RecommendedStipend = 37_000m,
            IdCardNumber = withIdCard ? "MNNIT/JRF/001" : null,
            IdCardIssuedAt = withIdCard ? DateTimeOffset.UtcNow : null,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var workflow = new WorkflowEngineService(db);
        var leave = BuildLeaveService(db, workflow);

        return new Fixture(db, leave, workflow, piUserId, fellowUserId, appointmentId);
    }

    /// <summary>
    /// Wires the trailing pending-query/department-scoping constructor
    /// parameters added for the pending-actions dashboard and the
    /// ListRequestsAsync access-gap fix. Tests in this file exercise fellow
    /// self-service behaviour, not the new office-facing scoping, so a
    /// no-department stub is enough here -- ListRequestsAsync's own scoping is
    /// covered separately.
    /// </summary>
    private static LeaveService BuildLeaveService(TestProcurementDbContext db, WorkflowEngineService workflow)
    {
        var userDepartment = new StubUserDepartmentProvider();
        var instituteWideScope = new InstituteWideScopeResolver(db, userDepartment);
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        return new LeaveService(
            db, new FellowContextService(db), workflow, pendingQuery, userDepartment, instituteWideScope);
    }

    private static RaiseLeaveInput Annual(int fromDay, int days, int month = 3) =>
        new(LeaveType.Annual,
            Enumerable.Range(fromDay, days).Select(d => new DateOnly(2026, month, d)).ToList(),
            [],
            "Annual leave.");

    // ------------------------------------------------------------- Gate

    [Fact]
    public async Task RaiseLeave_WithoutIdCard_Throws()
    {
        var f = Create(withIdCard: false);

        var act = () => f.Leave.RaiseLeaveAsync(Annual(1, 3), f.FellowUserId);

        await act.Should().ThrowAsync<IdCardNotIssuedException>();
    }

    // ------------------------------------------------------------- Basics

    [Fact]
    public async Task RaiseLeave_CountsDaysInclusively()
    {
        var f = Create();

        var id = await f.Leave.RaiseLeaveAsync(Annual(1, 3), f.FellowUserId);

        var request = await f.Db.LeaveRequests.FirstAsync(r => r.Id == id);
        // 1st to 3rd inclusive is three days, not two.
        request.DayCount.Should().Be(3);
    }

    [Fact]
    public async Task RaiseLeave_EndBeforeStart_Throws()
    {
        var f = Create();

        var act = () => f.Leave.RaiseLeaveAsync(
            new RaiseLeaveInput(LeaveType.Annual,
                [new DateOnly(2026, 3, 10), new DateOnly(2026, 3, 5)], [], "Annual leave."),
            f.FellowUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseLeave_OutsideTheTenure_Throws()
    {
        var f = Create();

        var act = () => f.Leave.RaiseLeaveAsync(
            new RaiseLeaveInput(LeaveType.Annual,
                [new DateOnly(2025, 12, 1), new DateOnly(2025, 12, 2), new DateOnly(2025, 12, 3)], [], "Annual leave."),
            f.FellowUserId);

        await act.Should().ThrowAsync<LeaveOutsideTenureException>();
    }

    /// <summary>
    /// BRD A6: special leave is for conference participation, so it must say
    /// what for. Purpose is now mandatory for every leave request (Task 5), so
    /// a blank purpose is now caught by that earlier, general guard rather than
    /// by LeaveService's Special-specific check -- the general
    /// WorkflowTransitionException fires first and the type-specific
    /// SpecialLeavePurposeRequiredException branch is unreachable in practice.
    /// This test now asserts the general behaviour.
    /// </summary>
    [Fact]
    public async Task RaiseLeave_SpecialWithoutAPurpose_Throws()
    {
        var f = Create();

        var act = () => f.Leave.RaiseLeaveAsync(
            new RaiseLeaveInput(LeaveType.Special,
                [new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 2), new DateOnly(2026, 3, 3)], [], null),
            f.FellowUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    // ------------------------------------------------------------- Mandatory purpose

    [Fact]
    public async Task RaiseLeaveAsync_WithNullPurpose_Throws()
    {
        var f = Create();
        var input = new RaiseLeaveInput(LeaveType.Annual, [DateOnly.FromDateTime(DateTime.UtcNow)], null, Purpose: null);

        var act = () => f.Leave.RaiseLeaveAsync(input, f.FellowUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RaiseLeaveAsync_WithPurpose_Succeeds()
    {
        var f = Create();
        var input = new RaiseLeaveInput(LeaveType.Annual, [DateOnly.FromDateTime(DateTime.UtcNow)], null, Purpose: "Family function.");

        var leaveId = await f.Leave.RaiseLeaveAsync(input, f.FellowUserId);

        leaveId.Should().NotBeEmpty();
    }

    // ------------------------------------------------------------- Entitlement

    [Fact]
    public async Task RaiseLeave_ExceedingTheAnnualAllowance_Throws()
    {
        var f = Create();

        // 31 days against a 30-day annual allowance.
        var act = () => f.Leave.RaiseLeaveAsync(
            new RaiseLeaveInput(LeaveType.Annual,
                Enumerable.Range(1, 31).Select(d => new DateOnly(2026, 3, d)).ToList(), [], "Annual leave."),
            f.FellowUserId);

        await act.Should().ThrowAsync<InsufficientLeaveBalanceException>();
    }

    /// <summary>
    /// The subtle one: two requests that each fit individually must not together
    /// exceed the allowance. Pending days count toward the balance.
    /// </summary>
    [Fact]
    public async Task RaiseLeave_TwoPendingRequestsTogetherExceedingTheAllowance_Throws()
    {
        var f = Create();
        await f.Leave.RaiseLeaveAsync(Annual(1, 20), f.FellowUserId);

        // 20 + 15 = 35 against a 30-day allowance, though 15 alone would fit.
        // 20 pending leaves 10 remaining, so the message names 10.
        var act = () => f.Leave.RaiseLeaveAsync(Annual(1, 15, month: 5), f.FellowUserId);

        await act.Should().ThrowAsync<InsufficientLeaveBalanceException>()
            .WithMessage("*only 10 remain*");
    }

    [Fact]
    public async Task RaiseLeave_SpecialAndAnnualHaveSeparateAllowances()
    {
        var f = Create();
        await f.Leave.RaiseLeaveAsync(Annual(1, 25), f.FellowUserId);

        // Special has its own 15 days; the annual usage must not consume it.
        var act = () => f.Leave.RaiseLeaveAsync(
            new RaiseLeaveInput(LeaveType.Special,
                Enumerable.Range(1, 10).Select(d => new DateOnly(2026, 6, d)).ToList(), [], "Conference"),
            f.FellowUserId);

        await act.Should().NotThrowAsync();
    }

    // ------------------------------------------------------------- Consumption

    [Fact]
    public async Task Consume_OnlyAfterApproval()
    {
        var f = Create();
        var id = await f.Leave.RaiseLeaveAsync(Annual(1, 5), f.FellowUserId);

        var act = () => f.Leave.ConsumeOnApprovalAsync(id);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not approved*");
    }

    [Fact]
    public async Task Consume_AfterApproval_AdvancesTheBalance()
    {
        var f = Create();
        var id = await f.Leave.RaiseLeaveAsync(Annual(1, 5), f.FellowUserId);
        var request = await f.Db.LeaveRequests.FirstAsync(r => r.Id == id);
        await DriveToApprovedAsync(f, request.WorkflowInstanceId);

        await f.Leave.ConsumeOnApprovalAsync(id);

        var entitlement = await f.Db.LeaveEntitlements
            .FirstAsync(e => e.FellowAppointmentId == f.AppointmentId
                          && e.LeaveType == LeaveType.Annual);
        entitlement.ConsumedDays.Should().Be(5);
    }

    /// <summary>A rejected request must free its days back up.</summary>
    [Fact]
    public async Task RejectedLeave_DoesNotConsumeAndFreesItsPendingDays()
    {
        var f = Create();
        var id = await f.Leave.RaiseLeaveAsync(Annual(1, 20), f.FellowUserId);
        var request = await f.Db.LeaveRequests.FirstAsync(r => r.Id == id);

        // Rejection is only legal at the end of the escalation chain, so the
        // request has to travel there first.
        await f.Workflow.UploadSignedCopyAsync(request.WorkflowInstanceId, f.PiUserId, Raiser, null);
        await f.Workflow.AssignAsync(request.WorkflowInstanceId, f.PiUserId, f.PiUserId, Hod, null);
        await f.Workflow.ForwardAsync(request.WorkflowInstanceId, f.PiUserId, Office, null);
        await f.Workflow.ForwardAsync(request.WorkflowInstanceId, f.PiUserId, Office, null);
        await f.Workflow.ForwardAsync(request.WorkflowInstanceId, f.PiUserId, Office, null);
        await f.Workflow.RejectAsync(request.WorkflowInstanceId, f.PiUserId, Dean, "No");

        var balance = (await f.Leave.GetBalanceAsync(f.FellowUserId))
            .Single(b => b.LeaveType == LeaveType.Annual);

        balance.ConsumedDays.Should().Be(0);
        balance.PendingDays.Should().Be(0, "a rejected request no longer holds days");
        balance.RemainingDays.Should().Be(30);
    }

    // ------------------------------------------------------------- Cancellation

    [Fact]
    public async Task RaiseCancellationAsync_WithBlankReason_Throws()
    {
        var f = Create();
        var id = await f.Leave.RaiseLeaveAsync(Annual(1, 5), f.FellowUserId);
        var request = await f.Db.LeaveRequests.FirstAsync(r => r.Id == id);
        await DriveToApprovedAsync(f, request.WorkflowInstanceId);

        var act = () => f.Leave.RaiseCancellationAsync(
            id, [new DateOnly(2026, 3, 1)], "", f.FellowUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    // ------------------------------------------------------------- Balance

    [Fact]
    public async Task GetBalance_ShowsPendingSeparatelyFromConsumed()
    {
        var f = Create();
        await f.Leave.RaiseLeaveAsync(Annual(1, 7), f.FellowUserId);

        var balance = (await f.Leave.GetBalanceAsync(f.FellowUserId))
            .Single(b => b.LeaveType == LeaveType.Annual);

        balance.EntitledDays.Should().Be(30);
        balance.ConsumedDays.Should().Be(0);
        balance.PendingDays.Should().Be(7);
        balance.RemainingDays.Should().Be(23);
    }

    /// <summary>
    /// Found by running the app: a fellow whose appointment starts in the future
    /// should see their year-1 allowance, not an error. TenureYear rejects dates
    /// before JoinedOn, and the balance is computed from today.
    /// </summary>
    [Fact]
    public async Task GetBalance_BeforeTheAppointmentStarts_ShowsYearOne()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var fellowUserId = Guid.NewGuid();
        var futureJoin = DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(2);

        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            ApplicationUserId = fellowUserId,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            JoinedOn = futureJoin,
            ValidTill = futureJoin.AddYears(1),
            RecommendedStipend = 37_000m,
            IdCardNumber = "MNNIT/JRF/002",
            IdCardIssuedAt = DateTimeOffset.UtcNow,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var leave = BuildLeaveService(db, new WorkflowEngineService(db));

        var balance = await leave.GetBalanceAsync(fellowUserId);

        balance.Should().HaveCount(2);
        balance.Single(b => b.LeaveType == LeaveType.Annual).RemainingDays.Should().Be(30);
        balance.Single(b => b.LeaveType == LeaveType.Annual).ProjectYear.Should().Be(1);
    }

    [Fact]
    public async Task GetBalance_ForANonFellow_IsEmpty()
    {
        var f = Create();

        (await f.Leave.GetBalanceAsync(Guid.NewGuid())).Should().BeEmpty();
    }

    [Fact]
    public async Task ListOwnRequests_ReturnsOnlyTheCallersRequests()
    {
        var f = Create();
        await f.Leave.RaiseLeaveAsync(Annual(1, 3), f.FellowUserId);

        (await f.Leave.ListOwnRequestsAsync(Guid.NewGuid())).Should().BeEmpty();
    }

    private static async Task DriveToApprovedAsync(Fixture f, Guid workflowInstanceId)
    {
        var actor = f.PiUserId;
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);
        await f.Workflow.AssignAsync(workflowInstanceId, actor, actor, Hod, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ApproveAsync(workflowInstanceId, actor, Dean, null);
    }
}
