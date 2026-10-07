namespace API.Domain.Entities;

/// <summary>
/// Log entry for budget head redistribution / reappropriation under a research project (BRD §A1 / §A7).
/// </summary>
public class BudgetReappropriationLog
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? FromHeadId { get; set; }
    public required string FromHeadName { get; set; }
    public Guid? ToHeadId { get; set; }
    public required string ToHeadName { get; set; }
    public decimal Amount { get; set; }
    public required string Reason { get; set; }
    public Guid PerformedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
