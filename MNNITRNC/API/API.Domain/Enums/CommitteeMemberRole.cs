namespace API.Domain.Enums;

/// <summary>
/// The committee slots printed on Annexure 11 (non-GeM Rs.2L-25L). Legacy carried
/// only a single free-text "one faculty/Official" field; the spec replaces it with
/// this structured roster.
/// </summary>
public enum CommitteeMemberRole
{
    Chairperson,
    FacultyMember,
    Indenter,
    RnCRepresentative,
    AdminRepresentative,
    FinanceRepresentative
}
