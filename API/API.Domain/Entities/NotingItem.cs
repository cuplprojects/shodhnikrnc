namespace API.Domain.Entities;

public class NotingItem
{
    public Guid Id { get; set; }
    public Guid NotingId { get; set; }
    public Guid? FellowshipClaimId { get; set; }
    public int SlNo { get; set; }
    public string NameOfItem { get; set; } = string.Empty;
    public string IndentNoAndDate { get; set; } = string.Empty;
    public string BudgetHeadAndBalance { get; set; } = string.Empty;
    public string IndentAmount { get; set; } = string.Empty;
    public string ModeOfPurchase { get; set; } = string.Empty;

    public Noting? Noting { get; set; }
}
