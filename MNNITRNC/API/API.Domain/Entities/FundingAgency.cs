namespace API.Domain.Entities;

/// <summary>
/// The master list backing the Funding Agency dropdown on a new proposal.
/// Deactivated rather than deleted: a proposal already carries the agency's
/// name as a plain string (see ResearchProposal.Agency), so removing a row
/// here only needs to stop it appearing as a choice going forward, not erase
/// history for proposals that already used it.
/// </summary>
public class FundingAgency
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
}
