namespace API.Domain.Entities;

public class ReappropriationSourceLine
{
    public Guid Id { get; set; }
    public Guid ReappropriationRequestId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public required string HeadName { get; set; }
    public decimal Amount { get; set; }
}
