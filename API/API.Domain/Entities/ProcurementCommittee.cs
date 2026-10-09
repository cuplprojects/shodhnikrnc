using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One per indent that requires a market-survey committee (non-GeM Rs.2L-25L).
/// The owning indent is referenced polymorphically by (IndentType, IndentId)
/// because the three indent entities are parallel rather than sharing a base.
/// </summary>
public class ProcurementCommittee
{
    public Guid Id { get; set; }
    public IndentType IndentType { get; set; }
    public Guid IndentId { get; set; }

    public ICollection<ProcurementCommitteeMember> Members { get; set; } = new List<ProcurementCommitteeMember>();
}
