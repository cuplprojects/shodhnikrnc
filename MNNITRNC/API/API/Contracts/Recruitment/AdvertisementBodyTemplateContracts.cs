namespace API.Contracts.Recruitment;

public record AdvertisementBodyTemplateResponse(
    Guid Id, string Name, string HtmlBody, DateTimeOffset CreatedAt);

public record CreateAdvertisementBodyTemplateRequest(string Name, string HtmlBody);
