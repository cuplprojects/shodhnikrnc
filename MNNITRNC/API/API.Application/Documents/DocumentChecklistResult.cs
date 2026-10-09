using API.Domain.Enums;

namespace API.Application.Documents;

public record DocumentChecklistItemResult(
    Guid ChecklistItemId,
    string Name,
    DocumentKind DocumentKind,
    bool IsMandatory,
    bool IsSatisfied,
    int DisplayOrder,
    /// <summary>
    /// The most recently uploaded document of this kind, or null when unsatisfied.
    /// Several checklist items can share a DocumentKind (see the seed data notes on
    /// DocumentChecklistService), so this is not necessarily the only document that
    /// satisfies the item -- it is the one to link a reviewer to.
    /// </summary>
    Guid? DocumentId);

public record DocumentChecklistResult(
    RequestType RequestType,
    WorkflowPhase Phase,
    Guid RequestId,
    IReadOnlyList<DocumentChecklistItemResult> Items);
