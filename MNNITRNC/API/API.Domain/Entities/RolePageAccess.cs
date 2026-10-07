using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A role's permission on a page, and how far its data reaches.
/// </summary>
/// <remarks>
/// Keyed on the role's <c>Guid</c> rather than its name, unlike Phase 7's
/// workflow stages which store names. Names are what make a rename dangerous
/// there; here a rename is harmless.
/// </remarks>
public class RolePageAccess
{
    public Guid RoleId { get; set; }
    public Guid PageId { get; set; }

    /// <summary>Own, Department or Institute — see <see cref="AccessScope"/>.</summary>
    public AccessScope Scope { get; set; } = AccessScope.Own;

    public Page? Page { get; set; }
}
