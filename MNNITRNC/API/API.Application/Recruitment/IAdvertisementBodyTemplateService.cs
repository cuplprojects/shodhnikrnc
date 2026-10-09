namespace API.Application.Recruitment;

public record AdvertisementBodyTemplateSummary(
    Guid Id, string Name, string HtmlBody, DateTimeOffset CreatedAt);

public interface IAdvertisementBodyTemplateService
{
    Task<IReadOnlyList<AdvertisementBodyTemplateSummary>> ListForUserAsync(
        Guid userId, CancellationToken ct = default);

    Task<Guid> CreateAsync(
        Guid userId, string name, string htmlBody, CancellationToken ct = default);

    Task DeleteAsync(Guid templateId, Guid userId, CancellationToken ct = default);
}
