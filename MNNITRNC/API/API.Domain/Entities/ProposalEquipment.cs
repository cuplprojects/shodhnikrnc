namespace API.Domain.Entities;

/// <summary>
/// One equipment line on a <see cref="ResearchProposal"/>, carried into
/// <see cref="SanctionedEquipment"/> on the Project created at sanction --
/// same three fields, same shape, exactly mirroring how ProposalBudgetLine
/// becomes BudgetHead.
/// </summary>
public class ProposalEquipment
{
    public Guid Id { get; set; }
    public Guid ResearchProposalId { get; set; }
    public required string Name { get; set; }
    public required string Unit { get; set; }
    public decimal Amount { get; set; }
}
