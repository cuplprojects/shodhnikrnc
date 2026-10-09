namespace API.Domain.Entities;

/// <summary>
/// A single email's subject + HTML body, keyed by a stable, code-defined Key
/// (e.g. "proposal.approved"). Seeded once per Key by EmailTemplateSeeder,
/// then editable indefinitely by SuperAdmin/Office via the admin UI.
/// </summary>
public class EmailTemplate
{
    public Guid Id { get; set; }

    /// <summary>
    /// Stable lookup key, e.g. "proposal.approved", "indent.rejected". Never
    /// shown to the admin editor -- only Name is.
    /// </summary>
    public required string Key { get; set; }

    /// <summary>Human label in the admin list, e.g. "Proposal Approved".</summary>
    public required string Name { get; set; }

    public required string Subject { get; set; }
    public required string HtmlBody { get; set; }

    /// <summary>
    /// True for a seeded row nobody has edited yet. Flips to false the first
    /// time an admin saves a change -- mirrors AdvertisementTemplate's own
    /// IsSystemDefault convention.
    /// </summary>
    public bool IsSystemDefault { get; set; } = true;

    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}
