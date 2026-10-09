namespace API.Domain.Entities;

public class NewsImage
{
    public int Id { get; set; }
    public int NewsId { get; set; }
    public string ImagePath { get; set; } = string.Empty;
    public bool IsTitle { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public NewsEvent? NewsEvent { get; set; }
}
