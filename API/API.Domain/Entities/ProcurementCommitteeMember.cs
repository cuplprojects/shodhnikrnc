using API.Domain.Enums;

namespace API.Domain.Entities;

public class ProcurementCommitteeMember
{
    public Guid Id { get; set; }
    public Guid ProcurementCommitteeId { get; set; }
    public required string Name { get; set; }
    public CommitteeMemberRole Role { get; set; }
}
