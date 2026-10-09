using System.ComponentModel.DataAnnotations.Schema;

namespace API.Domain.Entities;

public class Noting
{
    public Guid Id { get; set; }
    public string FundedAgency { get; set; } = string.Empty;
    public string ProjectTitle { get; set; } = string.Empty;
    public string ProjectNo { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public string Status { get; set; } = "Pending Approval";
    public string? CurrentStage { get; set; } = "Pending Document Upload";
    public string? SignedFilesJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    [Column("NotingFormateTextChanges")]
    public string? NotingFormatTextChanges { get; set; }

    [NotMapped]
    public string? NewNotingFormatTextChanges
    {
        get => NotingFormatTextChanges;
        set => NotingFormatTextChanges = value;
    }

    public ICollection<NotingItem> Items { get; set; } = new List<NotingItem>();
}
