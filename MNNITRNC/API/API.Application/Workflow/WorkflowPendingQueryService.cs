using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <inheritdoc cref="IWorkflowPendingQueryService"/>
public class WorkflowPendingQueryService(
    IApplicationDbContext db,
    IWorkflowDefinitionService definitions) : IWorkflowPendingQueryService
{
    public async Task<IReadOnlyDictionary<Guid, WorkflowStage>> ListPendingInstancesAsync(
        RequestType requestType,
        WorkflowPhase phase,
        IReadOnlyCollection<string> callerRoles,
        Guid? callerUserId = null,
        CancellationToken ct = default)
    {
        WorkflowDefinition definition;
        try
        {
            definition = await definitions.GetAsync(requestType, phase, ct);
        }
        catch (WorkflowConfigurationException)
        {
            // No route defined for this pair -- nothing can be pending on it.
            return new Dictionary<Guid, WorkflowStage>();
        }

        var matchingStages = definition.Stages
            .Where(s => s.AllowedRoleList().Count > 0
                     && callerRoles.Any(r => s.AllowedRoleList().Contains(r, StringComparer.OrdinalIgnoreCase)))
            .Select(s => s.Stage)
            .ToHashSet();

        if (matchingStages.Count == 0)
        {
            return new Dictionary<Guid, WorkflowStage>();
        }

        var query = db.WorkflowInstances
            .Where(w => w.RequestType == requestType && w.Phase == phase && matchingStages.Contains(w.CurrentStage));

        // Mirrors WorkflowEngineService.RequireRoleAsync's narrowing rule: at
        // a RegularStaff-listed stage, an instance DA-locked via the project's
        // permanent Dealing Assistant is only pending for that DA (or for a
        // caller holding one of RolesNotNarrowedByAssignment). Manually
        // assigned instances (IsAssignedViaProjectDa == false) are unaffected.
        if (!callerRoles.Any(r => WorkflowEngineService.RolesNotNarrowedByAssignment.Contains(r)))
        {
            var narrowedStages = definition.Stages
                .Where(s => matchingStages.Contains(s.Stage)
                         && s.AllowedRoleList().Contains("RegularStaff", StringComparer.OrdinalIgnoreCase))
                .Select(s => s.Stage)
                .ToHashSet();

            if (narrowedStages.Count > 0)
            {
                query = query.Where(w => !narrowedStages.Contains(w.CurrentStage)
                                      || !w.IsAssignedViaProjectDa
                                      || w.AssignedToUserId == callerUserId);
            }
        }

        return await query.ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);
    }
}
