namespace API.Domain.Entities;

public class PaymentVoucherItem
{
    public Guid Id { get; set; }
    public Guid PaymentVoucherId { get; set; }
    public Guid? BudgetHeadId { get; set; }
    public Guid? FellowshipClaimId { get; set; }
    public string? LetterNoDateMbNo { get; set; }
    public string SupplierInvoiceGoods { get; set; } = string.Empty;
    public string HeadCategory { get; set; } = "Consumable";
    public decimal CurrentHeadBalance { get; set; }
    public decimal BillAmount { get; set; }
    public decimal TdsGst { get; set; }
    public decimal TdsIt { get; set; }
    public decimal BalanceAfterPayment { get; set; }
}
