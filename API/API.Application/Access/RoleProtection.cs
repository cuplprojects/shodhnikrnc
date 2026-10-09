namespace API.Application.Access;

/// <summary>
/// The roles a SuperAdmin may not rename or delete.
/// </summary>
/// <remarks>
/// Not caution for its own sake. Phase 7 stores workflow stage
/// <c>AllowedRoles</c> as role <em>names</em>, and several controllers still
/// name roles in attributes. Renaming "Dean" would silently orphan every stage
/// granting it: the engine would refuse those stages with no visible cause, and
/// nothing would point back at the rename.
///
/// Custom roles carry no such references, so they are fully editable.
/// </remarks>
public static class RoleProtection
{
    /// <summary>The roles seeded by the application, in creation order.</summary>
    public static readonly string[] Seeded =
    [
        "Faculty", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean",
        "Applicant", "Fellow", "Director", "SuperAdmin", "HOD",
    ];

    public static bool IsProtected(string roleName) =>
        Seeded.Contains(roleName, StringComparer.OrdinalIgnoreCase);
}
