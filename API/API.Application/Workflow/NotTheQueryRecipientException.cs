namespace API.Application.Workflow;

public class NotTheQueryRecipientException(Guid queryId)
    : InvalidOperationException(
        $"Only the person a query was addressed to may answer it (query '{queryId}').");
