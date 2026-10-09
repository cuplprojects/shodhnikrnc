using Microsoft.AspNetCore.Identity;

namespace API.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public required string FullName { get; set; }

    /// <summary>
    /// Soft delete. An applicant who is not selected is deactivated rather than
    /// removed, so their application history survives and the same person is
    /// recognised if they apply to another project later -- reapplying sets this
    /// back to true.
    /// </summary>
    /// <remarks>
    /// Email confirmation is deliberately not modelled here:
    /// <see cref="IdentityUser{TKey}.EmailConfirmed"/> already carries it, and a
    /// parallel flag would be a second source of truth.
    /// </remarks>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// The user's department, which <see cref="Enums.AccessScope.Department"/>
    /// resolves against.
    /// </summary>
    /// <remarks>
    /// Nullable: applicants, fellows and office staff need not belong to an
    /// academic department, and a user with no department simply never matches
    /// a Department-scoped permission.
    ///
    /// Distinct from the free-text <c>FacultyProfile.Department</c>, which stays
    /// where it is -- it belongs to another slice, covers only faculty, and is
    /// not guaranteed set, so it cannot carry authorization.
    /// </remarks>
    public Guid? DepartmentId { get; set; }

    /// <summary>
    /// When this account was created. Existing rows have no recoverable true
    /// creation time, so the migration backfills them to the migration's own
    /// apply time -- a sentinel, not a real value, but the field is only ever
    /// used to order accounts created after this feature shipped.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// The user's employee ID, used to display the actor's name instead of their raw user ID
    /// in approval timelines and other user-facing contexts.
    /// </summary>
    /// <remarks>
    /// Nullable: not all users (e.g., applicants, fellows) have an employee ID, and users
    /// may exist before their ID is assigned.
    /// </remarks>
    public string? EmployeeId { get; set; }
}
