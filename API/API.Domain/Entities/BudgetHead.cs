using API.Domain.Enums;

namespace API.Domain.Entities;

public class BudgetHead
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public BudgetHeadName HeadName { get; set; }

    /// <summary>Only meaningful when <see cref="HeadName"/> is <see cref="BudgetHeadName.Other"/>;
    /// null/ignored otherwise. Required (validated in ProjectService) when HeadName == Other,
    /// so reports/PDFs show a real label instead of the literal string "Other".</summary>
    public string? CustomLabel { get; set; }

    public decimal Year1Amount { get; set; }
    public decimal Year2Amount { get; set; }
    public decimal Year3Amount { get; set; }
    public decimal Year4Amount { get; set; }
    public decimal Year5Amount { get; set; }
    public decimal Total { get; set; }
}
