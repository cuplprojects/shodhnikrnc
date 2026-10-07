using API.Application.Workflow;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Workflow;

/// <inheritdoc cref="IWorkflowRoleCatalogue"/>
public class WorkflowRoleCatalogue(RoleManager<IdentityRole<Guid>> roleManager) : IWorkflowRoleCatalogue
{
    public async Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default) =>
        await roleManager.Roles
            .Select(r => r.Name!)
            .Where(n => n != null)
            .ToListAsync(ct);
}
