// API.Application/Workflow/WorkflowRequesterResolver.cs
using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Resolves "who raised this request" from a WorkflowInstance's
/// RequestType/RequestId, and the email-template-key prefix for that
/// module. There is no shared "requester" field across the entities these
/// RequestTypes point to -- three distinct shapes exist (a direct owner
/// field, a ProjectId join, or a FellowAppointmentId join) -- so this is a
/// deliberate per-RequestType switch, not a generic abstraction.
///
/// RequestType.ManpowerDocument and RequestType.Advertisement (Recruitment's
/// two chains) are deliberately NOT handled here -- both return null/no
/// prefix, since Recruitment's approval flow is out of scope for this
/// feature (see docs/superpowers/specs/2026-09-17-approval-email-notifications-design.md).
/// </summary>
public interface IWorkflowRequesterResolver
{
    Task<Guid?> ResolveRequesterUserIdAsync(RequestType requestType, Guid requestId, CancellationToken ct = default);
    string? ResolveTemplateKeyPrefix(RequestType requestType);

    /// <summary>
    /// A short, human-readable display value for the request (proposal title,
    /// indent number, etc.) used to fill each module's second email
    /// placeholder (beyond RequesterName/PortalLink). Null when the request
    /// (or, for Recruitment, the RequestType itself) isn't found/supported.
    /// </summary>
    Task<string?> ResolveDisplayTitleAsync(RequestType requestType, Guid requestId, CancellationToken ct = default);
}

public class WorkflowRequesterResolver(IApplicationDbContext db) : IWorkflowRequesterResolver
{
    public async Task<Guid?> ResolveRequesterUserIdAsync(RequestType requestType, Guid requestId, CancellationToken ct = default)
    {
        switch (requestType)
        {
            case RequestType.ProjectUpdate:
                return (await db.Projects.FirstOrDefaultAsync(p => p.Id == requestId, ct))?.OwnerUserId;

            case RequestType.ResearchProposal:
                return (await db.ResearchProposals.FirstOrDefaultAsync(p => p.Id == requestId, ct))?.OwnerUserId;

            case RequestType.DynamicIndent:
                return (await db.Indents.FirstOrDefaultAsync(i => i.Id == requestId, ct))?.OwnerUserId;

            case RequestType.Consumable:
            {
                var indent = await db.ConsumableIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct);
                return indent is null ? null : await ResolveViaProjectAsync(indent.ProjectId, ct);
            }

            case RequestType.Contingency:
            {
                var indent = await db.ContingencyIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct);
                return indent is null ? null : await ResolveViaProjectAsync(indent.ProjectId, ct);
            }

            case RequestType.Equipment:
            {
                var indent = await db.EquipmentIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct);
                return indent is null ? null : await ResolveViaProjectAsync(indent.ProjectId, ct);
            }

            case RequestType.Travel:
            {
                var travel = await db.TravelRequests.FirstOrDefaultAsync(t => t.Id == requestId, ct);
                return travel is null ? null : await ResolveViaProjectAsync(travel.ProjectId, ct);
            }

            case RequestType.GrantReceipt:
            {
                var receipt = await db.GrantReceipts.FirstOrDefaultAsync(r => r.Id == requestId, ct);
                return receipt is null ? null : await ResolveViaProjectAsync(receipt.ProjectId, ct);
            }

            case RequestType.FellowshipClaim:
            {
                var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == requestId, ct);
                return claim is null ? null : await ResolveViaAppointmentAsync(claim.FellowAppointmentId, ct);
            }

            case RequestType.LeaveRequest:
            {
                var leave = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == requestId, ct);
                return leave is null ? null : await ResolveViaAppointmentAsync(leave.FellowAppointmentId, ct);
            }

            // Recruitment's two RequestTypes -- deliberately out of scope.
            case RequestType.ManpowerDocument:
            case RequestType.Advertisement:
            default:
                return null;
        }
    }

    public string? ResolveTemplateKeyPrefix(RequestType requestType) => requestType switch
    {
        RequestType.ResearchProposal => "proposal",
        RequestType.DynamicIndent or RequestType.Consumable or RequestType.Contingency or RequestType.Equipment => "indent",
        RequestType.Travel => "travel",
        RequestType.FellowshipClaim => "fellowship-claim",
        RequestType.LeaveRequest => "leave-request",
        RequestType.GrantReceipt => "grant-receipt",
        _ => null,
    };

    private async Task<Guid?> ResolveViaProjectAsync(Guid projectId, CancellationToken ct) =>
        (await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct))?.OwnerUserId;

    private async Task<Guid?> ResolveViaAppointmentAsync(Guid fellowAppointmentId, CancellationToken ct) =>
        (await db.ManpowerSelections.FirstOrDefaultAsync(m => m.Id == fellowAppointmentId, ct))?.ApplicationUserId;

    public async Task<string?> ResolveDisplayTitleAsync(RequestType requestType, Guid requestId, CancellationToken ct = default) =>
        requestType switch
        {
            RequestType.ProjectUpdate => (await db.Projects.FirstOrDefaultAsync(p => p.Id == requestId, ct))?.ProjectTitle,
            RequestType.ResearchProposal => (await db.ResearchProposals.FirstOrDefaultAsync(p => p.Id == requestId, ct))?.Title,
            RequestType.DynamicIndent => (await db.Indents.FirstOrDefaultAsync(i => i.Id == requestId, ct))?.IndentNumber,
            RequestType.Consumable => (await db.ConsumableIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct))?.Name,
            RequestType.Contingency => (await db.ContingencyIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct))?.Name,
            RequestType.Equipment => (await db.EquipmentIndents.FirstOrDefaultAsync(i => i.Id == requestId, ct))?.Name,
            RequestType.Travel => (await db.TravelRequests.FirstOrDefaultAsync(t => t.Id == requestId, ct))?.Purpose,
            RequestType.FellowshipClaim => (await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == requestId, ct))?.ClaimPeriod,
            RequestType.LeaveRequest => (await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == requestId, ct))?.LeaveType.ToString(),
            RequestType.GrantReceipt => await ResolveGrantReceiptProjectTitleAsync(requestId, ct),
            _ => null,
        };

    private async Task<string?> ResolveGrantReceiptProjectTitleAsync(Guid receiptId, CancellationToken ct)
    {
        var receipt = await db.GrantReceipts.FirstOrDefaultAsync(r => r.Id == receiptId, ct);
        if (receipt is null) return null;
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == receipt.ProjectId, ct);
        return project?.ProjectTitle;
    }
}
