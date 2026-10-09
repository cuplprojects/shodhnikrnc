using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Audit;

public class AuditService(IApplicationDbContext db) : IAuditService
{
    public async Task LogAsync(
        string entityType, Guid entityId, string action, Guid actorUserId,
        string? detail = null, CancellationToken ct = default)
    {
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            ActorUserId = actorUserId,
            Timestamp = DateTimeOffset.UtcNow,
            Detail = detail,
        });

        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AuditLog>> QueryAsync(
        string? entityType = null, Guid? entityId = null, DateOnly? from = null, DateOnly? to = null,
        CancellationToken ct = default)
    {
        var query = db.AuditLogs.AsQueryable();

        if (entityType is not null) query = query.Where(a => a.EntityType == entityType);
        if (entityId is not null) query = query.Where(a => a.EntityId == entityId);
        if (from is { } f) query = query.Where(a => a.Timestamp >= new DateTimeOffset(f.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (to is { } t) query = query.Where(a => a.Timestamp <= new DateTimeOffset(t.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero));

        return await query.OrderByDescending(a => a.Timestamp).ToListAsync(ct);
    }
}
