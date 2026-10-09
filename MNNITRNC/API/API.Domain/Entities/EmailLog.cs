namespace API.Domain.Entities;

/// <summary>
/// One row per attempted send (success or failure). RenderedBody/Subject are
/// stored fully substituted -- not the raw template -- so Resend can replay
/// exactly what should have gone out without re-resolving the recipient or
/// re-running placeholder substitution against data that may have since
/// changed.
/// </summary>
public class EmailLog
{
    public Guid Id { get; set; }
    public required string TemplateKey { get; set; }
    public required string ToAddress { get; set; }
    public required string Subject { get; set; }
    public required string RenderedBody { get; set; }
    public bool Succeeded { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset SentAt { get; set; }

    /// <summary>
    /// e.g. "ResearchProposal" / the proposal's Guid -- lets the admin log
    /// page filter/link back to the request an email was about.
    /// </summary>
    public required string RelatedEntityType { get; set; }
    public Guid RelatedEntityId { get; set; }
}
