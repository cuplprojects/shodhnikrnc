using API.Application.Fellowship;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// Covers <see cref="IFellowshipService.CreateVoucherFromClaimsAsync"/>: one
/// PaymentVoucher per call, one item and one Expenditure row per claim, each
/// charged against that claim's OWN project's RecurringManpower head.
/// </summary>
public class FellowshipVoucherCreationTests
{
    private static CreateFellowshipVoucherInput Input(string? fundingAgency = null) =>
        new("R&C Office", "SANC/001", "Bank Transfer", fundingAgency);

    [Fact]
    public async Task CreateVoucherFromClaims_TwoClaimsDifferentProjects_RecordsExpenditurePerProject()
    {
        // FellowshipClaim (the entity) has no ProjectId of its own -- the
        // helper returns each claim's project id separately, exactly as
        // CreateVoucherFromClaimsAsync itself must resolve it
        // (appointment -> position -> project).
        var (service, db, claim1, project1Id, claim2, project2Id) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(
                claim1Amount: 10000m, claim2Amount: 15000m);

        var voucherId = await service.CreateVoucherFromClaimsAsync(
            [claim1.Id, claim2.Id], Input("DST"), actorUserId: Guid.NewGuid(), default);

        var voucher = await db.PaymentVouchers.Include(v => v.Items)
            .FirstAsync(v => v.Id == voucherId);
        Assert.Equal(2, voucher.Items.Count);
        Assert.Null(voucher.ProjectId);
        Assert.Equal(25000m, voucher.Amount);
        Assert.Equal(25000m, voucher.PayableAmount);
        Assert.Equal("R&C Office", voucher.CoordinatorNameDept);
        Assert.Equal("DST", voucher.FundingAgency);

        var expenditures = await db.Expenditure
            .Where(e => e.SectionType!.Contains(voucher.VoucherNo))
            .ToListAsync();
        Assert.Equal(2, expenditures.Count);
        Assert.Contains(expenditures, e => e.ProjectId == project1Id && e.Amount == 10000m);
        Assert.Contains(expenditures, e => e.ProjectId == project2Id && e.Amount == 15000m);

        var updatedClaim1 = await db.FellowshipClaims.FindAsync(claim1.Id);
        Assert.NotNull(updatedClaim1!.PaymentVoucherItemId);
    }

    [Fact]
    public async Task CreateVoucherFromClaims_ChargesEachClaimToItsOwnProjectsManpowerHead()
    {
        var (service, db, claim1, project1Id, claim2, project2Id) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(10000m, 15000m);
        var head1 = await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, project1Id);
        var head2 = await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, project2Id);

        var voucherId = await service.CreateVoucherFromClaimsAsync(
            [claim1.Id, claim2.Id], Input(), Guid.NewGuid(), default);

        var voucher = await db.PaymentVouchers.Include(v => v.Items).FirstAsync(v => v.Id == voucherId);
        var item1 = voucher.Items.Single(i => i.FellowshipClaimId == claim1.Id);
        var item2 = voucher.Items.Single(i => i.FellowshipClaimId == claim2.Id);

        Assert.Equal(head1, item1.BudgetHeadId);
        Assert.Equal(10000m, item1.BillAmount);
        Assert.Equal(100_000m, item1.CurrentHeadBalance);
        Assert.Equal(90_000m, item1.BalanceAfterPayment);
        Assert.Equal(head2, item2.BudgetHeadId);
        Assert.Equal(15000m, item2.BillAmount);

        // Both directions of the claim <-> item link.
        Assert.Equal(item1.Id, (await db.FellowshipClaims.FindAsync(claim1.Id))!.PaymentVoucherItemId);
        Assert.Equal(item2.Id, (await db.FellowshipClaims.FindAsync(claim2.Id))!.PaymentVoucherItemId);

        var expenditures = await db.Expenditure.ToListAsync();
        Assert.Contains(expenditures, e => e.ProjectId == project1Id && e.BudgetHeadId == head1 && e.Amount == 10000m);
        Assert.Contains(expenditures, e => e.ProjectId == project2Id && e.BudgetHeadId == head2 && e.Amount == 15000m);
    }

    [Fact]
    public async Task CreateVoucherFromClaims_RecommendedAmountLowerThanTotal_PaysAndChargesRecommended()
    {
        // The PI's RecommendedAmount is the approver's decision after any
        // leave/absence deduction; TotalAmount is never reduced by it. Paying
        // TotalAmount here would overpay by the deduction.
        var (service, db, claim1, project1Id, claim2, project2Id) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(10000m, 15000m);
        claim1.RecommendedAmount = 7000m;
        await db.SaveChangesAsync();
        var head1 = await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, project1Id);

        var voucherId = await service.CreateVoucherFromClaimsAsync(
            [claim1.Id, claim2.Id], Input(), Guid.NewGuid(), default);

        var voucher = await db.PaymentVouchers.Include(v => v.Items).FirstAsync(v => v.Id == voucherId);
        var item1 = voucher.Items.Single(i => i.FellowshipClaimId == claim1.Id);
        Assert.Equal(7000m, item1.BillAmount);
        Assert.Equal(93_000m, item1.BalanceAfterPayment);
        // claim2 has no RecommendedAmount, so it falls back to TotalAmount.
        Assert.Equal(15000m, voucher.Items.Single(i => i.FellowshipClaimId == claim2.Id).BillAmount);

        Assert.Equal(22000m, voucher.Amount);
        Assert.Equal(22000m, voucher.TaxableAmount);
        Assert.Equal(22000m, voucher.PayableAmount);
        Assert.Equal(22000m, voucher.PayRs);

        var expenditures = await db.Expenditure.ToListAsync();
        Assert.Contains(expenditures, e => e.ProjectId == project1Id && e.BudgetHeadId == head1 && e.Amount == 7000m);
        Assert.Contains(expenditures, e => e.ProjectId == project2Id && e.Amount == 15000m);
        Assert.Equal(22000m, expenditures.Sum(e => e.Amount));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_BalanceCheckUsesRecommendedAmount()
    {
        // TotalAmount 12000 exceeds the 10000 balance, but the PI recommended
        // 8000, which fits -- the check must be against what is actually paid.
        var (service, db, claim, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 12000m, manpowerHeadAvailable: 10000m);
        claim.RecommendedAmount = 8000m;
        await db.SaveChangesAsync();

        await service.CreateVoucherFromClaimsAsync([claim.Id], Input(), Guid.NewGuid(), default);

        Assert.Equal(8000m, await db.Expenditure.Where(e => e.ProjectId == projectId).SumAsync(e => e.Amount));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_AlreadyVouchered_Throws()
    {
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        claim1.PaymentVoucherItemId = Guid.NewGuid();
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ClaimAlreadyVoucheredException>(() =>
            service.CreateVoucherFromClaimsAsync([claim1.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_SameClaimTwice_SecondVoucherIsRefused()
    {
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);

        await service.CreateVoucherFromClaimsAsync([claim1.Id], Input(), Guid.NewGuid(), default);

        await Assert.ThrowsAsync<ClaimAlreadyVoucheredException>(() =>
            service.CreateVoucherFromClaimsAsync([claim1.Id], Input(), Guid.NewGuid(), default));

        Assert.Equal(1, await db.PaymentVouchers.CountAsync());
        Assert.Equal(1, await db.Expenditure.CountAsync());
    }

    [Fact]
    public async Task CreateVoucherFromClaims_DuplicateIdInOneRequest_ChargesOnce()
    {
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);

        var voucherId = await service.CreateVoucherFromClaimsAsync(
            [claim1.Id, claim1.Id], Input(), Guid.NewGuid(), default);

        var voucher = await db.PaymentVouchers.Include(v => v.Items).FirstAsync(v => v.Id == voucherId);
        Assert.Single(voucher.Items);
        Assert.Equal(1000m, voucher.Amount);
        Assert.Equal(1, await db.Expenditure.CountAsync());
    }

    [Fact]
    public async Task CreateVoucherFromClaims_ClaimNotApproved_Throws()
    {
        var (service, db, _, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var pendingClaim = await FellowshipVoucherTestHelpers.AddClaimAtStage(
            db, WorkflowStage.WithDAFellowship);

        await Assert.ThrowsAsync<ClaimNotApprovedForVoucherException>(() =>
            service.CreateVoucherFromClaimsAsync([pendingClaim.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_UnknownClaimId_Throws()
    {
        var (service, _, _, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);

        await Assert.ThrowsAsync<FellowshipClaimNotFoundException>(() =>
            service.CreateVoucherFromClaimsAsync([Guid.NewGuid()], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_EmptyList_Throws()
    {
        var (service, _, _, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateVoucherFromClaimsAsync([], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_InsufficientManpowerBalance_Throws()
    {
        // Claim amount exceeds the project's RecurringManpower available
        // balance. (The helper also gives the project a generously funded
        // consumable head, which must NOT count toward manpower.)
        var (service, _, claim1, _) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 50000m, manpowerHeadAvailable: 10000m);

        await Assert.ThrowsAsync<InsufficientManpowerBudgetException>(() =>
            service.CreateVoucherFromClaimsAsync([claim1.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_ProjectWithoutManpowerHead_Throws()
    {
        var (service, db, claim, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 1000m, manpowerHeadAvailable: 10000m);
        var headId = await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, projectId);
        db.BudgetHeads.Remove(await db.BudgetHeads.FirstAsync(b => b.Id == headId));
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ManpowerHeadNotConfiguredException>(() =>
            service.CreateVoucherFromClaimsAsync([claim.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_ExistingManpowerExpenditure_ReducesAvailableBalance()
    {
        var (service, db, claim, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 8000m, manpowerHeadAvailable: 10000m);
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, projectId),
            SectionType = "Payment Voucher PV/earlier",
            TransactionDate = new DateOnly(2026, 2, 1),
            Amount = 5000m,
        });
        await db.SaveChangesAsync();

        // 10000 granted - 5000 already spent = 5000 available < 8000 claimed.
        await Assert.ThrowsAsync<InsufficientManpowerBudgetException>(() =>
            service.CreateVoucherFromClaimsAsync([claim.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_PendingGrantReceipt_DoesNotCountTowardBalance()
    {
        var (service, db, claim, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 50000m, manpowerHeadAvailable: 10000m);
        var pending = FellowshipVoucherTestHelpers.ApprovedReceipt(
            projectId, await FellowshipVoucherTestHelpers.ManpowerHeadIdAsync(db, projectId), 100_000m);
        pending.Status = GrantReceiptStatus.PendingApproval;
        db.GrantReceipts.Add(pending);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InsufficientManpowerBudgetException>(() =>
            service.CreateVoucherFromClaimsAsync([claim.Id], Input(), Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_TwoClaimsSameProjectJointlyOverBudget_ThrowsAndPersistsNothing()
    {
        // Each 6000 claim fits the 10000 balance alone; together they do not.
        // The second claim must be checked against the balance left AFTER the
        // first claim in the same batch, not the pre-batch balance.
        var (service, db, claim1, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 6000m, manpowerHeadAvailable: 10000m);
        var claim2 = await FellowshipVoucherTestHelpers.AddClaimAtStage(
            db, WorkflowStage.Approved, amount: 6000m, projectId: projectId);

        await Assert.ThrowsAsync<InsufficientManpowerBudgetException>(() =>
            service.CreateVoucherFromClaimsAsync([claim1.Id, claim2.Id], Input(), Guid.NewGuid(), default));

        AssertNothingPendingOrPersisted(db, claim1, claim2);
    }

    [Fact]
    public async Task CreateVoucherFromClaims_TwoClaimsSameProjectWithinBudget_RunningBalanceOnItems()
    {
        var (service, db, claim1, projectId) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 4000m, manpowerHeadAvailable: 10000m);
        var claim2 = await FellowshipVoucherTestHelpers.AddClaimAtStage(
            db, WorkflowStage.Approved, amount: 5000m, projectId: projectId);

        var voucherId = await service.CreateVoucherFromClaimsAsync(
            [claim1.Id, claim2.Id], Input(), Guid.NewGuid(), default);

        var voucher = await db.PaymentVouchers.Include(v => v.Items).FirstAsync(v => v.Id == voucherId);
        var item1 = voucher.Items.Single(i => i.FellowshipClaimId == claim1.Id);
        var item2 = voucher.Items.Single(i => i.FellowshipClaimId == claim2.Id);
        Assert.Equal(10000m, item1.CurrentHeadBalance);
        Assert.Equal(6000m, item1.BalanceAfterPayment);
        Assert.Equal(6000m, item2.CurrentHeadBalance);
        Assert.Equal(1000m, item2.BalanceAfterPayment);
        Assert.Equal(9000m, await db.Expenditure.Where(e => e.ProjectId == projectId).SumAsync(e => e.Amount));
    }

    [Fact]
    public async Task CreateVoucherFromClaims_FailureOnLaterClaim_LeavesEarlierClaimUntouched()
    {
        // claim1 (valid) is processed before pendingClaim (not Approved). The
        // failure must not leave claim1 half-linked or an Expenditure queued
        // in the change tracker for a later SaveChanges to flush.
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var pendingClaim = await FellowshipVoucherTestHelpers.AddClaimAtStage(
            db, WorkflowStage.WithDAFellowship);

        await Assert.ThrowsAsync<ClaimNotApprovedForVoucherException>(() =>
            service.CreateVoucherFromClaimsAsync([claim1.Id, pendingClaim.Id], Input(), Guid.NewGuid(), default));

        AssertNothingPendingOrPersisted(db, claim1, pendingClaim);
    }

    private static void AssertNothingPendingOrPersisted(
        API.Tests.Procurement.TestProcurementDbContext db, params FellowshipClaim[] claims)
    {
        Assert.False(db.ChangeTracker.HasChanges());
        Assert.Equal(0, db.PaymentVouchers.Count());
        Assert.Equal(0, db.Expenditure.Count());
        foreach (var claim in claims)
        {
            Assert.Null(claim.PaymentVoucherItemId);
        }
    }
}
