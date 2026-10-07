namespace API.Domain.Entities;

/// <summary>
/// An academic department. The unit that <see cref="Enums.AccessScope.Department"/>
/// resolves against.
/// </summary>
/// <remarks>
/// Departments already existed as free text in <c>FacultyProfile.Department</c>,
/// which is not usable as a scoping key: it is unconstrained, covers only
/// faculty, and nothing guarantees it is set. That column stays where it is --
/// it belongs to another slice and other code may read it -- and is backfilled
/// into these rows where the text matches.
/// </remarks>
public class Department
{
    public Guid Id { get; set; }

    /// <summary>Short code, e.g. "CSE". Unique, and what the backfill matches on.</summary>
    public required string Code { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// The department's current head.
    /// </summary>
    /// <remarks>
    /// A pointer here rather than a flag on the user, so "one HOD per
    /// department" is a property of the schema and reassigning is a single
    /// write.
    ///
    /// Nullable because departments do go without a head, and a model that
    /// cannot express a vacancy invites someone to invent one. It is also
    /// separate from the HOD role: holding the role scopes a user to their own
    /// department, while this answers who *heads* a given department. A user can
    /// hold the role without being anyone's head, which is harmless.
    /// </remarks>
    public Guid? HeadUserId { get; set; }

    /// <summary>
    /// Whether belonging to this department confers institute-wide sight.
    /// </summary>
    /// <remarks>
    /// True for the R&amp;C office and normally nothing else. This is what makes a
    /// Dean of Civil Engineering see Civil Engineering while the same Dean role
    /// held in R&amp;C sees every department: institute-wide access is a property
    /// of where someone works, not of how senior they are.
    ///
    /// A flag on the row rather than a comparison against the code "RNC", so an
    /// operator can see and change which departments have it without a code
    /// change, and so the rule is not a string buried in the resolver.
    /// </remarks>
    public bool IsInstituteWide { get; set; }

    public bool IsActive { get; set; } = true;
}
