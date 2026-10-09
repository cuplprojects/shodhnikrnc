using API.Domain.Enums;

namespace API.Contracts.Recruitment;

public record AdvertisementTemplateSectionResponse(
    Guid Id, AdvertisementSectionKey Key, string Content, bool IsIncluded, int SortOrder);

public record AdvertisementTemplateResponse(
    Guid Id, string Name, bool IsSystemDefault, bool IsOwnedByCaller,
    IReadOnlyList<AdvertisementTemplateSectionResponse> Sections);

public record CloneTemplateRequest(string NewName);

public record UpdateTemplateSectionRequest(
    AdvertisementSectionKey Key, string Content, bool IsIncluded, int SortOrder);

public record UpdateTemplateRequest(string Name, IReadOnlyList<UpdateTemplateSectionRequest> Sections);

public record ResolveTemplateRequest(int AdvertisementNo, DateOnly AdvertisementDate);

public record ResolvedSectionResponse(
    AdvertisementSectionKey Key, string Content, bool IsIncluded, int SortOrder);

public record ResolvedTemplateResponse(
    IReadOnlyList<ResolvedSectionResponse> Sections, IReadOnlyList<string> UnresolvedTokens);
