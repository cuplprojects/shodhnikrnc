using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Enums;

namespace API.Application.Procurement;

/// <inheritdoc cref="IIndentPendingQueryService"/>
/// <remarks>
/// Each concrete indent service's ListForProjectAsync already merges in the
/// DynamicIndent rows sharing its own IndentType (see
/// IndentServiceBase.ListForProjectAsync's `i.IndentType == IndentType`
/// filter) -- so calling all three legacy services per visible project
/// already covers all four RequestType values with no duplication, and no
/// separate DynamicIndent-only branch is needed here.
/// </remarks>
public class IndentPendingQueryService(
    IWorkflowPendingQueryService pendingQuery,
    IProjectService projectService,
    ConsumableIndentService consumableIndents,
    ContingencyIndentService contingencyIndents,
    EquipmentIndentService equipmentIndents) : IIndentPendingQueryService
{
    public async Task<IReadOnlyList<IndentSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var visibleProjects = await projectService.ListVisibleToAsync(userId, roles, ct);
        if (visibleProjects.Count == 0)
        {
            return [];
        }

        var pendingByType = new Dictionary<RequestType, IReadOnlyDictionary<Guid, WorkflowStage>>();
        foreach (var requestType in new[] { RequestType.Consumable, RequestType.Contingency, RequestType.Equipment, RequestType.DynamicIndent })
        {
            pendingByType[requestType] = await pendingQuery.ListPendingInstancesAsync(
                requestType, WorkflowPhase.Indent, roles, userId, ct);
        }

        if (pendingByType.Values.All(d => d.Count == 0))
        {
            return [];
        }

        var results = new List<IndentSummary>();
        var services = new IIndentService[] { consumableIndents, contingencyIndents, equipmentIndents };
        foreach (var project in visibleProjects)
        {
            foreach (var service in services)
            {
                IReadOnlyList<IndentSummary> items;
                try
                {
                    items = await service.ListForProjectAsync(project.Id, userId, roles, ct);
                }
                catch (ProjectAccessDeniedException)
                {
                    // ListVisibleToAsync already scoped this to projects the
                    // caller may see, but ListForProjectAsync re-checks
                    // independently -- if the two ever disagree, skip rather
                    // than throw, since one project's access quirk must not
                    // blank the whole aggregation.
                    continue;
                }

                foreach (var item in items)
                {
                    // An IndentSummary's own RequestType is not part of its
                    // record -- infer it from which pendingByType dictionary
                    // contains its WorkflowInstanceId, since a project's
                    // items span every legacy type plus DynamicIndent, all
                    // merged into one list by ListForProjectAsync already.
                    var isPending = pendingByType.Values.Any(d => d.ContainsKey(item.WorkflowInstanceId));
                    if (isPending)
                    {
                        results.Add(item);
                    }
                }
            }
        }

        return results;
    }
}
