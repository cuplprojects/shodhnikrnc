namespace API.Domain.Entities;

/// <summary>
/// A PI's reusable advertisement wording. The single system-seeded
/// template (OwnerUserId null, IsSystemDefault true) can be cloned by any
/// PI into their own editable copy, but is never edited in place.
/// </summary>
public class AdvertisementTemplate
{
    public Guid Id { get; set; }
    public Guid? OwnerUserId { get; set; }
    public required string Name { get; set; }
    public bool IsSystemDefault { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<AdvertisementTemplateSection> Sections { get; set; } = [];
}
