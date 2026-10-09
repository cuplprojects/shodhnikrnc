namespace API.Domain.Entities;

/// <summary>
/// One Co-Principal Investigator declared on a <see cref="ResearchProposal"/>.
/// A proposal's Co-PIs share ONE signed-consent document
/// (<see cref="API.Domain.Enums.DocumentKind.CoPiConsent"/>) rather than one
/// upload each -- confirmed with the client.
/// </summary>
public class ProposalCoPi
{
    public Guid Id { get; set; }
    public Guid ResearchProposalId { get; set; }
    public bool IsInsideInstitute { get; set; }
    public string? InstituteName { get; set; }
    public required string Name { get; set; }
    public required string Department { get; set; }
    public required string Designation { get; set; }
}
