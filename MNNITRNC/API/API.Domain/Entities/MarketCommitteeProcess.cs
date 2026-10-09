using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// Tracks the three offline steps the Non-GeM Rs.2L-25L procurement band
/// requires (BRD's "market committee formed, notice issued, comparative
/// statement signed") before an indent in that band may be approved or
/// forwarded past ForwardedDR. Each field is null until recorded; a date
/// value doubles as the completion flag and its own audit timestamp,
/// matching GrantReceipt's own flat-nullable-date convention rather than
/// separate boolean+date pairs.
/// </summary>
/// <remarks>
/// Keyed on (IndentType, IndentId) like ProcurementCommittee -- a
/// discriminator pair, not a typed foreign key, since IndentType spans
/// three otherwise-unrelated entities (ConsumableIndent/ContingencyIndent/
/// EquipmentIndent).
/// </remarks>
public class MarketCommitteeProcess
{
    public Guid Id { get; set; }
    public IndentType IndentType { get; set; }
    public Guid IndentId { get; set; }

    public DateOnly? CommitteeFormedOn { get; set; }
    public DateOnly? NoticeIssuedOn { get; set; }
    public DateOnly? ComparativeStatementSignedOn { get; set; }

    /// <summary>True once all three steps are recorded -- the gate condition Task 7's service checks.</summary>
    public bool IsComplete => CommitteeFormedOn is not null
        && NoticeIssuedOn is not null
        && ComparativeStatementSignedOn is not null;
}
