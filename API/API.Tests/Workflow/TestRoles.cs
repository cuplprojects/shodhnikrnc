namespace API.Tests;

/// <summary>
/// Role sets for driving workflow transitions in tests, matching the seeded
/// route in <c>WorkflowDefinitionSeeder.ShippedRoute</c>.
/// </summary>
/// <remarks>
/// Named for the stage each set acts at rather than listed inline, so a test
/// reads as "the office forwards this" rather than repeating three role strings.
/// From Task 7 the engine checks these against the stage's AllowedRoles, so a
/// test passing the wrong set will fail -- which is the point: the roles a test
/// supplies are part of what it asserts, not boilerplate.
/// </remarks>
public static class TestRoles
{
    /// <summary>
    /// The initial stage has no roles: it belongs to whoever raised the request.
    /// Upload-signed-copy and cancel are the raiser's own actions.
    /// </summary>
    public static readonly IReadOnlyCollection<string> Raiser = [];

    /// <summary>Approve, reject and forward-to-director.</summary>
    public static readonly IReadOnlyCollection<string> Dean = ["Dean"];

    /// <summary>The Director, who shares the Dean's decision stages.</summary>
    public static readonly IReadOnlyCollection<string> Director = ["Director"];

    /// <summary>
    /// SignedCopyUploaded, the stage Assign moves an instance off. Narrowed
    /// from the old shared five-role forwarding group to HOD alone by the
    /// 2026-09-09 indent-workflow-and-role-scoping plan.
    /// </summary>
    public static readonly IReadOnlyCollection<string> Hod = ["HOD"];

    /// <summary>
    /// The forwarding stages (Assigned, Forwarded, ForwardedOSRC). Each is now
    /// scoped to its own single role by the 2026-09-09
    /// indent-workflow-and-role-scoping plan -- RegularStaff, Superintendent,
    /// and DeputyRegistrar respectively -- but this set still carries all
    /// three so existing calls that don't care which specific office role
    /// acts keep working: RequireRoleAsync only needs one role in common with
    /// the stage's AllowedRoles, and each of the three stages accepts exactly
    /// one of these.
    /// </summary>
    public static readonly IReadOnlyCollection<string> Office =
        ["RegularStaff", "Superintendent", "DeputyRegistrar"];
}
