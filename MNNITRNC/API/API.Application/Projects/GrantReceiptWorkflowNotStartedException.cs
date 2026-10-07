namespace API.Application.Projects;

public class GrantReceiptWorkflowNotStartedException(Guid grantReceiptId)
    : InvalidOperationException(
        $"Grant receipt '{grantReceiptId}' has no approval workflow in progress.");
