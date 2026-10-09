namespace API.Domain.Entities;

/// <summary>
/// Money returned against a project's sanctioned grant -- to the funding
/// agency, or an unspent balance clawed back. A manual record, not a
/// workflow: the BRD names "Refund Reports" as a report over data, and
/// gives no refund-initiation approval chain to model, so none is invented
/// here (Phase 10 spec §3a).
/// </summary>
public class Refund
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly RefundDate { get; set; }
    public required string Reason { get; set; }

    /// <summary>The RnC office staff member who recorded this -- not
    /// necessarily the project's owner, since a refund is the office's
    /// business, not the PI's.</summary>
    public Guid RecordedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
