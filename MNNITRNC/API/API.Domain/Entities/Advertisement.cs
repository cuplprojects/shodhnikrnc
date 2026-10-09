namespace API.Domain.Entities;

/// <summary>
/// One advertisement round. Re-advertising adds a row rather than mutating the
/// previous one, so the history of how many times a position was advertised --
/// and how few candidates each round drew -- survives.
/// </summary>
public class Advertisement
{
    public Guid Id { get; set; }
    public Guid RecruitmentRequestId { get; set; }

    public int Round { get; set; }
    public DateOnly PublishedOn { get; set; }
    public DateOnly ClosingDate { get; set; }
    public required string Text { get; set; }

    /// <summary>
    /// Recorded when the round closes. This is the evidence for the BRD's
    /// "insufficient number of candidates applied" re-advertisement trigger.
    /// </summary>
    public int? CandidateCountAtClose { get; set; }

    public RecruitmentRequest? RecruitmentRequest { get; set; }
}
