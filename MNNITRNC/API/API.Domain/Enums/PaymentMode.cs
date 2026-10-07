namespace API.Domain.Enums;

/// <summary>
/// How grant funds arrived. Payment is an offline process; the portal records
/// the mode and the bank's transaction reference as evidence.
/// </summary>
public enum PaymentMode
{
    Neft,
    Rtgs,
    Cheque,
    DemandDraft,
    Other,
    PFMS,
    DirectBank
}
