using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <inheritdoc cref="IWorkflowDefinitionService"/>
/// <remarks>
/// Registered scoped, and the cache is per instance -- so it spans one request,
/// not the process. A single transition looks the route up several times (the
/// current stage, then the next), and re-querying for each would be wasteful;
/// caching for longer would mean a SuperAdmin's edit did not take effect until
/// the process recycled, which would defeat the point of making the route
/// editable at all.
/// </remarks>
public class WorkflowDefinitionService(IApplicationDbContext db) : IWorkflowDefinitionService
{
    private readonly Dictionary<(RequestType, WorkflowPhase), WorkflowDefinition> _cache = [];

    public async Task<WorkflowDefinition> GetAsync(
        RequestType requestType, WorkflowPhase phase, CancellationToken ct = default)
    {
        if (_cache.TryGetValue((requestType, phase), out var cached))
        {
            // Even if cached, ensure stages are loaded
            if (cached.Stages.Count == 0)
            {
                _cache.Remove((requestType, phase));
            }
            else
            {
                return cached;
            }
        }

        // Always load fresh from database, explicitly loading stages
        var definition = await db.WorkflowDefinitions
            .Where(d => d.RequestType == requestType && d.Phase == phase && d.IsActive)
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(ct);

        if (definition == null || definition.Stages.Count == 0)
        {
            definition = WorkflowDefinitionSeeder.BuildShippedRoute(requestType, phase);
        }

        _cache[(requestType, phase)] = definition;
        return definition;
    }

    public async Task<WorkflowStageDefinition> GetStageAsync(
        RequestType requestType, WorkflowPhase phase, WorkflowStage stage, CancellationToken ct = default)
    {
        var definition = await GetAsync(requestType, phase, ct);

        return definition.Stages.FirstOrDefault(s => s.Stage == stage)
            ?? throw new WorkflowConfigurationException(
                $"The workflow definition for '{requestType}' ({phase}) has no stage '{stage}'. " +
                "An instance currently at that stage cannot proceed until the route includes it.");
    }

    public async Task<WorkflowStageDefinition?> GetNextStageAsync(
        RequestType requestType, WorkflowPhase phase, WorkflowStage stage, CancellationToken ct = default)
    {
        var definition = await GetAsync(requestType, phase, ct);
        var current = await GetStageAsync(requestType, phase, stage, ct);

        // By sequence rather than by list position: the stages are a set, and
        // nothing guarantees the order they were loaded in.
        return definition.Stages
            .Where(s => s.Sequence > current.Sequence)
            .OrderBy(s => s.Sequence)
            .FirstOrDefault();
    }
}
