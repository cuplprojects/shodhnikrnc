using API.Application.Common;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Procurement;

/// <summary>
/// Enforces the BRD's "Available Budget &lt; Requested Amount" rule (A7.4), which the
/// legacy system never implemented — its procurement tables had no budget-head link at all.
/// </summary>
public class IndentBudgetValidator(
    IApplicationDbContext db,
    IProjectYearCalculator yearCalculator) : IIndentBudgetValidator
{
    /// <summary>
    /// Only rejection and cancellation release committed money. An <c>Approved</c>
    /// indent still holds its estimate against the head until the bill is actually
    /// paid, otherwise the same rupees could be committed twice in that window.
    /// </summary>
    private static readonly WorkflowStage[] TerminalStages =
        [WorkflowStage.Rejected, WorkflowStage.Cancelled];

    private static readonly IReadOnlyDictionary<BudgetHeadName, string> HeadNameToSectionType =
        new Dictionary<BudgetHeadName, string>
        {
            [BudgetHeadName.RecurringConsumable] = "consumable",
            [BudgetHeadName.RecurringContingency] = "contingency",
            [BudgetHeadName.EquipmentNonRecurring] = "equipment",
            [BudgetHeadName.RecurringTravel] = "travel",
            [BudgetHeadName.RecurringManpower] = "manpower",
            [BudgetHeadName.RecurringOverhead] = "overhead",
            [BudgetHeadName.RecurringFieldCharges] = "fieldcharges",
        };

    public async Task<IndentBudgetSnapshot> GetSnapshotAsync(
        Guid budgetHeadId, DateOnly asOfDate, CancellationToken ct = default,
        Guid? excludeWorkflowInstanceId = null, OverheadSubHead? subHead = null)
    {
        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == budgetHeadId, ct)
            ?? throw new ArgumentException($"Budget head '{budgetHeadId}' was not found.", nameof(budgetHeadId));

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == head.ProjectId, ct)
            ?? throw new InvalidOperationException($"Project '{head.ProjectId}' for budget head '{budgetHeadId}' was not found.");

        var projectYear = yearCalculator.GetProjectYear(project.StartDate, asOfDate);

        decimal sanctioned;
        if (subHead is null)
        {
            sanctioned = projectYear switch
            {
                1 => head.Year1Amount,
                2 => head.Year2Amount,
                3 => head.Year3Amount,
                4 => head.Year4Amount,
                5 => head.Year5Amount,
                _ => 0m,
            };
        }
        else
        {
            // PDF/DDF have no project-setup sanction of their own -- their
            // "Sanctioned" figure IS whatever has actually been received and
            // split into that sub-head so far. Child split rows never carry
            // a meaningful Status of their own (see GrantReceipt.Status's
            // remarks); only the PARENT receipt's Status gates whether the
            // split counts, matching BudgetSummaryService.cs's existing
            // pattern for the same data.
            var parentIdsApproved = await db.GrantReceipts
                .Where(g => g.BudgetHeadId == budgetHeadId
                    && g.Type == GrantReceiptType.Head
                    && g.Status == GrantReceiptStatus.Approved)
                .Select(g => g.Id)
                .ToListAsync(ct);

            sanctioned = await db.GrantReceipts
                .Where(g => g.BudgetHeadId == budgetHeadId
                    && g.Type == GrantReceiptType.OverheadSplit
                    && g.SubHead == subHead
                    && g.ParentReceiptId != null
                    && parentIdsApproved.Contains(g.ParentReceiptId.Value))
                .SumAsync(g => g.Amount, ct);
        }

        var committed = await SumCommittedAsync(budgetHeadId, excludeWorkflowInstanceId, subHead, ct);

        // Expenditure rows don't carry SubHead, so a paid bill's amount can't be
        // cleanly attributed to Pdf vs Ddf -- per the design spec, treat Paid as 0
        // for a sub-head snapshot rather than leaving it unscoped against the
        // WHOLE project's year expenditure (which would be a small Sanctioned
        // figure against a potentially much larger unrelated Paid figure).
        // Historical expenditure backfilled by RnC office staff for a
        // pre-existing project (see HistoricalExpenditure) is real money
        // already spent against this head -- it must reduce "available to
        // indent" exactly like a live Expenditure does, so it is folded into
        // Paid under the same subHead-is-null condition as the live sum.
        decimal paid;
        if (subHead is not null)
        {
            paid = 0m;
        }
        else
        {
            var expenditureRows = (await db.Expenditure
                    .Where(e => e.ProjectId == head.ProjectId)
                    .ToListAsync(ct))
                .Where(e => yearCalculator.GetProjectYear(project.StartDate, e.TransactionDate) == projectYear);

            var linkedByHeadId = expenditureRows.Where(e => e.BudgetHeadId == head.Id);
            var linkedBySectionType = HeadNameToSectionType.TryGetValue(head.HeadName, out var sectionType)
                ? expenditureRows.Where(e => e.BudgetHeadId is null && e.SectionType != null &&
                    (e.SectionType.Equals(sectionType, StringComparison.OrdinalIgnoreCase) ||
                     e.SectionType.StartsWith(sectionType, StringComparison.OrdinalIgnoreCase)))
                : Enumerable.Empty<Expenditure>();

            var liveExpenditure = linkedByHeadId.Concat(linkedBySectionType)
                .Sum(e => e.Amount);

            var historicalExpenditure = (await db.HistoricalExpenditures
                    .Where(h => h.ProjectId == head.ProjectId && h.BudgetHeadId == head.Id)
                    .ToListAsync(ct))
                .Where(h => yearCalculator.GetProjectYear(project.StartDate, h.TransactionDate) == projectYear)
                .Sum(h => h.Amount);

            paid = liveExpenditure + historicalExpenditure;
        }

        return new IndentBudgetSnapshot(sanctioned, committed, paid, sanctioned - committed - paid);
    }

    public async Task EnsureSufficientAsync(
        Guid budgetHeadId, DateOnly asOfDate, decimal requestedAmount, CancellationToken ct = default,
        OverheadSubHead? subHead = null)
    {
        var snapshot = await GetSnapshotAsync(budgetHeadId, asOfDate, ct, subHead: subHead);
        if (requestedAmount > snapshot.Available)
        {
            throw new InsufficientBudgetException(requestedAmount, snapshot);
        }
    }

    // TODO: Since Expenditure rows are now created on bill approval (see
    // WorkflowEngineService.RecordExpenditureAsync), a fully-paid indent's
    // EstimatedCost still counts here AND now also counts as Paid in
    // GetSnapshotAsync -- Available = Sanctioned - Committed - Paid
    // double-subtracts every fully-paid indent. This is a known, deliberately
    // deferred gap (see the 2026-09-18-proposal-budget-form-fixes-design.md
    // spec's "Committed reduction -- explicitly deferred" section) -- a
    // separate future change should exclude bill-Approved indents' estimates
    // from this sum once their cost has graduated to Paid. Do not "fix" this
    // by changing GetSnapshotAsync's formula instead; the formula is correct,
    // this method's inclusion criteria is what needs to change.
    //
    // Paid is NOT scoped by subHead above: Expenditure rows don't carry
    // SubHead, so a paid bill's amount can't be cleanly attributed to Pdf vs
    // Ddf once a multi-head Indent has been billed. This mirrors the same
    // class of imprecision already accepted here for the non-subHead case --
    // it is not a new gap this feature introduces.
    private async Task<decimal> SumCommittedAsync(
        Guid budgetHeadId, Guid? excludeWorkflowInstanceId, OverheadSubHead? subHead, CancellationToken ct)
    {
        var activeWorkflowIds = await db.WorkflowInstances
            .Where(w => !TerminalStages.Contains(w.CurrentStage))
            .Select(w => w.Id)
            .ToListAsync(ct);

        var active = activeWorkflowIds.ToHashSet();
        if (excludeWorkflowInstanceId.HasValue)
        {
            active.Remove(excludeWorkflowInstanceId.Value);
        }

        // Exclude indents/travel requests that have had Payment Vouchers created for them
        var paidVoucherIndentIds = await db.PaymentVouchers
            .Where(v => v.IndentId != null && v.Status != "Rejected")
            .Select(v => v.IndentId!.Value)
            .ToListAsync(ct);

        var billApprovedWorkflowIds = await db.WorkflowInstances
            .Where(w => w.Phase == WorkflowPhase.Bill && w.CurrentStage == WorkflowStage.Approved)
            .Select(w => w.Id)
            .ToListAsync(ct);

        var paidVouchers = paidVoucherIndentIds.ToHashSet();
        var billApproved = billApprovedWorkflowIds.ToHashSet();
        if (subHead is not null)
        {
            // PDF/DDF only ever draw through IndentBudgetHeadAllocation rows
            // (the new multi-head Indent flow) -- Travel and the legacy
            // three-table flow have no concept of a sub-head at all, so they
            // are correctly excluded from this scoped sum.
            var subHeadAllocations = await db.IndentBudgetHeadAllocations
                .Where(a => a.BudgetHeadId == budgetHeadId && a.SubHead == subHead)
                .Select(a => new { a.Indent.WorkflowInstanceId, EstimatedCost = a.CommittedAmount })
                .ToListAsync(ct);

            return subHeadAllocations
                .Where(i => active.Contains(i.WorkflowInstanceId))
                .Sum(i => i.EstimatedCost);
        }

        var consumable = await db.ConsumableIndents
            .Where(i => i.BudgetHeadId == budgetHeadId && !paidVouchers.Contains(i.Id))
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);
        var contingency = await db.ContingencyIndents
            .Where(i => i.BudgetHeadId == budgetHeadId && !paidVouchers.Contains(i.Id))
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);
        var equipment = await db.EquipmentIndents
            .Where(i => i.BudgetHeadId == budgetHeadId && !paidVouchers.Contains(i.Id))
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);

        // Travel draws against the same heads (RecurringTravel). Omitting it here
        // would let travel and procurement each spend money the other has already
        // committed on the same head.
        var travel = await db.TravelRequestBudgetHeadAllocations
            .Where(a => a.BudgetHeadId == budgetHeadId && !paidVouchers.Contains(a.TravelRequestId))
            .Select(a => new { a.TravelRequest.WorkflowInstanceId, EstimatedCost = a.CommittedAmount })
            .ToListAsync(ct);

        // Dynamic (unified-flow) indents now draw through
        // IndentBudgetHeadAllocation rows, one per selected head, instead of
        // the whole item total being attributed to a single BudgetHeadId --
        // summing db.Indents by its own BudgetHeadId here would double-count
        // once an Indent can have more than one allocation.
        var dynamicIndents = await db.IndentBudgetHeadAllocations
            .Where(a => a.BudgetHeadId == budgetHeadId && a.SubHead == null && !paidVouchers.Contains(a.IndentId))
            .Select(a => new { a.Indent.WorkflowInstanceId, EstimatedCost = a.CommittedAmount })
            .ToListAsync(ct);

        return consumable.Concat(contingency).Concat(equipment).Concat(travel).Concat(dynamicIndents)
            .Where(i => active.Contains(i.WorkflowInstanceId) && !billApproved.Contains(i.WorkflowInstanceId))
            .Sum(i => i.EstimatedCost);
    }
}
