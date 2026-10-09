namespace API.Domain.Entities;

public class Expenditure
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string SectionType { get; set; }

    /// <summary>
    /// Which <see cref="BudgetHead"/> this expenditure is against.
    /// </summary>
    /// <remarks>
    /// Nullable because <see cref="SectionType"/> (the original, free-text
    /// correlation) predates this column and cannot always be trusted to
    /// match a real <c>BudgetHeadName</c> exactly -- a row whose text
    /// matched nothing at migration time is left null rather than guessed
    /// at, the same "safe failure over a wrong guess" rule
    /// <c>DbSeeder</c>'s department backfills already follow. SectionType is
    /// not removed; this is additive, not a replacement.
    /// </remarks>
    public Guid? BudgetHeadId { get; set; }

    public DateOnly TransactionDate { get; set; }
    public decimal Amount { get; set; }
}
