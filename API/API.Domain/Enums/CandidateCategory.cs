namespace API.Domain.Enums;

/// <summary>
/// The reservation category an applicant declares on the application form.
/// Persisted as an int, so members are appended, never reordered.
/// </summary>
public enum CandidateCategory
{
    General,
    SC,
    ST,
    OBC,
    PH,
    EWS,
    OBC_NCL
}
