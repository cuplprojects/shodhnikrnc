namespace API.Application.NewsEvents;

public record CreateNewsEventRequest(
    string Title,
    string Type,
    string Content,
    DateOnly? EventDate,
    string? ImagePath,
    List<string>? AdditionalImages
);

public record UpdateNewsEventRequest(
    string Title,
    string Type,
    string Content,
    DateOnly? EventDate,
    string? ImagePath,
    List<string>? AdditionalImages
);

public record NewsEventResponse(
    int Id,
    string Title,
    string Type,
    string Content,
    DateOnly? EventDate,
    string? ImagePath,
    List<string> AdditionalImages,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
