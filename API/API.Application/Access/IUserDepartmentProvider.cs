namespace API.Application.Access;

/// <summary>
/// The department a user belongs to, which decides whether their
/// Department-scoped permissions widen to institute-wide.
/// </summary>
/// <remarks>
/// A seam for the same reason as IUserRoleProvider: the application layer does
/// not reference ASP.NET Identity, and this keeps the access service testable
/// without a real user store.
/// </remarks>
public interface IUserDepartmentProvider
{
    Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default);
}
