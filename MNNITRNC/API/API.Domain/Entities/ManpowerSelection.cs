using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// The fellow record, created when a selected candidate joins. This is the join
/// between recruitment and everything a fellow later does: it carries the
/// position (and through it the project), the tenure, and the stipend that
/// Phase 6's fellowship claims are based on.
/// </summary>
/// <remarks>
/// Deliberately separate from <see cref="Candidate"/>. Legacy's
/// manpower_selections conflated applicant and employee data; keeping them apart
/// means an applicant's submitted details are never overwritten by employment
/// facts.
/// </remarks>
public class ManpowerSelection
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }

    /// <summary>The account whose role was promoted Applicant -> Fellow.</summary>
    public Guid ApplicationUserId { get; set; }

    public Guid SanctionedManpowerPositionId { get; set; }

    public string? AadharNo { get; set; }
    public string? PanNo { get; set; }
    public string? BankAccountNo { get; set; }
    public string? IfscCode { get; set; }
    public DateOnly? Dob { get; set; }
    public Gender? Gender { get; set; }

    public DateOnly JoinedOn { get; set; }
    public DateOnly ValidTill { get; set; }
    public decimal RecommendedStipend { get; set; }

    /// <summary>
    /// Phase 6's gate. The leave module is blocked until the ID card has been
    /// issued, so this is checked server-side rather than merely hidden in the UI.
    /// </summary>
    public string? IdCardNumber { get; set; }
    public DateTimeOffset? IdCardIssuedAt { get; set; }

    public ManpowerSelectionStatus Status { get; set; } = ManpowerSelectionStatus.Active;

    public DateTimeOffset CreatedAt { get; set; }

    public Candidate? Candidate { get; set; }
}
