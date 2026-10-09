namespace API.Application.Documents;

/// <summary>
/// Thrown by DocumentsController.Delete when the caller is neither the
/// owning resource's owner nor an Office role. Currently only
/// ResearchProposal documents are deletable at all -- any other owner type
/// refuses deletion outright, the same as an unauthorized caller, since no
/// ownership rule for it has been defined yet.
/// </summary>
public class NotAuthorizedToDeleteDocumentException(Guid documentId)
    : InvalidOperationException($"You are not authorized to delete document '{documentId}'.");
