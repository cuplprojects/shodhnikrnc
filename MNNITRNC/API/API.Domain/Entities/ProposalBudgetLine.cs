using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One head-wise budget line on a <see cref="ResearchProposal"/>. Becomes a
/// <see cref="BudgetHead"/> row on the Project created at sanction, with its
/// <see cref="Years"/> mapping onto BudgetHead's Year1Amount..Year5Amount.
/// </summary>
/// <remarks>
/// Uses <see cref="BudgetHeadName"/> directly rather than the free-text name
/// plus separate recurring/non-recurring flag the spec first described.
/// <c>BudgetHeadName</c> already encodes that distinction in the value itself
/// (<c>EquipmentNonRecurring</c> vs. <c>RecurringConsumable</c> etc.), and every
/// downstream consumer -- <c>IndentBudgetValidator</c>, <c>FellowshipService</c>,
/// the procurement tier system -- switches on these specific values. A
/// free-text head name would need a fragile string-to-enum mapping at sanction
/// time and could not stop a proposal being raised against a head that does not
/// exist; the enum makes that unrepresentable instead of merely validated.
///
/// <see cref="IncludeInOverhead"/> (client request, 2026-09-15) replaced the
/// original per-line <c>OverheadPercent</c>: overhead is now ONE percentage
/// entered on <see cref="ResearchProposal.OverheadPercent"/>, applied to the
/// sum of every line where this flag is true. ResearchProposal's own
/// OverheadAmount is (sum of every checked line's year total) *
/// OverheadPercent / 100 -- computed by ResearchProposalService, never
/// accepted from the client.
/// </remarks>
public class ProposalBudgetLine
{
    public Guid Id { get; set; }
    public Guid ResearchProposalId { get; set; }

    public BudgetHeadName HeadName { get; set; }

    /// <summary>Only meaningful when <see cref="HeadName"/> is <see cref="BudgetHeadName.Other"/>;
    /// null/ignored otherwise. Required (validated in ResearchProposalService) when HeadName == Other.</summary>
    public string? CustomLabel { get; set; }

    /// <summary>
    /// Whether this line's total counts toward the proposal-level overhead
    /// base (ResearchProposal.OverheadPercent is applied to the sum of every
    /// line where this is true). Defaults true: the reference example has
    /// every non-overhead head checked.
    /// </summary>
    public bool IncludeInOverhead { get; set; } = true;

    public ICollection<ProposalBudgetLineYear> Years { get; set; } = new List<ProposalBudgetLineYear>();
}
