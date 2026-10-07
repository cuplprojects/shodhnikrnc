namespace API.Domain.Entities;

/// <summary>
/// One year's monthly stipend rate for a <see cref="ProposalManpowerPosition"/>.
/// </summary>
/// <remarks>
/// <see cref="Stipend"/> is a MONTHLY rate, not an annual total -- unlike
/// <see cref="ProposalBudgetLineYear.Amount"/>, which is annual. Annualizing
/// (x Positions x 12) happens only where a total is needed (the row-total
/// display, the RecurringManpower reconciliation check) -- never here.
/// HRA is never stored: it is always computed as
/// Stipend x ProposalManpowerPosition.HraPercent / 100 at the point of use,
/// so it stays correct if HraPercent is edited on a later revision without
/// needing to touch already-stored year rows.
/// </remarks>
public class ProposalManpowerPositionYear
{
    public Guid Id { get; set; }
    public Guid ProposalManpowerPositionId { get; set; }
    public int Year { get; set; }
    public decimal Stipend { get; set; }
}
