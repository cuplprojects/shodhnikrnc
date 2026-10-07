using API.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

/// <summary>
/// Counts the workflow stages that grant a role, so deleting one in use can be
/// refused with a number rather than a vague warning.
/// </summary>
/// <remarks>
/// The same shape as the Phase 7 validator's rule 5: refuse the destructive
/// edit, and say how much is at stake. A role deleted out from under a stage
/// leaves that stage granting a name nobody holds, which the engine reports as
/// "not permitted" with nothing pointing back at the cause.
/// </remarks>
public class RoleDeletionGuard(IApplicationDbContext db)
{
    public async Task<int> StagesGrantingAsync(string roleName, CancellationToken ct = default)
    {
        // AllowedRoles is a delimited string, so the comparison happens in
        // memory: a SQL LIKE would match "Dean" inside "DeanOfStudents" and
        // refuse a deletion for a reason nobody could see.
        var stages = await db.WorkflowStageDefinitions
            .Select(s => s.AllowedRoles)
            .ToListAsync(ct);

        return stages.Count(allowed => allowed
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(roleName, StringComparer.OrdinalIgnoreCase));
    }
}
