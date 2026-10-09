namespace API.Domain.Entities;

public class Announcement
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "job"; // 'job', 'proposal', 'project'
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public decimal FundingAmount { get; set; } = 0.00m;
    public string? PdfPath { get; set; }
    public string? ExternalLink { get; set; }
    public string Status { get; set; } = "active"; // 'active', 'inactive'
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
