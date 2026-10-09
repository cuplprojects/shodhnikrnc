using API.Domain.Enums;

namespace API.Contracts.Projects;

/// <summary>
/// <paramref name="TransactionReference"/> is the NEFT/RTGS number for the
/// offline transfer. Optional here so existing callers keep working, but
/// recruitment's offer-letter gate requires it: a receipt without one does not
/// count as payment received.
/// </summary>
public record RecordGrantReceiptRequest(
    Guid BudgetHeadId,
    DateOnly ReceivedDate,
    decimal Amount,
    IReadOnlyDictionary<OverheadSubHead, decimal>? OverheadSplit,
    string? TransactionReference = null,
    PaymentMode? PaymentMode = null,
    string? SchemeCode = null,
    int? ProjectYear = null,
    string? Remarks = null);
