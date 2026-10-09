using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// The header record for a dynamic indent raised through the new unified
/// Raise Indent form. Covers Consumable, Contingency and Equipment indent
/// types in a single table, distinguished by <see cref="IndentType"/>.
/// </summary>
/// <remarks>
/// Separate from the three legacy parallel tables (ConsumableIndent,
/// ContingencyIndent, EquipmentIndent) which remain in use for historical
/// indents raised through the old form. New indents use this entity.
/// Line items are stored in <see cref="IndentItem"/> rows.
/// </remarks>
public class Indent
{
    public Guid Id { get; set; }

    /// <summary>Human-readable number, e.g. MNIT/RNC/IND/2026-27/0001.</summary>
    public required string IndentNumber { get; set; }

    public IndentType IndentType { get; set; }

    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }

    /// <summary>Set when the workflow instance is created at raise time.</summary>
    public Guid WorkflowInstanceId { get; set; }

    /// <summary>
    /// The heads this Indent draws its cost from. Always has at least one
    /// row after raise. BudgetHeadId (above) mirrors Allocations[0]
    /// .BudgetHeadId for back-compat with code that only knows the single-
    /// head shape (reporting, the legacy flow's own queries).
    /// </summary>
    public List<IndentBudgetHeadAllocation> Allocations { get; set; } = [];

    /// <summary>The PI who raised the indent.</summary>
    public Guid OwnerUserId { get; set; }

    // ── Procurement routing ───────────────────────────────────────────────
    public GemAvailability GemAvailability { get; set; }

    /// <summary>Product or Service. Null for Non-GeM indents.</summary>
    public GemCategoryType? GemCategoryType { get; set; }

    /// <summary>
    /// Server-computed from GemAvailability + total item cost.
    /// Stored so document generation and approval routing always agree.
    /// </summary>
    public IndentProcurementRule ProcurementRule { get; set; }

    // ── Stock availability (captured at creation, not bill time) ──────────
    public StockAvailability StockAvailability { get; set; }
    public string? StockBookSerialNo { get; set; }
    public string? StockBookPage { get; set; }
    public DateOnly? StockBookDate { get; set; }
    public string? StockDescription { get; set; }
    public string? StockQuantity { get; set; }
    public string? StockActualCost { get; set; }
    public string? StockCondition { get; set; }

    // ── Purpose ───────────────────────────────────────────────────────────
    public required string Purpose { get; set; }
    public PurposeOfAcquiring? PurposeOfAcquiring { get; set; }

    // ── Additional information ────────────────────────────────────────────
    public bool InstallationRequired { get; set; }
    public bool TrainingRequired { get; set; }
    public string? QualificationCriterion { get; set; }
    public string? MaxDeliveryPeriod { get; set; }
    public int? NumberOfEnclosures { get; set; }
    public string? PerpetualLicense { get; set; }

    // ── Rule 154 — Non-GeM direct purchase (≤ ₹2,00,000) ────────────────
    public string? NonAvailabilityCertificateNumber { get; set; }
    public DateOnly? NonAvailabilityCertificateIssueDate { get; set; }
    public DateOnly? NonAvailabilityCertificateValidityDate { get; set; }
    public DateOnly? QuotationDate { get; set; }

    // ── Rule 155 — Non-GeM market committee (₹2,00,001 – ₹25,00,000) ────
    /// <summary>
    /// The faculty member selected by the PI as Committee Member #2.
    /// FK to FacultyProfiles.UserId (string, not Guid — matches legacy schema).
    /// </summary>
    public string? CommitteeFacultyUserId { get; set; }

    // ── GeM bidding (> ₹10,00,000) ───────────────────────────────────────
    public string? BiddingNumber { get; set; }
    public DateOnly? BidPublicationDate { get; set; }

    // ── Payment / purchase (filled post-approval by DA) ───────────────────
    public string? PaymentRouting { get; set; } = "Party Payment";
    public string? PurchaseOrderNumber { get; set; }
    public DateOnly? PurchaseOrderDate { get; set; }
    public string? BindingLocation { get; set; } = "Prayagraj";
    public string? ComparativeStatementNumber { get; set; }
    public bool ComparativeStatementSigned { get; set; }
    public decimal? MiscellaneousExpenditure { get; set; }

    // ── Bill fields (populated when bill is processed) ───────────────────
    public string? BillNo { get; set; }
    public string? OriginalBillReference { get; set; }
    public decimal? BillAmount { get; set; }
    public DateOnly? GenerationDate { get; set; }
    public DateOnly? ItemReceivingDate { get; set; }
    public string? BillProcessStatus { get; set; }
    public string? BillFileUrl { get; set; }
    public string? EWayBillFileUrl { get; set; }
    public string? SatisfactoryCertificateFileUrl { get; set; }
    public bool StockEntryConfirmed { get; set; }
    public string? EWayBillNumber { get; set; }
    public string? EWayBillPartA { get; set; }
    public string? EWayBillPartB { get; set; }
    public string? MeasurementBookNumber { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // ── Navigation ────────────────────────────────────────────────────────
    public ICollection<IndentItem> Items { get; set; } = new List<IndentItem>();
}
