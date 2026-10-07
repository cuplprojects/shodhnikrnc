namespace API.Application.Announcements;

public record CreateAnnouncementRequest(
    string Title,
    string? Description,
    string Category,
    DateOnly? StartDate,
    DateOnly? EndDate,
    decimal FundingAmount,
    string? PdfPath,
    string? ExternalLink,
    string Status,
    int? CreatedBy
);

public record UpdateAnnouncementRequest(
    string Title,
    string? Description,
    string Category,
    DateOnly? StartDate,
    DateOnly? EndDate,
    decimal FundingAmount,
    string? PdfPath,
    string? ExternalLink,
    string Status
);

public record AnnouncementResponse(
    int Id,
    string Title,
    string? Description,
    string Category,
    DateOnly? StartDate,
    DateOnly? EndDate,
    decimal FundingAmount,
    string? PdfPath,
    string? ExternalLink,
    string Status,
    int? CreatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
