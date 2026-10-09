namespace API.Domain.Entities;

/// <summary>
/// A grouping of pages, for the sidebar and the permission editor.
/// </summary>
/// <remarks>
/// Deliberately not a unit of permission. Permissions are stored per
/// <see cref="Page"/>; the module checkbox in the admin UI ticks its pages and
/// shows indeterminate when only some are on.
///
/// Storing module-level grants alongside page grants was considered and
/// rejected: "why can this user see X" would have two possible answers, and
/// "all of Projects except the edit page" could not be expressed at all.
/// </remarks>
public class Module
{
    public Guid Id { get; set; }

    /// <summary>
    /// Stable identifier, e.g. "projects". Never renamed.
    /// </summary>
    /// <remarks>
    /// Sidebar labels drift -- "Manage News &amp; Events" already does not match
    /// its route -- and permission rows must not follow a label change. This is
    /// the identity; <see cref="Name"/> is display.
    /// </remarks>
    public required string Key { get; set; }

    public required string Name { get; set; }

    /// <summary>Sidebar grouping: Faculty, Fellow, Office, Admin.</summary>
    public required string Group { get; set; }

    public int DisplayOrder { get; set; }

    public ICollection<Page> Pages { get; set; } = new List<Page>();
}
