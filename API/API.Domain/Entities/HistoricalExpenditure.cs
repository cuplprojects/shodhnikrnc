namespace API.Domain.Entities;

/// <summary>
/// Expenditure entered directly by RnC office staff for a pre-existing
/// project's real-world spending history, from before the project was
/// digitized -- not routed through the Indent -> Bill workflow that
/// produces the live <see cref="Expenditure"/> table, since that workflow
/// makes no sense for money spent years ago. A sibling table, not a tagged
/// row on <see cref="Expenditure"/>, so the live table and everything that
/// already reads it stay untouched.
/// </summary>
public class HistoricalExpenditure
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public decimal Amount { get; set; }
    public required string Description { get; set; }
    public DateOnly TransactionDate { get; set; }

    /// <summary>The RnC office staff member who recorded this -- not
    /// necessarily the project's owner, since this is the office acting on
    /// the PI's behalf to backfill history, not a self-service action.</summary>
    public Guid RecordedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
