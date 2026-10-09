using API.Application.Audit;
using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class RefundService(IApplicationDbContext db, IAuditService audit) : IRefundService
{
    public async Task<Refund> RecordAsync(
        Guid projectId, Guid recordedByUserId, decimal amount, DateOnly refundDate, string reason,
        CancellationToken ct = default)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId && !p.IsDeleted, ct);
        if (!exists)
        {
            throw new ProjectNotFoundException(projectId);
        }

        var refund = new Refund
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Amount = amount,
            RefundDate = refundDate,
            Reason = reason,
            RecordedByUserId = recordedByUserId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.Refunds.Add(refund);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            nameof(Project), projectId, "RefundRecorded", recordedByUserId, $"Amount={amount}", ct);
        return refund;
    }

    public async Task<IReadOnlyList<Refund>> ListForProjectAsync(Guid projectId, CancellationToken ct = default)
    {
        return await db.Refunds
            .Where(r => r.ProjectId == projectId)
            .OrderByDescending(r => r.RefundDate)
            .ToListAsync(ct);
    }
}
