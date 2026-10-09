using API.Domain.Enums;

namespace API.Application.Documents;

public interface IDocumentChecklistService
{
    /// <param name="ownerType">
    /// The <c>Document.OwnerType</c> string for this request (e.g. "ConsumableIndent").
    /// Document rows are keyed by (OwnerType, OwnerId) rather than by request type.
    /// </param>
    Task<DocumentChecklistResult> GetChecklistAsync(
        RequestType requestType,
        WorkflowPhase phase,
        Guid requestId,
        string ownerType,
        CancellationToken ct = default);
}
