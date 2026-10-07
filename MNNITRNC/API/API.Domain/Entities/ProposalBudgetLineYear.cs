namespace API.Domain.Entities;

/// <summary>
/// One year's budgeted amount on a <see cref="ProposalBudgetLine"/>. A line
/// carries exactly <c>ceil(ResearchProposal.DurationMonths / 12)</c> of
/// these, Year numbered 1-based -- enforced by
/// ResearchProposalService.CreateDraftAsync/UpdateAsync, not by the schema.
/// </summary>
public class ProposalBudgetLineYear
{
    public Guid Id { get; set; }
    public Guid ProposalBudgetLineId { get; set; }

    public int Year { get; set; }
    public decimal Amount { get; set; }
}
