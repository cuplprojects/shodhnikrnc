namespace API.Domain.Entities;

public class NewsEvent
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public DateOnly? EventDate { get; set; }
    public string Type { get; set; } = "news";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<NewsImage> Images { get; set; } = new List<NewsImage>();
}
