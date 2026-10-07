using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One application. A person who applies to three projects has one
/// <see cref="ApplicationUser"/> and three of these -- which is what lets a
/// rejected applicant reapply elsewhere while their earlier attempts survive as
/// history.
/// </summary>
public class Candidate
{
    public Guid Id { get; set; }
    public Guid RecruitmentRequestId { get; set; }

    /// <summary>The applicant's account, created at self-registration.</summary>
    public Guid ApplicationUserId { get; set; }

    // Captured per application rather than on the account: a reapplication two
    // years later may carry a different mobile number or qualification, and the
    // committee should see what was submitted at the time.
    public required string FullName { get; set; }
    public required string Mobile { get; set; }

    // Legacy free-text summaries from the old single-shot apply form. Kept as a
    // fallback for the applications that predate the structured Education and
    // Experiences rows below -- old rows have these and no child rows, so
    // deleting them would erase the only record of what was submitted.
    public string? Qualification { get; set; }
    public string? Experience { get; set; }

    public ScreeningResult? ScreeningResult { get; set; }

    /// <summary>
    /// The screening committee's stated reason when marking this candidate
    /// Not Eligible -- mandatory in that case, enforced in
    /// RecruitmentService.RecordScreeningResultAsync. Distinct from the
    /// applicant's own self-submitted Remarks field above.
    /// </summary>
    public string? ScreeningRemarks { get; set; }

    /// <summary>
    /// Stamped when the bulk Not-Eligible notification email is sent to this
    /// candidate -- doubles as the idempotency guard so a repeat bulk-send
    /// never double-emails the same candidate.
    /// </summary>
    public DateTimeOffset? NotEligibleEmailSentAt { get; set; }

    public InterviewMode InterviewMode { get; set; } = InterviewMode.Offline;

    /// <summary>Set when the Dean approves an online interview (BRD A2).</summary>
    public Guid? OnlineModeApprovedByUserId { get; set; }

    public int? MeritRank { get; set; }
    public CandidateOutcome Outcome { get; set; } = CandidateOutcome.Pending;

    /// <summary>
    /// The candidate's response to an issued offer -- null until they
    /// Accept or Decline. Deliberately separate from Outcome, which keeps
    /// meaning "this is our pick" and must not be touched by this field's
    /// own assignment: setting OfferResponse = Accepted never changes
    /// Outcome, and setting OfferResponse = Declined changes Outcome back
    /// to NotSelected as a SEPARATE, explicit assignment in
    /// RecruitmentService.DeclineOfferAsync -- not implied by this field
    /// alone.
    /// </summary>
    public CandidateOfferResponse? OfferResponse { get; set; }

    /// <summary>
    /// Which earlier application seeded this one. Provenance only -- the details
    /// were copied, so the source can be deleted without affecting this row.
    /// </summary>
    public Guid? PrefilledFromCandidateId { get; set; }

    public DateTimeOffset AppliedAt { get; set; }

    // --- Structured application data (stepwise application form) ---
    // All nullable or defaulted: rows created by the old single-shot apply
    // form carry none of it, and must stay readable without it.

    /// <summary>The form's "Sex (Male/Female)"; the existing Gender enum covers it.</summary>
    public Gender? Gender { get; set; }

    /// <summary>The form's "Marital Status (Married/Unmarried)".</summary>
    public bool? IsMarried { get; set; }

    public DateOnly? DateOfBirth { get; set; }
    public string? FatherOrHusbandName { get; set; }
    public string? PresentAddress { get; set; }
    public string? PermanentAddress { get; set; }
    public string? Email { get; set; }
    public string? Nationality { get; set; }

    public CandidateCategory? Category { get; set; }

    /// <summary>
    /// The uploaded <see cref="Document"/> proving <see cref="Category"/>.
    /// Null for General, which has no certificate to produce.
    /// </summary>
    public Guid? CategoryCertificateDocumentId { get; set; }

    public IdProofType? IdProofType { get; set; }
    public string? IdProofNumber { get; set; }
    public Guid? IdProofDocumentId { get; set; }

    public bool GateNetGpatQualified { get; set; }
    public string? GateNetGpatRollNo { get; set; }
    public int? GateNetGpatYear { get; set; }

    /// <summary>Free text: GATE reports a score, NET a percentile, GPAT a rank.</summary>
    public string? GateNetGpatScore { get; set; }

    /// <summary>The uploaded <see cref="Document"/> proving GATE / CSIR-UGC NET / GPAT qualification.</summary>
    public Guid? GateNetGpatCertificateDocumentId { get; set; }

    public int SciJournalCount { get; set; }
    public int ScopusJournalCount { get; set; }
    public int NonSciJournalCount { get; set; }
    public int InternationalConfCount { get; set; }
    public int NationalConfCount { get; set; }

    public string? PublicationName { get; set; }
    public string? OtherInformation { get; set; }
    public bool WantsHigherDegreeRegistration { get; set; }

    /// <summary>The uploaded <see cref="Document"/> holding the list or copy of publications.</summary>
    public Guid? PublicationsDocumentId { get; set; }

    /// <summary>The uploaded <see cref="Document"/> holding the applicant's resume/CV.</summary>
    public Guid? ResumeDocumentId { get; set; }

    /// <summary>Optional remarks provided by the candidate.</summary>
    public string? Remarks { get; set; }

    /// <summary>The uploaded <see cref="Document"/> holding the applicant's photograph.</summary>
    public Guid? PhotoDocumentId { get; set; }

    /// <summary>The uploaded <see cref="Document"/> holding the applicant's signature.</summary>
    public Guid? SignatureDocumentId { get; set; }

    /// <summary>When the applicant accepted the form's declaration, if they have.</summary>
    public DateTimeOffset? DeclarationAcceptedAt { get; set; }

    /// <summary>
    /// Draft rows are saved but must stay out of the PI's candidate table and
    /// the screening flow. Defaults to Draft for new rows; every row predating
    /// this column is backfilled to Submitted by the migration that adds it.
    /// </summary>
    public ApplicationStatus ApplicationStatus { get; set; } = ApplicationStatus.Draft;

    public List<CandidateEducation> Education { get; set; } = [];
    public List<CandidateExperience> Experiences { get; set; } = [];

    public RecruitmentRequest? RecruitmentRequest { get; set; }
}
