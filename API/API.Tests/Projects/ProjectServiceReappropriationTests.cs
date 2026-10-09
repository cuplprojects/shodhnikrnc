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
/// Re-appropriation must validate against actual Grant Received (net of
/// prior re-appropriations), never against the Sanctioned Budget figure,
/// and must never mutate BudgetHead.Total/Year1Amount -- Sanctioned Budget
/// is the funding agency's fixed, approved figure.
/// </summary>
public class ProjectServiceReappropriationTests
{
    private static readonly Guid DefaultDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static (ProjectService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        // See ProjectServiceUpsertTests.CreateService's identical comment:
        // without this, RecordGrantReceiptAsync's Raise/Forward pair resolves
        // against the fallback shipped office route, not the real grant
        // receipt chain.
        GrantReceiptWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        var service = new ProjectService(
            db, new WorkflowEngineService(db), new ProjectYearCalculator(), new OverheadSplitValidator(),
            new FakeDepartment(DefaultDepartmentId),
            new InstituteWideScopeResolver(db, new FakeDepartment(DefaultDepartmentId)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        return (service, db);
    }

    /// <summary>
    /// Field Charges sanctioned 10K (received 5K); Consumables sanctioned
    /// 10K (received 8K) -- the client's own motivating example.
    /// </summary>
    private static async Task<(Project Project, BudgetHead FieldCharges, BudgetHead Consumables)> CreateSampleProjectAsync(
        ProjectService service, TestProjectsDbContext db, Guid ownerUserId)
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
            1000000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, 10_000m, 0m, 0m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 10_000m, 0m, 0m),
            ],
            [],
            []);

        var fieldCharges = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringFieldCharges);
        var consumables = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringConsumable);

        var fieldChargesReceipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, fieldCharges.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        var consumablesReceipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, consumables.Id, new DateOnly(2024, 6, 15), 8_000m, null, remarks: "Test remark.");

        // RecordGrantReceiptAsync now raises the receipt into its own PI ->
        // HOD -> RnC office -> Dean approval chain (Task 3) and leaves it
        // PendingApproval until that chain completes. This file exercises
        // re-appropriation math, not the approval chain itself, so the two
        // receipts are driven straight to Approved here -- the same effective
        // pre-condition every test below already assumed before Task 5 made
        // BudgetHeadEffectiveReceived (which re-appropriation validates
        // against) filter to Approved only.
        fieldChargesReceipt.Status = GrantReceiptStatus.Approved;
        consumablesReceipt.Status = GrantReceiptStatus.Approved;
        await db.SaveChangesAsync();

        return (project, fieldCharges, consumables);
    }

    private static async Task<Project> LoadProjectFresh(TestProjectsDbContext db, Guid projectId)
    {
        return await db.Projects
            .Include(p => p.BudgetHeads)
            .Include(p => p.GrantReceipts)
            .Include(p => p.BudgetReappropriationLogs)
            .AsNoTracking()
            .SingleAsync(p => p.Id == projectId);
    }

    [Fact]
    public async Task RaiseReappropriationAsync_NeverMutatesSanctionedBudget()
    {
        // Renamed from ReappropriateBudgetAsync_NeverMutatesSanctionedBudget.
        // The old API mutated the budget immediately; the new API
        // (RaiseReappropriationAsync) instead creates a ReappropriationRequest
        // that only takes effect once it clears the approval chain, so
        // Sanctioned Budget is untouched a fortiori. Still worth asserting
        // explicitly since it is exactly the invariant this file guards.
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);
        var fieldChargesSanctionedBefore = fieldCharges.Total;
        var consumablesSanctionedBefore = consumables.Total;

        await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        var reloaded = await LoadProjectFresh(db, project.Id);
        reloaded.BudgetHeads.First(h => h.Id == fieldCharges.Id).Total.Should().Be(fieldChargesSanctionedBefore);
        reloaded.BudgetHeads.First(h => h.Id == consumables.Id).Total.Should().Be(consumablesSanctionedBefore);
    }

    [Fact]
    public async Task RaiseReappropriationAsync_SourceExceedsReceived_Throws()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);

        // Field Charges received only 5_000m -- attempting to move 6_000m out
        // must fail even though 6_000m is well within its 10_000m sanction.
        var act = () => service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 6_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 6_000m)]);

        await act.Should().ThrowAsync<ReappropriationExceedsReceivedException>();
    }

    [Fact]
    public async Task RaiseReappropriationAsync_TargetWouldExceedSanction_Throws()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);

        // Exactly the client's own example: Field Charges sanctioned 10K
        // received 5K; Consumables sanctioned 10K received 8K. Moving 2.5K
        // from Field Charges to Consumables is within Field Charges' received
        // total (2.5K <= 5K) but pushes Consumables to 10.5K > its 10K sanction.
        var act = () => service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 2_500m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 2_500m)]);

        await act.Should().ThrowAsync<ReappropriationExceedsSanctionException>();
    }

    [Fact]
    public async Task RaiseReappropriationAsync_WithinBothCeilings_Succeeds()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);

        // Field Charges received 5K; move 1K to Consumables (received 8K,
        // sanctioned 10K) -- 8K + 1K = 9K <= 10K, fine.
        var request = await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        request.SourceLines.Sum(l => l.Amount).Should().Be(1_000m);
    }

    [Fact]
    public async Task GetReappropriationAsync_DifferentOwnerNoOfficeRole_ThrowsProjectAccessDeniedException()
    {
        // Was a live IDOR: GetReappropriationAsync accepted requestingUserId/
        // requestingUserRoles but never checked them, so any authenticated
        // user could read any project's reappropriation financial detail by
        // guessing requestId. Fixed by reusing GetAsync's owner/RnC-office/
        // HOD/active-fellow gate, the same rule enforced everywhere else
        // project data is read.
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);

        var request = await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        var act = () => service.GetReappropriationAsync(request.Id, otherUserId, []);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetReappropriationAsync_Owner_ReturnsTheRequest()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var (project, fieldCharges, consumables) = await CreateSampleProjectAsync(service, db, ownerUserId);

        var request = await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        var result = await service.GetReappropriationAsync(request.Id, ownerUserId, []);

        result.Should().NotBeNull();
        result!.Id.Should().Be(request.Id);
    }

    [Fact]
    public async Task RaiseReappropriationAsync_SecondTransferSeesFirstOnesEffect()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();

        // Isolated fixture, distinct from the shared client-example one:
        // Consumables here is sanctioned high enough (100K) that the
        // target-side ceiling can never be the thing that blocks the second
        // transfer -- this test exists purely to pin the source-side check
        // against the running effective-received balance, not the target check.
        var project = await service.CreateAsync(
            ownerUserId, ProjectType.TypeIResearch, "SAN-002", new DateOnly(2024, 6, 1),
            "Sample Project 2", new DateOnly(2024, 6, 1), "DST", 36, 1000000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, 10_000m, 0m, 0m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 100_000m, 0m, 0m),
            ],
            [], []);
        var fieldCharges = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringFieldCharges);
        var consumables = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringConsumable);
        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, fieldCharges.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");
        // See CreateSampleProjectAsync's identical comment: driven straight to
        // Approved since this file tests re-appropriation math, not the
        // receipt approval chain.
        receipt.Status = GrantReceiptStatus.Approved;
        await db.SaveChangesAsync();

        // Field Charges received 5K. First transfer moves 3K out (leaves 2K
        // effective). A second transfer attempting to move another 3K out must
        // fail -- it must see the FIRST transfer's adjustment, not just the
        // original GrantReceipt sum.
        //
        // BudgetHeadEffectiveReceived only nets in ReappropriationRequests
        // whose Status is Approved (see BudgetHeadEffectiveReceived.cs) -- a
        // freshly-raised request is PendingApproval and would NOT yet affect
        // the ceiling. Driving the first request's Status to Approved
        // directly here (rather than through the full ApproveReappropriationAsync
        // workflow-engine chain, which needs actor roles/stage setup
        // unrelated to what this test is pinning) mirrors how the sibling
        // fixtures in this file already drive GrantReceiptStatus straight to
        // Approved -- this file tests re-appropriation math, not the
        // approval chain itself.
        var firstRequest = await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "first transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 3_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 3_000m)]);
        firstRequest.Status = ReappropriationRequestStatus.Approved;
        await db.SaveChangesAsync();

        var act = () => service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "second transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 3_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 3_000m)]);

        await act.Should().ThrowAsync<ReappropriationExceedsReceivedException>();
    }

    /// <summary>
    /// Task 5 regression, direct on BudgetHeadEffectiveReceived (the shared
    /// calculation this file's whole re-appropriation ceiling depends on): a
    /// PendingApproval receipt must not count toward "actually received";
    /// only an Approved one may. Exercised here via the source-side
    /// re-appropriation ceiling, since that is this calculation's real
    /// caller and gives an observable pass/fail without reaching into
    /// BudgetHeadEffectiveReceived's internal (non-public) API directly.
    /// </summary>
    [Fact]
    public async Task RaiseReappropriationAsync_SourceReceiptStillPendingApproval_NotCountedAsReceived()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerUserId, ProjectType.TypeIResearch, "SAN-003", new DateOnly(2024, 6, 1),
            "Sample Project 3", new DateOnly(2024, 6, 1), "DST", 36, 1_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, 10_000m, 0m, 0m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 10_000m, 0m, 0m),
            ],
            [], []);
        var fieldCharges = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringFieldCharges);
        var consumables = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringConsumable);

        // RecordGrantReceiptAsync leaves the receipt PendingApproval by
        // default (Task 3) -- left untouched here, unlike the other fixtures
        // in this file, specifically so this receipt stays pending.
        await service.RecordGrantReceiptAsync(
            project.Id, ownerUserId, fieldCharges.Id, new DateOnly(2024, 6, 15), 5_000m, null, remarks: "Test remark.");

        // Field Charges "received" 5K on paper, but it is still
        // PendingApproval, so the effective-received figure the
        // re-appropriation ceiling checks against must read 0 -- any
        // transfer out of it, however small, must fail.
        var act = () => service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        await act.Should().ThrowAsync<ReappropriationExceedsReceivedException>();
    }

    /// <summary>
    /// Whole-branch review finding (Important #1): BudgetHeadEffectiveReceived
    /// must count HistoricalGrantReceipt rows toward "effective received", not
    /// just live Approved GrantReceipt rows -- otherwise a legacy project
    /// backfilled through the Historical Entries feature (only a
    /// HistoricalGrantReceipt against a head, no live GrantReceipt at all)
    /// would have an effective-received figure of 0 and could never move
    /// money OUT of that head via re-appropriation, even though it genuinely
    /// received (and could safely reappropriate) that money.
    /// </summary>
    [Fact]
    public async Task RaiseReappropriationAsync_SourceHasOnlyHistoricalReceipt_Succeeds()
    {
        var (service, db) = CreateService();
        var ownerUserId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerUserId, ProjectType.TypeIResearch, "SAN-HIST-REAPPROP", new DateOnly(2024, 6, 1),
            "Historical Receipt Reappropriation Test", new DateOnly(2024, 6, 1), "DST", 36, 1_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, 10_000m, 0m, 0m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 10_000m, 0m, 0m),
            ],
            [], []);
        var fieldCharges = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringFieldCharges);
        var consumables = project.BudgetHeads.Single(h => h.HeadName == BudgetHeadName.RecurringConsumable);

        // Only a HistoricalGrantReceipt against Field Charges -- no live
        // GrantReceipt at all.
        db.HistoricalGrantReceipts.Add(new HistoricalGrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = fieldCharges.Id,
            Amount = 5_000m,
            ReceivedDate = new DateOnly(2024, 6, 15),
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        // Moving 1K out of Field Charges must succeed -- before the fix, the
        // effective-received figure would be 0 (no live receipts) and this
        // would throw ReappropriationExceedsReceivedException.
        var request = await service.RaiseReappropriationAsync(
            project.Id, ownerUserId, "test transfer",
            [new ReappropriationLineInput(fieldCharges.Id, "RecurringFieldCharges", 1_000m)],
            [new ReappropriationLineInput(consumables.Id, "RecurringConsumable", 1_000m)]);

        request.SourceLines.Sum(l => l.Amount).Should().Be(1_000m);
    }
}
