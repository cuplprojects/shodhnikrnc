using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One named, optionally-excludable section of a template's content.
/// Content carries {{Token}} placeholders resolved at generation time by
/// AdvertisementTokenResolver (Task 2).
/// </summary>
public class AdvertisementTemplateSection
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public AdvertisementSectionKey Key { get; set; }
    public required string Content { get; set; }
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public AdvertisementTemplate? Template { get; set; }
}
