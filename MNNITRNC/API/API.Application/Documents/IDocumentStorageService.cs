namespace API.Application.Documents;

public interface IDocumentStorageService
{
    Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default);
    Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default);
    void Delete(string storagePath);
}
