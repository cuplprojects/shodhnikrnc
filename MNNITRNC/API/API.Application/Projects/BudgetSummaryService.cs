using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class BudgetSummaryService(IApplicationDbContext db, IProjectYearCalculator yearCalculator) : IBudgetSummaryService
{
    private static readonly IReadOnlyDictionary<BudgetHeadName, string> HeadNameToSectionType = new Dictionary<BudgetHeadName, string>
    {
        [BudgetHeadName.RecurringConsumable] = "consumable",
        [BudgetHeadName.RecurringContingency] = "contingency",
        [BudgetHeadName.EquipmentNonRecurring] = "equipment",
        [BudgetHeadName.RecurringTravel] = "travel",
    };

    public async Task<BudgetSummaryResult> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await db.Projects
            .Include(p => p.BudgetHeads)
            .Include(p => p.GrantReceipts)
            .Include(p => p.HistoricalGrantReceipts)
            .Include(p => p.BudgetReappropriationLogs)
            .Include(p => p.ReappropriationRequests!)
                .ThenInclude(r => r.SourceLines)
            .Include(p => p.ReappropriationRequests!)
                .ThenInclude(r => r.DestinationLines)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        var expenditureRows = await db.Expenditure
            .Where(e => e.ProjectId == projectId)
            .ToListAsync(ct);

        var historicalExpenditureRows = await db.HistoricalExpenditures
            .Where(h => h.ProjectId == projectId)
            .ToListAsync(ct);

        var results = new List<BudgetSummaryLine>();

        foreach (var head in project.BudgetHeads)
        {
            var yearlyAmounts = new[]
            {
                head.Year1Amount, head.Year2Amount, head.Year3Amount, head.Year4Amount, head.Year5Amount,
            };

            for (var yearIndex = 0; yearIndex < yearlyAmounts.Length; yearIndex++)
            {
                var projectYear = yearIndex + 1;
                var sanctioned = yearlyAmounts[yearIndex];

                var grantReceived = project.GrantReceipts
                    .Where(g => g.Type == Domain.Enums.GrantReceiptType.Head
                        && (g.BudgetHeadId == head.Id
                            || (!project.BudgetHeads.Any(bh => bh.Id == g.BudgetHeadId)
                                && (head.HeadName == BudgetHeadName.RecurringOverhead && project.GrantReceipts.Any(c => c.ParentReceiptId == g.Id && c.Type == Domain.Enums.GrantReceiptType.OverheadSplit)
                                    || (project.BudgetHeads.Count == 1)))))
                    .Where(g => g.Status == GrantReceiptStatus.Approved)
                    .Where(g => yearCalculator.GetProjectYear(project.StartDate, g.ReceivedDate) == projectYear)
                    .Sum(g => g.Amount);

                var historicalReceived = project.HistoricalGrantReceipts
                    .Where(h => h.BudgetHeadId == head.Id)
                    .Where(h => yearCalculator.GetProjectYear(project.StartDate, h.ReceivedDate) == projectYear)
                    .Sum(h => h.Amount);

                // BudgetHeadId is the real link (Phase 10) and covers every
                // head, not just the four the old SectionType dictionary
                // happened to name. SectionType stays as the fallback for
                // rows that predate the column -- a row carrying both is
                // read once, by BudgetHeadId, not double-counted.
                var linkedByHeadId = expenditureRows.Where(e => e.BudgetHeadId == head.Id);
                var linkedBySectionType = HeadNameToSectionType.TryGetValue(head.HeadName, out var sectionType)
                    ? expenditureRows.Where(e => e.BudgetHeadId is null && e.SectionType == sectionType)
                    : [];

                var spent = linkedByHeadId.Concat(linkedBySectionType)
                    .Where(e => yearCalculator.GetProjectYear(project.StartDate, e.TransactionDate) == projectYear)
                    .Sum(e => e.Amount);

                var historicalSpent = historicalExpenditureRows
                    .Where(h => h.BudgetHeadId == head.Id)
                    .Where(h => yearCalculator.GetProjectYear(project.StartDate, h.TransactionDate) == projectYear)
                    .Sum(h => h.Amount);

                var totalReceived = grantReceived + historicalReceived;
                var totalSpent = spent + historicalSpent;
                results.Add(new BudgetSummaryLine(head.HeadName, projectYear, sanctioned, totalReceived, totalSpent, totalReceived - totalSpent, head.CustomLabel));
            }
        }

        var reappropriations = new List<BudgetHeadReappropriationSummary>();
        foreach (var head in project.BudgetHeads)
        {
            var oldNet = project.BudgetReappropriationLogs
                .Where(l => l.ToHeadId == head.Id).Sum(l => l.Amount)
                - project.BudgetReappropriationLogs
                .Where(l => l.FromHeadId == head.Id).Sum(l => l.Amount);

            var approvedRequests = project.ReappropriationRequests?.Where(r => r.Status == ReappropriationRequestStatus.Approved) ?? [];
            var newNet = approvedRequests.SelectMany(r => r.DestinationLines).Where(d => d.BudgetHeadId == head.Id).Sum(d => d.Amount)
                - approvedRequests.SelectMany(r => r.SourceLines).Where(s => s.BudgetHeadId == head.Id).Sum(s => s.Amount);
                
            var netReappropriated = oldNet + newNet;

            if (netReappropriated == 0m)
            {
                // The net effect on this head is zero -- either no re-appropriation
                // activity at all, or activity that moved money both in and out in
                // equal amounts and fully offset. Either way there is nothing to
                // show beyond the sanctioned/received figures already in `results`.
                continue;
            }

            reappropriations.Add(new BudgetHeadReappropriationSummary(
                head.HeadName, netReappropriated, BudgetHeadEffectiveReceived.Calculate(project, head.Id), head.CustomLabel));
        }

        return new BudgetSummaryResult(results, reappropriations);
    }
}
