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
/// Task 3: RecordGrantReceiptAsync now raises and auto-forwards a grant
/// receipt approval workflow instance instead of leaving the row as final,
/// and Forward/Approve/Reject/Return drive it the rest of the way. Only a
/// receipt whose Status is Approved counts toward the sum-ceiling checks --
/// both the one inside RecordGrantReceiptAsync and the one re-run at the
/// Dean's final approval.
/// </summary>
public class GrantReceiptWorkflowTests
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
            "SAN-001",
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
    private static readonly string[] DeanRole = ["Dean"];
    private static readonly string[] FacultyRole = ["Faculty"];

    [Fact]
    public async Task RecordGrantReceiptAsync_WithNullRemarks_Throws()
    {
        var (service, _, _) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 1_000m, overheadSplit: null, remarks: null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_WithRemarks_Succeeds()
    {
        var (service, _, _) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 1_000m, overheadSplit: null, remarks: "First tranche received.");

        receipt.Should().NotBeNull();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_RaisesWorkflowAndForwardsToHOD()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Received first tranche.");

        receipt.WorkflowInstanceId.Should().NotBeNull();
        receipt.Status.Should().Be(GrantReceiptStatus.PendingApproval);

        var instance = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instance.Should().NotBeNull();
        instance!.CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_DoesNotCountTowardTheSumUntilApproved()
    {
        var (service, db, _) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        // Sanctioned 10K for Year 1. Two receipts of 6K each individually fit,
        // but together (12K) would exceed the sanction if BOTH counted.
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 10_000m);

        await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 6_000m, null, remarks: "Test remark.");

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 15), 6_000m, null, remarks: "Test remark.");

        // The first is still PendingApproval, so it is excluded from the sum
        // -- the second call must succeed, not throw.
        await act.Should().NotThrowAsync();
    }

    /// <summary>
    /// Whole-branch review finding (Important #3, ruled fix-it): "a project
    /// cannot receive more against a head-year than was sanctioned for it,
    /// regardless of which path recorded the money." RecordGrantReceiptAsync's
    /// ceiling check must count HistoricalGrantReceipt rows for the same
    /// head/year too, mirroring what HistoricalEntryService.RecordGrantReceiptAsync's
    /// own ceiling check already does in the other direction.
    /// </summary>
    [Fact]
    public async Task RecordGrantReceiptAsync_HistoricalReceiptAlreadyAtSanction_ThrowsOnAnyLiveAmount()
    {
        var (service, db, _) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 10_000m);

        // A HistoricalGrantReceipt already accounts for the full 10K
        // sanctioned for Year 1.
        db.HistoricalGrantReceipts.Add(new HistoricalGrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = head.Id,
            Amount = 10_000m,
            ReceivedDate = new DateOnly(2024, 6, 15),
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 1), 1m, null, remarks: "Test remark.");

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    /// <summary>Drives a freshly-raised receipt from WithHOD through to the
    /// Dean's stage, using a fresh receipt/db read each hop -- mirrors how a
    /// real caller would reload between requests, and avoids relying on
    /// stale in-memory entity state across service calls.</summary>
    private static async Task<GrantReceipt> ForwardToRnCAsync(
        ProjectService service, TestProjectsDbContext db, Guid receiptId, Guid ownerUserId)
    {
        // HOD forwards WithHODGrantReceipt -> AssignedToDAGrantReceipt. Name
        // kept from the pre-chain-expansion shape (rename would touch every
        // call site above for no behavior change); the stage it actually
        // lands on is now the DA stage, not the old combined RnC-office one.
        await service.ForwardGrantReceiptAsync(receiptId, Guid.NewGuid(), HodRole, "HOD ok", default);
        return await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
    }

    private static async Task<GrantReceipt> ForwardToDeanAsync(
        ProjectService service, TestProjectsDbContext db, Guid receiptId)
    {
        // DA -> Superintendent -> DeputyRegistrar -> WithDeanGrantReceipt.
        // RnCRole ("RegularStaff") is still the DA stage's own role.
        await service.ForwardGrantReceiptAsync(receiptId, Guid.NewGuid(), RnCRole, "DA ok", default);
        await service.ForwardGrantReceiptAsync(receiptId, Guid.NewGuid(), ["Superintendent"], "Superintendent ok", default);
        await service.ForwardGrantReceiptAsync(receiptId, Guid.NewGuid(), ["DeputyRegistrar"], "DeputyRegistrar ok", default);
        return await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
    }

    [Fact]
    public async Task ApproveGrantReceiptAsync_AtWithDean_FlipsStatusToApproved()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        await ForwardToRnCAsync(service, db, receipt.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, receipt.Id);

        await service.ApproveGrantReceiptAsync(receipt.Id, Guid.NewGuid(), DeanRole, "Dean approves", default);

        var reloaded = await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receipt.Id);
        reloaded.Status.Should().Be(GrantReceiptStatus.Approved);

        var instance = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task ApproveGrantReceiptAsync_WhenSumWouldNowExceedSanction_ThrowsAndLeavesStatusUnchanged()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        // Sanctioned 10K. Two receipts of 6K each fit individually, but not
        // combined (12K > 10K).
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 10_000m);

        var first = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 6_000m, null, remarks: "Test remark.");
        var second = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 15), 6_000m, null, remarks: "Test remark.");

        // Fully approve the first: it now counts as Approved.
        await ForwardToRnCAsync(service, db, first.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, first.Id);
        await service.ApproveGrantReceiptAsync(first.Id, Guid.NewGuid(), DeanRole, "Dean approves", default);

        // Advance the second up to WithDeanGrantReceipt too.
        await ForwardToRnCAsync(service, db, second.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, second.Id);

        var instanceBefore = await workflow.GetAsync(second.WorkflowInstanceId!.Value);
        instanceBefore!.CurrentStage.Should().Be(WorkflowStage.WithDeanGrantReceipt);

        var act = () => service.ApproveGrantReceiptAsync(second.Id, Guid.NewGuid(), DeanRole, "Dean approves", default);

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();

        // Status must still be PendingApproval: the throw happens BEFORE
        // workflowEngine.ApproveAsync is called, not after -- so the
        // workflow instance itself is also left unadvanced, not just the
        // Status field.
        var reloadedSecond = await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == second.Id);
        reloadedSecond.Status.Should().Be(GrantReceiptStatus.PendingApproval);

        var instanceAfter = await workflow.GetAsync(second.WorkflowInstanceId!.Value);
        instanceAfter!.CurrentStage.Should().Be(WorkflowStage.WithDeanGrantReceipt);
    }

    [Fact]
    public async Task RejectGrantReceiptAsync_AtWithRnCOffice_NeverCountsTowardTheSum()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 10_000m);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 6_000m, null, remarks: "Test remark.");

        // Advance to WithRnCOfficeGrantReceipt, then reject.
        await service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await service.RejectGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "Not valid", default);

        var reloaded = await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receipt.Id);
        reloaded.Status.Should().Be(GrantReceiptStatus.Rejected);

        var instance = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instance!.CurrentStage.Should().Be(WorkflowStage.Rejected);

        // A second receipt for the full sanctioned amount must now succeed --
        // the rejected 6K never counts.
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 15), 10_000m, null, remarks: "Test remark.");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ReturnGrantReceiptAsync_AtWithRnCOffice_SendsBackToPI_ThenResubmitReForwards()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        await service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);

        // RnC office returns instead of forwarding.
        await service.ReturnGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "Fix the reference", default);

        var instanceAfterReturn = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instanceAfterReturn!.CurrentStage.Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);

        var reloaded = await db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receipt.Id);
        reloaded.Status.Should().Be(GrantReceiptStatus.PendingApproval);

        // The PI's resubmit action is ForwardGrantReceiptAsync itself -- a
        // thin wrapper with no stage-specific branching -- and it must
        // re-forward from ReturnedToPIGrantReceipt (via ForwardOverrideSequence)
        // back to WithHODGrantReceipt, not fail or skip ahead.
        await service.ForwardGrantReceiptAsync(receipt.Id, ownerUserId, FacultyRole, "Fixed, resubmitting", default);

        var instanceAfterResubmit = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instanceAfterResubmit!.CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    /// <summary>
    /// Final whole-branch review finding 1: Draft and ReturnedToPIGrantReceipt
    /// both carry empty AllowedRoles in GrantReceiptWorkflowSeeder.Route, so the
    /// engine's own role check (WorkflowEngineService.RequireRoleAsync) is a
    /// no-op at these two stages -- ownership is the only thing that should
    /// restrict forwarding there to the owning PI. Before this fix, any
    /// authenticated Faculty account could forward (resubmit) another PI's
    /// returned, uncorrected receipt straight back into the HOD's queue.
    /// </summary>
    [Fact]
    public async Task ForwardGrantReceiptAsync_AtReturnedToPI_ByNonOwner_ThrowsProjectAccessDenied()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        await service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await service.ReturnGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "Fix the reference", default);

        var instanceAfterReturn = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instanceAfterReturn!.CurrentStage.Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);

        // A different Faculty account -- not the owning PI -- attempts to
        // forward (resubmit) the receipt out of ReturnedToPIGrantReceipt.
        var strangerUserId = Guid.NewGuid();
        var act = () => service.ForwardGrantReceiptAsync(
            receipt.Id, strangerUserId, FacultyRole, "Not mine, but I'll forward it anyway", default);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();

        // The workflow instance must be left unadvanced by the refused attempt.
        var instanceAfterDenial = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instanceAfterDenial!.CurrentStage.Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);
    }

    /// <summary>
    /// The positive counterpart to the test above: the ownership gate must not
    /// be so broad that it blocks the legitimate owner's own resubmit -- an
    /// overly strict check would silently break the real Return -> PI-fixes
    /// -> resubmit flow this whole route exists to support.
    /// </summary>
    [Fact]
    public async Task ForwardGrantReceiptAsync_AtReturnedToPI_ByOwner_Succeeds()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        await service.ForwardGrantReceiptAsync(receipt.Id, Guid.NewGuid(), HodRole, "HOD ok", default);
        await service.ReturnGrantReceiptAsync(receipt.Id, Guid.NewGuid(), RnCRole, "Fix the reference", default);

        var act = () => service.ForwardGrantReceiptAsync(
            receipt.Id, ownerUserId, FacultyRole, "Fixed, resubmitting", default);

        await act.Should().NotThrowAsync();

        var instanceAfterResubmit = await workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        instanceAfterResubmit!.CurrentStage.Should().Be(WorkflowStage.WithHODGrantReceipt);
    }

    [Fact]
    public async Task BulkActOnGrantReceiptsAsync_Forward_AdvancesEveryListedReceipt()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 100_000m);

        var first = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        var second = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 15), 5_000m, null, remarks: "Test remark.");

        await service.BulkActOnGrantReceiptsAsync(
            [first.Id, second.Id], GrantReceiptBulkAction.Forward, Guid.NewGuid(), HodRole, "HOD batch forward", default);

        var firstInstance = await workflow.GetAsync(first.WorkflowInstanceId!.Value);
        var secondInstance = await workflow.GetAsync(second.WorkflowInstanceId!.Value);

        firstInstance!.CurrentStage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);
        secondInstance!.CurrentStage.Should().Be(WorkflowStage.AssignedToDAGrantReceipt);
    }

    /// <summary>
    /// All-or-nothing: when one receipt in the batch cannot legally advance
    /// (here, approving it would exceed the budget head's sanction -- the same
    /// business rule ApproveGrantReceiptAsync_WhenSumWouldNowExceedSanction_...
    /// exercises above), the failure must propagate to the caller rather than
    /// being swallowed or reported as a partial success -- the UI relies on
    /// this to know the batch did not fully apply.
    /// </summary>
    /// <remarks>
    /// This does NOT assert that the first receipt's already-committed Approve
    /// is rolled back: EF Core's in-memory provider (used by this whole test
    /// suite) does not support transactions at all --
    /// <c>Database.BeginTransactionAsync</c> throws on it -- so
    /// <see cref="ProjectService.BulkActOnGrantReceiptsAsync"/> only opens a
    /// real transaction when <c>Database.IsRelational()</c> is true (true in
    /// production against MySQL, false here). Proving the actual rollback
    /// would need a relational test double this suite does not have; what
    /// this test CAN prove -- and does -- is that the exception genuinely
    /// reaches the caller rather than being caught and hidden.
    /// </remarks>
    [Fact]
    public async Task BulkActOnGrantReceiptsAsync_WhenOneReceiptFails_ThePropagatedFailureIsNotSwallowed()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        // Sanctioned 10K. Two receipts of 6K each fit individually, but not
        // combined (12K > 10K) -- approving both in one batch must fail.
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId, sanctionedYear1: 10_000m);

        var first = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 6_000m, null, remarks: "Test remark.");
        var second = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 7, 15), 6_000m, null, remarks: "Test remark.");

        await ForwardToRnCAsync(service, db, first.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, first.Id);
        await ForwardToRnCAsync(service, db, second.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, second.Id);

        var act = () => service.BulkActOnGrantReceiptsAsync(
            [first.Id, second.Id], GrantReceiptBulkAction.Approve, Guid.NewGuid(), DeanRole, "Dean batch approve", default);

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    /// <summary>
    /// Live production hit exactly this: ApproveGrantReceiptAsync's sanction
    /// re-check looked up the receipt's stored BudgetHeadId with a raw
    /// .First(), which threw an unhandled InvalidOperationException
    /// ("Sequence contains no matching element") the moment a receipt's
    /// BudgetHeadId no longer matched any of the project's current budget
    /// heads (e.g. the project's budget heads were edited/recreated after
    /// the receipt was recorded, leaving the receipt's reference stale).
    /// The fix must surface this as the typed
    /// GrantReceiptBudgetHeadNotFoundException instead, not a 500.
    /// </summary>
    [Fact]
    public async Task ApproveGrantReceiptAsync_WhenReceiptsBudgetHeadNoLongerExistsOnTheProject_ThrowsTypedException()
    {
        var (service, db, workflow) = await CreateServiceAsync();
        var ownerUserId = Guid.NewGuid();
        var (project, head) = await CreateSampleProjectAsync(service, ownerUserId);

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, head.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        await ForwardToRnCAsync(service, db, receipt.Id, ownerUserId);
        await ForwardToDeanAsync(service, db, receipt.Id);

        // Simulate the stale reference: the receipt's BudgetHeadId no longer
        // matches any budget head on the project.
        var entity = await db.GrantReceipts.SingleAsync(g => g.Id == receipt.Id);
        entity.BudgetHeadId = Guid.NewGuid();
        await db.SaveChangesAsync();

        var act = () => service.ApproveGrantReceiptAsync(receipt.Id, Guid.NewGuid(), DeanRole, "Dean approves", default);

        await act.Should().ThrowAsync<GrantReceiptBudgetHeadNotFoundException>();
    }
}
