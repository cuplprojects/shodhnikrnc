namespace API.Domain.Entities;

/// <summary>
/// A PI's saved advertisement body -- the full rich-text HTML they wrote in
/// the "Generate Advertisement" editor, named and reusable across different
/// recruitments. Distinct from the older, unused section/token-based
/// <see cref="AdvertisementTemplate"/>: the editor is now a single free-form
/// HTML blob, so a template here is just that blob plus a name and its owner.
/// </summary>
public class AdvertisementBodyTemplate
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public required string Name { get; set; }
    public required string HtmlBody { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
