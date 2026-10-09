using API.Domain.Enums;

namespace API.Contracts.Documents;

public record DocumentChecklistItemResponse(
    Guid ChecklistItemId,
    string Name,
    DocumentKind DocumentKind,
    bool IsMandatory,
    bool IsSatisfied,
    int DisplayOrder,
    Guid? DocumentId);

public record DocumentChecklistResponse(
    RequestType RequestType,
    WorkflowPhase Phase,
    Guid RequestId,
    IReadOnlyList<DocumentChecklistItemResponse> Items);
