namespace API.Domain.Entities;

public class PaymentVoucherAccountDetails
{
    public Guid Id { get; set; }
    public string PayeeName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountNo { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? CreatedBy { get; set; }
}
