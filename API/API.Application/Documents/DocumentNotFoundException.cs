namespace API.Application.Documents;

public class DocumentNotFoundException(Guid documentId)
    : Exception($"Document '{documentId}' was not found.");
