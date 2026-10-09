namespace API.Domain.Entities;

public class SanctionedEquipment
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public required string Unit { get; set; }
    public decimal Amount { get; set; }
}
