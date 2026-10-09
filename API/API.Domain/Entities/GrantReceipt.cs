using API.Domain.Enums;

namespace API.Domain.Entities;

public class GrantReceipt
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public decimal Amount { get; set; }
    public GrantReceiptType Type { get; set; }
    public Guid? ParentReceiptId { get; set; }
    public OverheadSubHead? SubHead { get; set; }

    /// <summary>
    /// The NEFT/RTGS transaction number for the funds transfer. Payment happens
    /// offline; this is the evidence that it actually landed.
    /// </summary>
    /// <remarks>
    /// BRD A2 blocks an offer letter until payment has been received. A receipt
    /// row alone only records that someone entered one -- a transaction number
    /// is the bank's reference for the transfer, so the recruitment gate keys off
    /// this rather than off the row's existence.
    ///
    /// Nullable because receipts recorded before this was modelled have none, and
    /// backfilling an invented reference would be worse than an honest blank.
    /// </remarks>
    public string? TransactionReference { get; set; }

    /// <summary>How the funds arrived. Null for receipts predating this field.</summary>
    public PaymentMode? PaymentMode { get; set; }

    /// <summary>PFMS Scheme Code or other equivalent identifier.</summary>
    public string? SchemeCode { get; set; }

    /// <summary>Remarks recorded when submitting or creating the grant receipt.</summary>
    public string? Remarks { get; set; }

    /// <summary>
    /// Where this receipt is in its approval chain. Only Approved receipts
    /// count toward the sanctioned-amount sum, toward anything reported as
    /// "grant received", or toward RecruitmentService's payment-received
    /// gate -- existence alone no longer means the money counts.
    /// </summary>
    /// <remarks>
    /// Overhead-split child rows (Type == OverheadSplit, ParentReceiptId
    /// set) do not carry their own meaningful Status -- they inherit the
    /// parent's approval state implicitly via ParentReceiptId. A consumer
    /// filtering child rows must join back to the parent's Status.
    /// </remarks>
    public GrantReceiptStatus Status { get; set; } = GrantReceiptStatus.PendingApproval;

    /// <summary>
    /// The approval chain's own instance (PI -> HOD -> RnC office -> Dean).
    /// Null only for the instant between object construction and
    /// ProjectService.RecordGrantReceiptAsync's RaiseAsync call within the
    /// same method -- never null once persisted, since the row and the
    /// instance are always created in the same transaction.
    /// </summary>
    public Guid? WorkflowInstanceId { get; set; }

    /// <summary>
    /// When the receipt was raised. Added for the dashboard's
    /// pending-actions panel, which needs an age to sort by -- every
    /// receipt before this shipped has no recorded raise time, so this
    /// backfills to the row's own WorkflowInstance.CreatedAt via the
    /// migration's data step, never to DateTimeOffset.UtcNow (which would
    /// make every historical receipt look freshly raised).
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }
}
