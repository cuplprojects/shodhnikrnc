namespace API.Domain.Enums;

/// <summary>
/// The procurement rule that governs how this indent is processed.
/// Computed server-side from GemAvailability + total estimated cost;
/// stored so document generation and approval routing always agree.
/// </summary>
public enum IndentProcurementRule
{
    /// <summary>GeM — up to ₹50,000. Direct purchase, no quotation required.</summary>
    GemDirectPurchase,

    /// <summary>GeM — ₹50,001 to ₹10,00,000. L1 buying through GeM portal.</summary>
    GemL1Buying,

    /// <summary>GeM — above ₹10,00,000. Full GeM bidding process.</summary>
    GemBidding,

    /// <summary>Non-GeM — up to ₹2,00,000. Rule 154 direct purchase with NAC.</summary>
    Rule154DirectPurchase,

    /// <summary>Non-GeM — ₹2,00,001 to ₹25,00,000. Rule 155 market committee.</summary>
    Rule155MarketCommittee,

    /// <summary>Non-GeM — Single Tender Enquiry. Rule 166, PI-selected route.</summary>
    Rule166SingleTender,
}
