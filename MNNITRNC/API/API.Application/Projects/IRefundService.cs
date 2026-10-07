using API.Domain.Entities;

namespace API.Application.Projects;

public interface IRefundService
{
    /// <summary>Records a refund against a project. RnC office staff only
    /// (enforced at the controller, per the spec's office-role gate) -- not
    /// the PI, since this is the office's business, not a self-service
    /// action.</summary>
    Task<Refund> RecordAsync(
        Guid projectId, Guid recordedByUserId, decimal amount, DateOnly refundDate, string reason,
        CancellationToken ct = default);

    Task<IReadOnlyList<Refund>> ListForProjectAsync(Guid projectId, CancellationToken ct = default);
}
