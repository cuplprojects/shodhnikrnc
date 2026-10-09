using API.Domain.Entities;

namespace API.Application.Audit;

/// <summary>
/// Writes and reads <see cref="AuditLog"/> rows. Written from write paths
/// not already covered by <see cref="WorkflowStep"/> -- financial mutations
/// (grant receipts, refunds) and admin/RBAC mutations (role and page-access
/// edits). Workflow-routed actions are not double-logged;
/// <c>WorkflowStep</c> already is their record. Read via
/// <see cref="QueryAsync"/> -- the BRD's "complete audit logs" deliverable
/// needs somewhere to actually view them, not just write them (Phase 10
/// Task 13).
/// </summary>
public interface IAuditService
{
    Task LogAsync(
        string entityType, Guid entityId, string action, Guid actorUserId,
        string? detail = null, CancellationToken ct = default);

    /// <summary>Every filter is optional and additive (AND, not OR) --
    /// omitting all of them returns the whole log, newest first.</summary>
    Task<IReadOnlyList<AuditLog>> QueryAsync(
        string? entityType = null, Guid? entityId = null, DateOnly? from = null, DateOnly? to = null,
        CancellationToken ct = default);
}
