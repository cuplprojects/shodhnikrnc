using API.Application.Fellowship;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// Covers <see cref="IFellowshipService.BulkActOnClaimsAsync"/>, which mirrors
/// <c>ProjectService.BulkActOnGrantReceiptsAsync</c>'s "loop + delegate +
/// all-or-nothing transaction" shape for fellowship claims.
/// </summary>
public partial class FellowshipServiceTests
{
    /// <summary>
    /// Raises a claim normally, then jumps its workflow instance directly to
    /// <paramref name="stage"/>, optionally recording a DA assignment. This
    /// is test-only scaffolding -- it bypasses the real approval chain the
    /// way a human legitimately moving a claim through PI/HOD/DA stages never
    /// would -- but BulkActOnClaimsAsync's own contract only cares about the
    /// state an instance is already in when the bulk action fires.
    /// </summary>
    private static async Task<Guid> RaiseClaimAtStageAsync(
        Fixture f, WorkflowStage stage,
        Guid? assignedToUserId = null, bool isAssignedViaProjectDa = false, int month = 3)
    {
        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(month), f.FellowUserId);
        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == claim.WorkflowInstanceId);
        instance.CurrentStage = stage;
        if (assignedToUserId is { } assignee)
        {
            instance.AssignedToUserId = assignee;
            instance.IsAssignedViaProjectDa = isAssignedViaProjectDa;
        }
        await f.Db.SaveChangesAsync();
        return claimId;
    }

    [Fact]
    public async Task BulkApprove_AdvancesEveryClaimOneStage()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();

        var claimId1 = await RaiseClaimAtStageAsync(f, WorkflowStage.WithDAFellowship, daUserId, true, month: 3);
        var claimId2 = await RaiseClaimAtStageAsync(f, WorkflowStage.WithDAFellowship, daUserId, true, month: 4);
        var claimIds = new[] { claimId1, claimId2 };

        await f.Fellowship.BulkActOnClaimsAsync(
            claimIds, FellowshipClaimBulkAction.Approve,
            daUserId, ["RegularStaff"], "bulk approved", default);

        foreach (var claimId in claimIds)
        {
            var claim = await f.Db.FellowshipClaims.FindAsync(claimId);
            var instance = await f.Db.WorkflowInstances.FindAsync(claim!.WorkflowInstanceId);
            instance!.CurrentStage.Should().Be(WorkflowStage.WithSuperintendentFellowship);
        }
    }

    /// <summary>
    /// This does NOT assert that the first claim's already-committed Approve
    /// is rolled back: EF Core's in-memory provider (used by this whole test
    /// suite) does not support transactions at all --
    /// <c>Database.BeginTransactionAsync</c> throws on it -- so
    /// <see cref="FellowshipService.BulkActOnClaimsAsync"/> only opens a real
    /// transaction when <c>Database.IsRelational()</c> is true (true in
    /// production against MySQL, false here). This matches
    /// GrantReceiptWorkflowTests'
    /// BulkActOnGrantReceiptsAsync_WhenOneReceiptFails_ThePropagatedFailureIsNotSwallowed,
    /// which documents the identical limitation for the sibling feature this
    /// task mirrors. Proving the actual rollback would need a relational test
    /// double this suite does not have; what this test CAN prove -- and does
    /// -- is that the exception genuinely reaches the caller rather than
    /// being caught and hidden, which is the all-or-nothing guarantee as far
    /// as the caller can observe it.
    /// </summary>
    [Fact]
    public async Task BulkApprove_OneClaimAtWrongStage_PropagatesTheFailureRatherThanSwallowingIt()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();

        // claimId0 at WithDAFellowship (valid for this DA actor),
        // claimId1 at WithHODFellowship (not reachable by a DA action -- HOD
        // role required there, so this actor's RegularStaff role is refused).
        var claimId0 = await RaiseClaimAtStageAsync(f, WorkflowStage.WithDAFellowship, daUserId, true, month: 3);
        var claimId1 = await RaiseClaimAtStageAsync(f, WorkflowStage.WithHODFellowship, month: 4);
        var claimIds = new[] { claimId0, claimId1 };

        var act = () => f.Fellowship.BulkActOnClaimsAsync(
            claimIds, FellowshipClaimBulkAction.Approve,
            daUserId, ["RegularStaff"], "bulk approved", default);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task BulkApprove_ClaimAssignedToDifferentDa_Throws()
    {
        var f = Create();
        var assignedDaUserId = Guid.NewGuid();
        var otherDaUserId = Guid.NewGuid();

        var claimId = await RaiseClaimAtStageAsync(
            f, WorkflowStage.WithDAFellowship, assignedDaUserId, true, month: 3);
        var claimIds = new[] { claimId };

        await Assert.ThrowsAnyAsync<Exception>(() =>
            f.Fellowship.BulkActOnClaimsAsync(
                claimIds, FellowshipClaimBulkAction.Approve,
                otherDaUserId, ["RegularStaff"], null, default));
    }

    [Fact]
    public async Task BulkAction_EmptyClaimIdList_Throws()
    {
        var f = Create();
        var actorUserId = Guid.NewGuid();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            f.Fellowship.BulkActOnClaimsAsync(
                [], FellowshipClaimBulkAction.Approve, actorUserId, ["RegularStaff"], null, default));
    }

    /// <summary>
    /// The frontend's bulk-select queue (FellowshipBulkQueuePage, via
    /// FellowshipApprovalPage.jsx's loadData) must show a DA only the claims
    /// actually assigned to them -- the same IsAssignedViaProjectDa /
    /// AssignedToUserId narrowing BulkActOnClaimsAsync itself enforces --
    /// so "select all" never includes a claim the bulk action would then
    /// reject and roll back the whole batch over. This exercises
    /// ListPendingClaimsForCallerAsync, the service method the new
    /// pending-for-caller endpoint (Task 9 fix) is backed by.
    /// </summary>
    [Fact]
    public async Task ListPendingClaimsForCaller_DaOnlySeesClaimsAssignedToThem()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();
        var otherDaUserId = Guid.NewGuid();

        var ownClaimId = await RaiseClaimAtStageAsync(f, WorkflowStage.WithDAFellowship, daUserId, true, month: 3);
        var otherDaClaimId = await RaiseClaimAtStageAsync(f, WorkflowStage.WithDAFellowship, otherDaUserId, true, month: 4);

        var visible = await f.Fellowship.ListPendingClaimsForCallerAsync(daUserId, ["RegularStaff"]);

        visible.Should().ContainSingle(c => c.Id == ownClaimId);
        visible.Should().NotContain(c => c.Id == otherDaClaimId);
    }

    [Fact]
    public async Task ListPendingClaimsForCaller_SuperintendentSeesInstituteWideOfficeStageClaims()
    {
        var f = Create();
        var superintendentUserId = Guid.NewGuid();

        var claimId = await RaiseClaimAtStageAsync(f, WorkflowStage.WithSuperintendentFellowship, month: 3);

        var visible = await f.Fellowship.ListPendingClaimsForCallerAsync(
            superintendentUserId, ["Superintendent"]);

        visible.Should().ContainSingle(c => c.Id == claimId);
    }
}
