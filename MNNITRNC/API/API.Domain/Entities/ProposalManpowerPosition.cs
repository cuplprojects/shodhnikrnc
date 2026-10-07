namespace API.Domain.Entities;

public class ProposalManpowerPosition
{
    public Guid Id { get; set; }
    public Guid ResearchProposalId { get; set; }
    public required string Designation { get; set; }
    public int Positions { get; set; }

    /// <summary>Uniform across every year -- the client enters one HRA%,
    /// not one per year. Applied to each year's Stipend independently
    /// wherever an amount is needed.</summary>
    public decimal HraPercent { get; set; }

    public ICollection<ProposalManpowerPositionYear> Years { get; set; } = new List<ProposalManpowerPositionYear>();
}
