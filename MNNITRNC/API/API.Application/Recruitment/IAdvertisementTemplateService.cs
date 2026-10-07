using API.Domain.Enums;

namespace API.Application.Recruitment;

public record AdvertisementTemplateSummary(
    Guid Id,
    string Name,
    bool IsSystemDefault,
    bool IsOwnedByCaller,
    IReadOnlyList<AdvertisementTemplateSectionSummary> Sections);

public record AdvertisementTemplateSectionSummary(
    Guid Id,
    AdvertisementSectionKey Key,
    string Content,
    bool IsIncluded,
    int SortOrder);

public record AdvertisementTemplateSectionInput(
    AdvertisementSectionKey Key,
    string Content,
    bool IsIncluded,
    int SortOrder);

public record ResolvedAdvertisementTemplate(
    IReadOnlyList<ResolvedAdvertisementSection> Sections,
    IReadOnlyList<string> UnresolvedTokens);

public record ResolvedAdvertisementSection(
    AdvertisementSectionKey Key,
    string Content,
    bool IsIncluded,
    int SortOrder);

public interface IAdvertisementTemplateService
{
    Task<IReadOnlyList<AdvertisementTemplateSummary>> ListForUserAsync(
        Guid userId, CancellationToken ct = default);

    Task<Guid> CloneAsync(
        Guid sourceTemplateId, string newName, Guid userId, CancellationToken ct = default);

    Task UpdateAsync(
        Guid templateId, string name, IReadOnlyList<AdvertisementTemplateSectionInput> sections,
        Guid userId, CancellationToken ct = default);

    Task DeleteAsync(Guid templateId, Guid userId, CancellationToken ct = default);

    Task<ResolvedAdvertisementTemplate> ResolveAsync(
        Guid templateId, Guid recruitmentRequestId, Guid piUserId,
        int advertisementNo, DateOnly advertisementDate, CancellationToken ct = default);
}
