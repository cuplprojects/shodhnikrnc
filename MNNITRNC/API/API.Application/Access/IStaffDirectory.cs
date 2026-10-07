namespace API.Application.Access;

/// <summary>One row: a user, the (single) role this listing groups by, and
/// their department.</summary>
public record StaffMember(Guid UserId, string RoleName, Guid? DepartmentId);

/// <summary>
/// Every active user's role and department, for the staff-count report
/// (BRD Prompt 6 / A10). A seam for the same reason as
/// <see cref="IUserDepartmentProvider"/>: the application layer does not
/// reference ASP.NET Identity, and this keeps the reporting service testable
/// without a real user store.
/// </summary>
public interface IStaffDirectory
{
    /// <summary>
    /// One row per (user, role) pair -- a user holding two roles appears
    /// twice, once per role, since a headcount by role must not silently
    /// collapse someone who holds both HOD and Faculty into a single count
    /// that only reflects one of them.
    /// </summary>
    Task<IReadOnlyList<StaffMember>> GetAllAsync(CancellationToken ct = default);
}
