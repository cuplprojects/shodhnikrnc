namespace API.Application.Projects;

public class GrantReceiptNotFoundException(Guid grantReceiptId)
    : Exception($"Grant receipt '{grantReceiptId}' was not found.");
