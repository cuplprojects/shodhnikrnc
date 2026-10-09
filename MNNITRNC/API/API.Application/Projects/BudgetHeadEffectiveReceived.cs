using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Projects;

/// <summary>
/// The single shared calculation of a budget head's effective received
/// total: actual Grant Receipts against the head, adjusted by the net of any
/// re-appropriation activity that has moved money into or out of it.
/// </summary>
/// <remarks>
/// Both <see cref="ProjectService"/> (re-appropriation validation) and
/// <see cref="BudgetSummaryService"/> (the budget-summary endpoint) need this
/// exact figure -- it used to be implemented twice; this is the one place it
/// lives now, so the two call sites cannot drift apart.
/// </remarks>
internal static class BudgetHeadEffectiveReceived
{
    public static decimal Calculate(Project project, Guid headId)
    {
        var actualReceived = project.GrantReceipts
            .Where(g => g.BudgetHeadId == headId && g.Type == GrantReceiptType.Head)
            .Where(g => g.Status == GrantReceiptStatus.Approved)
            .Sum(g => g.Amount);

        // Historical receipts backfilled by RnC office staff for a
        // pre-existing project (see HistoricalGrantReceipt) were never
        // raised through the live GrantReceipt approval chain, but they are
        // still money the project actually received against this head --
        // they must count toward "effective received" exactly like an
        // Approved GrantReceipt does, or a legacy project's re-appropriation
        // ceiling would silently disagree with its own Budget Summary page.
        var actualReceivedHistorical = project.HistoricalGrantReceipts
            .Where(h => h.BudgetHeadId == headId)
            .Sum(h => h.Amount);

        var oldReappropriationNet = project.BudgetReappropriationLogs
            .Where(l => l.ToHeadId == headId).Sum(l => l.Amount)
            - project.BudgetReappropriationLogs
            .Where(l => l.FromHeadId == headId).Sum(l => l.Amount);

        var approvedRequests = project.ReappropriationRequests?
            .Where(r => r.Status == ReappropriationRequestStatus.Approved) ?? [];

        var newReappropriationNet = approvedRequests.SelectMany(r => r.DestinationLines)
            .Where(d => d.BudgetHeadId == headId).Sum(d => d.Amount)
            - approvedRequests.SelectMany(r => r.SourceLines)
            .Where(s => s.BudgetHeadId == headId).Sum(s => s.Amount);

        return actualReceived + actualReceivedHistorical + oldReappropriationNet + newReappropriationNet;
    }
}
