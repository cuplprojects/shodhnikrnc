using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// An exception for one user on one page, overriding what their roles give them.
/// </summary>
/// <remarks>
/// Deny beats Grant beats role. An explicit deny has to be the strongest signal:
/// otherwise revoking one person's access to one page would mean editing every
/// role they hold, and taking access from everyone else who holds it.
/// </remarks>
public class UserPageGrant
{
    public Guid UserId { get; set; }
    public Guid PageId { get; set; }

    public GrantEffect Effect { get; set; }

    /// <summary>
    /// The scope this grant confers. Ignored when <see cref="Effect"/> is Deny,
    /// which removes access outright rather than narrowing it.
    /// </summary>
    public AccessScope Scope { get; set; } = AccessScope.Own;

    /// <summary>
    /// Why this exception exists. Required.
    /// </summary>
    /// <remarks>
    /// Per-user exceptions are the part of an access system that rots: they
    /// accumulate, outlive their reason, and nobody dares remove them because
    /// nobody knows why they are there. One text field makes an audit
    /// answerable a year later.
    /// </remarks>
    public required string Reason { get; set; }

    public Guid GrantedByUserId { get; set; }
    public DateTimeOffset GrantedAt { get; set; }

    public Page? Page { get; set; }
}
