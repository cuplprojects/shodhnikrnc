using API.Application.Documents;
using Microsoft.Extensions.Options;

namespace API.Infrastructure.Documents;

public class LocalDiskDocumentStorageService(IOptions<DocumentStorageOptions> options) : IDocumentStorageService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"
    };

    private readonly string _rootPath = options.Value.RootPath;

    public async Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"File extension '{extension}' is not allowed.", nameof(originalFileName));
        }

        var relativePath = Path.Combine(documentId.ToString(), $"v{version}{extension}");
        var fullPath = Path.Combine(_rootPath, relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var fileStream = File.Create(fullPath);
        content.Position = 0;
        await content.CopyToAsync(fileStream, ct);

        return relativePath;
    }

    public Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default)
    {
        var fullPath = ResolveWithinRoot(storagePath);
        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult(stream);
    }

    public void Delete(string storagePath)
    {
        var fullPath = ResolveWithinRoot(storagePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    private string ResolveWithinRoot(string storagePath)
    {
        var combined = Path.Combine(_rootPath, storagePath);
        var fullPath = Path.GetFullPath(combined);
        var fullRoot = Path.GetFullPath(_rootPath);

        if (!fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"Storage path '{storagePath}' resolves outside the storage root.", nameof(storagePath));
        }

        return fullPath;
    }
}
