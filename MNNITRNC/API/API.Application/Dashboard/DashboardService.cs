using API.Application.Common;
using API.Application.Fellowship;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Travel;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace API.Application.Dashboard;

/// <inheritdoc cref="IDashboardService"/>
public class DashboardService(
    IResearchProposalService proposals,
    IIndentPendingQueryService indents,
    ITravelRequestService travel,
    IFellowshipService fellowship,
    ILeaveService leave,
    IRecruitmentService recruitment,
    IProjectService projects,
    ILogger<DashboardService> logger,
    IWorkflowPendingQueryService? workflowPendingQuery = null,
    IApplicationDbContext? db = null) : IDashboardService
{
    public async Task<IReadOnlyList<PendingActionItem>> ListPendingActionsAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var items = new List<PendingActionItem>();

        await TryAddAsync(items, "ResearchProposal", async () =>
            (await proposals.ListPendingForCallerAsync(userId, roles, ct))
                .Select(p => new PendingActionItem(
                    "ResearchProposal", p.Id, p.Title, p.CurrentStage?.ToString() ?? string.Empty, p.CreatedAt, $"/proposals/{p.Id}")));

        await TryAddAsync(items, "Indent", async () =>
            (await indents.ListPendingForCallerAsync(userId, roles, ct))
                .Select(i => new PendingActionItem(
                    "Indent", i.Id, i.Name, i.CurrentStage.ToString(), i.CreatedAt,
                    // /procurement/:indentType/:indentId requires the concrete
                    // legacy type; a DynamicIndent item (IndentType null, since
                    // it isn't one of the three legacy tables) has no matching
                    // detail route yet, so it falls back to the project page
                    // rather than linking to a route that would 404.
                    i.IndentType is { } indentType
                        ? $"/procurement/{indentType}/{i.Id}"
                        : $"/projects/{i.ProjectId}")));

        await TryAddAsync(items, "Travel", async () =>
            (await travel.ListPendingForCallerAsync(userId, roles, ct))
                .Select(t => new PendingActionItem(
                    // Now that /travel/:id detail route exists in the frontend,
                    // link directly to the travel request detail page.
                    "Travel", t.Id, t.Purpose, t.CurrentStage.ToString(), t.CreatedAt, $"/travel/{t.Id}")));

        await TryAddAsync(items, "ProcessBill", async () =>
            await ListPendingBillsForCallerAsync(userId, roles, ct));

        await TryAddAsync(items, "FellowshipClaim", async () =>
            (await fellowship.ListPendingClaimsForCallerAsync(userId, roles, ct))
                .Select(f => new PendingActionItem(
                    "FellowshipClaim", f.Id, $"{f.ScholarName} — {f.ClaimPeriod}", f.CurrentStage.ToString(), f.CreatedAt, "/fellowship-claims")));

        await TryAddAsync(items, "LeaveRequest", async () =>
            (await leave.ListPendingForCallerAsync(userId, roles, ct))
                .Select(l => new PendingActionItem(
                    "LeaveRequest", l.Id, l.LeaveType.ToString(), l.CurrentStage.ToString(), l.CreatedAt, "/leave-approvals")));

        await TryAddAsync(items, "Advertisement", async () =>
            (await recruitment.ListPendingForCallerAsync(userId, roles, ct))
                .Select(r => new PendingActionItem(
                    "Advertisement", r.Id, r.ProjectTitle ?? "Advertisement", r.Stage.ToString(), r.CreatedAt, $"/recruitments/{r.Id}")));

        await TryAddAsync(items, "Project", async () =>
            (await projects.ListPendingProjectsForCallerAsync(userId, roles, ct))
                .Select(p => new PendingActionItem(
                    "Project", p.Id, p.ProjectTitle, p.CurrentStage?.ToString() ?? p.Status, p.CreatedAt, $"/projects/{p.Id}")));

        await TryAddAsync(items, "GrantReceipt", async () =>
            (await projects.ListPendingGrantReceiptsForCallerAsync(userId, roles, ct))
                .Select(g => new PendingActionItem(
                    "GrantReceipt", g.Id, g.ProjectTitle, g.CurrentStage?.ToString() ?? string.Empty, g.CreatedAt, $"/projects/{g.ProjectId}")));

        await TryAddAsync(items, "Reappropriation", async () =>
            (await projects.ListPendingReappropriationsAsync(userId, roles, ct))
                .Select(r => new PendingActionItem(
                    "Reappropriation", r.Id, r.ProjectTitle, r.CurrentStage ?? string.Empty, r.CreatedAt, 
                    r.CurrentStage == nameof(API.Domain.Enums.WorkflowStage.ReappropriationReturnedToPI) ? $"/projects/{r.ProjectId}" : $"/projects/reappropriations/queue")));

        return items.OrderBy(i => i.CreatedAt).ToList();
    }

    private async Task<IEnumerable<PendingActionItem>> ListPendingBillsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct)
    {
        if (workflowPendingQuery is null || db is null)
        {
            return [];
        }

        var result = new List<PendingActionItem>();
        var visibleProjects = await projects.ListVisibleToAsync(userId, roles, ct);
        if (visibleProjects.Count == 0) return [];
        var visibleProjectIds = visibleProjects.Select(p => p.Id).ToHashSet();

        var reqTypes = new[] { RequestType.Consumable, RequestType.Contingency, RequestType.Equipment, RequestType.DynamicIndent, RequestType.Travel };
        var billInstances = new List<WorkflowInstance>();

        foreach (var reqType in reqTypes)
        {
            var pendingMap = await workflowPendingQuery.ListPendingInstancesAsync(reqType, WorkflowPhase.Bill, roles, userId, ct);
            if (pendingMap.Count > 0)
            {
                var instanceIds = pendingMap.Keys;
                var instances = await db.WorkflowInstances
                    .Where(w => w.Phase == WorkflowPhase.Bill && instanceIds.Contains(w.Id))
                    .ToListAsync(ct);
                billInstances.AddRange(instances);
            }
        }

        // Also check if any bill is in ReturnedToPI stage and caller is project owner
        var returnedBills = await db.WorkflowInstances
            .Where(w => w.Phase == WorkflowPhase.Bill && w.CurrentStage == WorkflowStage.ReturnedToPI)
            .ToListAsync(ct);

        foreach (var rb in returnedBills)
        {
            if (!billInstances.Any(b => b.Id == rb.Id))
            {
                billInstances.Add(rb);
            }
        }

        if (billInstances.Count == 0) return [];

        var requestIds = billInstances.Select(w => w.RequestId).ToHashSet();

        var travelRequests = await db.TravelRequests
            .Where(t => requestIds.Contains(t.Id) && visibleProjectIds.Contains(t.ProjectId))
            .ToDictionaryAsync(t => t.Id, ct);

        var consumableIndents = await db.ConsumableIndents
            .Where(i => requestIds.Contains(i.Id) && visibleProjectIds.Contains(i.ProjectId))
            .ToDictionaryAsync(i => i.Id, ct);

        var contingencyIndents = await db.ContingencyIndents
            .Where(i => requestIds.Contains(i.Id) && visibleProjectIds.Contains(i.ProjectId))
            .ToDictionaryAsync(i => i.Id, ct);

        var equipmentIndents = await db.EquipmentIndents
            .Where(i => requestIds.Contains(i.Id) && visibleProjectIds.Contains(i.ProjectId))
            .ToDictionaryAsync(i => i.Id, ct);

        var dynamicIndents = await db.Indents
            .Where(i => requestIds.Contains(i.Id) && visibleProjectIds.Contains(i.ProjectId))
            .ToDictionaryAsync(i => i.Id, ct);

        foreach (var w in billInstances)
        {
            if (w.RequestType == RequestType.Travel && travelRequests.TryGetValue(w.RequestId, out var tr))
            {
                var refStr = !string.IsNullOrWhiteSpace(tr.BillNo) ? tr.BillNo : tr.OriginalBillReference;
                var title = !string.IsNullOrWhiteSpace(refStr)
                    ? $"Travel Bill ({refStr})"
                    : $"{tr.Purpose ?? tr.Place ?? "Travel Bill"}";
                result.Add(new PendingActionItem(
                    "ProcessBill", tr.Id, title, w.CurrentStage.ToString(), w.CreatedAt, $"/process-bill/travel/{tr.Id}"));
            }
            else if (consumableIndents.TryGetValue(w.RequestId, out var ci))
            {
                var refStr = !string.IsNullOrWhiteSpace(ci.OriginalBillReference) ? $" ({ci.OriginalBillReference})" : "";
                var title = $"Consumable Bill{refStr} - {ci.Name}";
                result.Add(new PendingActionItem(
                    "ProcessBill", ci.Id, title, w.CurrentStage.ToString(), w.CreatedAt, $"/process-bill/Consumable/{ci.Id}"));
            }
            else if (contingencyIndents.TryGetValue(w.RequestId, out var cti))
            {
                var refStr = !string.IsNullOrWhiteSpace(cti.OriginalBillReference) ? $" ({cti.OriginalBillReference})" : "";
                var title = $"Contingency Bill{refStr} - {cti.Name}";
                result.Add(new PendingActionItem(
                    "ProcessBill", cti.Id, title, w.CurrentStage.ToString(), w.CreatedAt, $"/process-bill/Contingency/{cti.Id}"));
            }
            else if (equipmentIndents.TryGetValue(w.RequestId, out var ei))
            {
                var refStr = !string.IsNullOrWhiteSpace(ei.OriginalBillReference) ? $" ({ei.OriginalBillReference})" : "";
                var title = $"Equipment Bill{refStr} - {ei.Name}";
                result.Add(new PendingActionItem(
                    "ProcessBill", ei.Id, title, w.CurrentStage.ToString(), w.CreatedAt, $"/process-bill/Equipment/{ei.Id}"));
            }
            else if (dynamicIndents.TryGetValue(w.RequestId, out var di))
            {
                var indentTypeStr = di.IndentType.ToString();
                var refStr = !string.IsNullOrWhiteSpace(di.OriginalBillReference) ? $" ({di.OriginalBillReference})" : "";
                var title = $"{indentTypeStr} Bill{refStr} - {di.Purpose ?? "Indent"}";
                result.Add(new PendingActionItem(
                    "ProcessBill", di.Id, title, w.CurrentStage.ToString(), w.CreatedAt, $"/process-bill/{indentTypeStr}/{di.Id}"));
            }
        }

        return result;
    }

    private async Task TryAddAsync(
        List<PendingActionItem> items, string requestType, Func<Task<IEnumerable<PendingActionItem>>> fetch)
    {
        try
        {
            items.AddRange(await fetch());
        }
        catch (Exception ex)
        {
            // One request type's failure must not blank the whole dashboard
            // panel -- matching DashboardPage.jsx's existing "Active
            // Projects" tile, which already falls back rather than erroring
            // the page on a failed call. Logged rather than silently
            // swallowed: an unlogged failure here looks identical to "caller
            // genuinely has nothing pending," which is much harder to tell
            // apart from a real bug.
            logger.LogError(ex, "Dashboard pending-actions failed for {RequestType}", requestType);
        }
    }
}
