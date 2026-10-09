namespace API.Domain.Entities;

/// <summary>
/// One record of who did what, to what, and when -- across every module in
/// the application, including ones added after this entity existed.
/// </summary>
/// <remarks>
/// Named in Prompt 0 as platform foundation ("audit trail: every approval,
/// rejection, modification, and financial transaction... must be logged
/// with actor, timestamp, before/after values where applicable") but never
/// actually built in Phases 1-9 -- built here, generically, per that
/// original brief, not bolted onto reporting as a one-off (Phase 10 spec
/// §1, §4).
///
/// <see cref="EntityType"/>/<see cref="Action"/> are deliberately loose
/// string fields, not enums -- an enum here would need appending for every
/// future feature that needs auditing, the exact friction
/// <c>WorkflowStage</c>/<c>WorkflowAction</c>'s own append-only comments
/// already warn about for a narrower case (one module's stages), and this
/// spans every module.
///
/// Deliberately does not overlap <see cref="WorkflowStep"/>: actions already
/// routed through the workflow engine (approvals, rejections, forwards) keep
/// using WorkflowStep as their record -- see AuditService's own doc comment
/// for which write paths call it and why workflow actions are excluded.
/// </remarks>
public class AuditLog
{
    public Guid Id { get; set; }
    public required string EntityType { get; set; }
    public Guid EntityId { get; set; }
    public required string Action { get; set; }
    public Guid ActorUserId { get; set; }
    public DateTimeOffset Timestamp { get; set; }

    /// <summary>Free-text detail -- a JSON diff, or a short description of
    /// what changed. Not structured, because what's worth recording varies
    /// too much by action to force one shape.</summary>
    public string? Detail { get; set; }
}
