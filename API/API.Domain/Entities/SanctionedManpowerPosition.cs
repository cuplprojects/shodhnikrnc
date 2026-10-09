namespace API.Domain.Entities;

public class SanctionedManpowerPosition
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Designation { get; set; }
    public int Positions { get; set; }
    public decimal Stipend { get; set; }
    public decimal Hra { get; set; }
}
