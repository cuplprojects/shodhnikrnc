namespace API.Domain.Entities;

public class PaymentVoucher
{
    public Guid Id { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? IndentId { get; set; }
    public string VoucherNo { get; set; } = string.Empty;
    public string VoucherType { get; set; } = "upto100k"; // 'upto100k' | 'above100k'
    public DateOnly Date { get; set; }
    public decimal TaxableAmount { get; set; }
    public decimal PayableAmount { get; set; }
    public decimal Amount { get; set; }
    public bool ShowTdsGst { get; set; }
    public decimal TdsGstRate { get; set; } = 2m;
    public bool ShowTdsIt { get; set; }
    public decimal TdsItRate { get; set; } = 2m;
    public string BankAccountNo { get; set; } = string.Empty;
    public string? ChequeNo { get; set; }
    public DateOnly ChequeDate { get; set; }
    public decimal PayRs { get; set; }
    public string CoordinatorNameDept { get; set; } = string.Empty;
    public string ProjectSanctionNo { get; set; } = string.Empty;
    public string? FundingAgency { get; set; }
    public string PaymentTo { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval"; // 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'
    public string CurrentStage { get; set; } = "Office Assistant Verification";
    public string? SignedFilesJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    public ICollection<PaymentVoucherItem> Items { get; set; } = new List<PaymentVoucherItem>();
}
