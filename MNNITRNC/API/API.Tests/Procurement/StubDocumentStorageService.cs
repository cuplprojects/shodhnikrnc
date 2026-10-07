using API.Application.Documents;

namespace API.Tests.Procurement;

public class StubDocumentStorageService : IDocumentStorageService
{
    public List<(Guid DocumentId, int Version, string FileName)> Saved { get; } = [];

    public Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default)
    {
        Saved.Add((documentId, version, originalFileName));
        return Task.FromResult($"{documentId}/v{version}.pdf");
    }

    public Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default)
        => Task.FromResult<Stream>(new MemoryStream(StubDocumentGenerationService.FakePdf));

    public void Delete(string storagePath) { }
}
