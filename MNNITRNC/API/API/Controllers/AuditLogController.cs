using API.Application.Audit;
using API.Contracts.Audit;
using API.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Reads the audit trail (BRD Prompt 6 / A11's "complete audit logs"
/// deliverable). Gated to SuperAdmin and Dean -- the two roles this
/// codebase already treats as seeing everything (Dean is explicitly named
/// alongside SuperAdmin in AccessScope.Institute's own doc comment), not a
/// page-catalogue grant: unlike the reports, who may read the audit log is
/// not something a SuperAdmin should be able to hand out per-role, since the
/// log itself records what SuperAdmins and Deans do.
/// </summary>
[ApiController]
[Route("api/audit-log")]
[Authorize(Roles = "SuperAdmin,Dean")]
public class AuditLogController(IAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogResponse>>> Query(
        string? entityType, Guid? entityId, DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var rows = await audit.QueryAsync(entityType, entityId, from, to, ct);
        return Ok(rows.Select(r => new AuditLogResponse(
            r.Id, r.EntityType, r.EntityId, r.Action, r.ActorUserId, r.Timestamp, r.Detail)).ToList());
    }
}
