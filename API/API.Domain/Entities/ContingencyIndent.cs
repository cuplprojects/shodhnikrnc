using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// Field-for-field identical to <see cref="ConsumableIndent"/>. The spec chose
/// three parallel entities over a shared base so each indent type can diverge
/// independently; this duplication is the accepted cost of that decision.
/// </summary>
public class ContingencyIndent
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public Guid WorkflowInstanceId { get; set; }

    public required string Name { get; set; }
    public required string TechnicalSpecs { get; set; }
    public required string UnitOfMeasurement { get; set; }
    public int Quantity { get; set; }
    public required string Purpose { get; set; }
    public GemAvailability GemAvailability { get; set; }
    public decimal EstimatedCost { get; set; }

    public string? NonAvailabilityCertificateNumber { get; set; }
    public DateOnly? NonAvailabilityCertificateIssueDate { get; set; }
    public DateOnly? NonAvailabilityCertificateValidityDate { get; set; }

    public string? StockBookPage { get; set; }
    public string? StockDescription { get; set; }
    public string? StockQuantity { get; set; }
    public string? StockActualCost { get; set; }
    public string? StockCondition { get; set; }

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

    public string? PaymentRouting { get; set; } = "Party Payment";
    public decimal? MiscellaneousExpenditure { get; set; }
    public string? BiddingNumber { get; set; }
    public DateOnly? BidPublicationDate { get; set; }
    public string? PurchaseOrderNumber { get; set; }
    public DateOnly? PurchaseOrderDate { get; set; }
    public string? BindingLocation { get; set; } = "Prayagraj";
    public string? ComparativeStatementNumber { get; set; }
    public bool ComparativeStatementSigned { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
