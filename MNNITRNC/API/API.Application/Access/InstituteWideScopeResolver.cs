using API.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

/// <inheritdoc cref="IInstituteWideScopeResolver"/>
/// <remarks>
/// Deliberately independent of <c>Department.IsActive</c>: that flag says
/// whether a department is current, not who may see what. Conflating them
/// would silently narrow everyone in a department deactivated for an
/// unrelated reason.
/// </remarks>
public class InstituteWideScopeResolver(
    IApplicationDbContext db, IUserDepartmentProvider userDepartment) : IInstituteWideScopeResolver
{
    public async Task<bool> IsInstituteWideAsync(Guid userId, CancellationToken ct = default)
    {
        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        if (departmentId is null)
        {
            return false;
        }

        return await db.Departments.AnyAsync(d => d.Id == departmentId && d.IsInstituteWide, ct);
    }
}
