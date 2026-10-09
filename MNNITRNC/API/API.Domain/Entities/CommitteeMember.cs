using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A member of the screening or selection committee.
/// </summary>
/// <remarks>
/// Phase 3 stored a procurement committee for printing only. This one is
/// validated: the BRD states composition rules for both kinds, so the service
/// enforces them rather than trusting whatever was submitted.
/// </remarks>
public class CommitteeMember
{
    public Guid Id { get; set; }
    public Guid RecruitmentRequestId { get; set; }

    public CommitteeKind Kind { get; set; }
    public CommitteeRole Role { get; set; }

    public required string Name { get; set; }
    public required string Department { get; set; }
    public required string Position { get; set; }

    /// <summary>
    /// The BRD requires one selection nominee from outside the PI's department
    /// (but still within MNNIT), at Associate Professor level or above. Not to
    /// be confused with <see cref="IsOutsideInstitute"/>, which is a person
    /// with no MNNIT account at all.
    /// </summary>
    public bool IsExternal { get; set; }

    /// <summary>
    /// True for a member nominated from outside MNNIT entirely (client
    /// request, 2026-09-16) -- has no ApplicationUserId by definition, and
    /// requires their own uploaded consent (<see cref="ConsentDocumentId"/>)
    /// before the committee can be saved with them on it.
    /// </summary>
    public bool IsOutsideInstitute { get; set; }

    /// <summary>
    /// The signed consent document for an IsOutsideInstitute member -- a
    /// Document row owned by this CommitteeMember (Document.OwnerType =
    /// "CommitteeMember", OwnerId = this row's Id), not by the recruitment
    /// request, since it is this specific person's own consent to serve.
    /// </summary>
    public Guid? ConsentDocumentId { get; set; }

    /// <summary>
    /// The internal faculty account this row represents, when one exists --
    /// set when the member was picked from the faculty list rather than typed
    /// in freehand. Null for an external member, who has no account.
    /// </summary>
    public Guid? ApplicationUserId { get; set; }

    /// <summary>
    /// Contact email for the member. Settable for both internal and external
    /// members as a record of contact.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>Selection nominees set their own availability (BRD A2).</summary>
    public DateOnly? AvailabilityDate { get; set; }

    /// <summary>
    /// True only for the one Selection Committee recommended member the Dean
    /// picked to actually join. The other 2-4 recommended-but-not-chosen rows
    /// stay on record for audit but are not part of the final committee.
    /// </summary>
    public bool IsSelectedByDean { get; set; }

    public RecruitmentRequest? RecruitmentRequest { get; set; }
}
