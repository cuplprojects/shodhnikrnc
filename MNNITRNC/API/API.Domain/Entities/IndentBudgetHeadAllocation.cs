using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One head (or overhead sub-head) an Indent draws its estimated cost from.
/// Mirrors TravelRequestBudgetHeadAllocation, but uses a surrogate Id instead
/// of a composite (IndentId, BudgetHeadId) key: a PDF and a DDF allocation on
/// the same Indent share the same BudgetHeadId (the project's
/// RecurringOverhead head) and are only distinguished by SubHead, so a
/// composite key on IndentId+BudgetHeadId alone would collide between them.
/// OrderIndex is the selection/waterfall order (0 = first drained, or
/// first-listed for a manual split).
/// </summary>
public class IndentBudgetHeadAllocation
{
    public Guid Id { get; set; }
    public Guid IndentId { get; set; }
    public Guid BudgetHeadId { get; set; }

    /// <summary>
    /// Non-null only for a PDF or DDF allocation. When set, BudgetHeadId
    /// points at the project's RecurringOverhead head, and this row's
    /// balance is scoped to GrantReceipt rows tagged with this same
    /// SubHead, not to BudgetHead.YearNAmount. Idf is never used here.
    /// </summary>
    public OverheadSubHead? SubHead { get; set; }

    public decimal CommittedAmount { get; set; }
    public int OrderIndex { get; set; }

    public Indent Indent { get; set; } = null!;
    public BudgetHead BudgetHead { get; set; } = null!;
}
