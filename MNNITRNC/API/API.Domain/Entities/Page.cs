namespace API.Domain.Entities;

/// <summary>
/// One page of the application, and the unit permissions are granted on.
/// </summary>
public class Page
{
    public Guid Id { get; set; }
    public Guid ModuleId { get; set; }

    /// <summary>Stable identifier, e.g. "projects.edit". Never renamed.</summary>
    public required string Key { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// The React route pattern, e.g. "/projects/:id/edit". What the route guard
    /// matches a browser location against.
    /// </summary>
    public required string Route { get; set; }

    /// <summary>
    /// Whether this page appears in the sidebar.
    /// </summary>
    /// <remarks>
    /// False for detail pages reached from elsewhere -- project detail, indent
    /// detail, the profile page. They still need a permission, which is why the
    /// model keys off routes rather than sidebar entries: a survey found 40
    /// routes against 24 links, and keying off links would have left
    /// /procurement, /recruitment, /profile and /travel/:id ungoverned.
    /// </remarks>
    public bool IsNavigable { get; set; } = true;

    public int DisplayOrder { get; set; }

    public Module? Module { get; set; }
}
