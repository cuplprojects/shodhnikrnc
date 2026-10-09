using API.Application.Documents;
using API.Infrastructure.Documents;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;

namespace API.Tests.Documents;

public class LocalDiskDocumentStorageServiceTests : IDisposable
{
    private readonly string _tempRoot = Path.Combine(Path.GetTempPath(), "mnnitrnc-doc-tests-" + Guid.NewGuid());

    private LocalDiskDocumentStorageService CreateService()
    {
        var options = Options.Create(new DocumentStorageOptions { RootPath = _tempRoot });
        return new LocalDiskDocumentStorageService(options);
    }

    [Fact]
    public async Task SaveAsync_WritesFileAndReturnsRelativePath()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();
        using var content = new MemoryStream("hello world"u8.ToArray());

        var storagePath = await service.SaveAsync(documentId, 1, content, "test.pdf");

        storagePath.Should().Contain(documentId.ToString());
        storagePath.Should().EndWith(".pdf");
        File.Exists(Path.Combine(_tempRoot, storagePath)).Should().BeTrue();
    }

    [Fact]
    public async Task OpenReadAsync_ReturnsSavedContent()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();
        var originalBytes = "hello world"u8.ToArray();
        using (var content = new MemoryStream(originalBytes))
        {
            var storagePath = await service.SaveAsync(documentId, 1, content, "test.pdf");

            await using var readStream = await service.OpenReadAsync(storagePath);
            using var reader = new MemoryStream();
            await readStream.CopyToAsync(reader);

            reader.ToArray().Should().Equal(originalBytes);
        }
    }

    [Fact]
    public async Task SaveAsync_DifferentVersions_ProduceDifferentPaths()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();

        using var v1 = new MemoryStream("v1"u8.ToArray());
        var path1 = await service.SaveAsync(documentId, 1, v1, "test.pdf");

        using var v2 = new MemoryStream("v2"u8.ToArray());
        var path2 = await service.SaveAsync(documentId, 2, v2, "test.pdf");

        path1.Should().NotBe(path2);
    }

    [Fact]
    public async Task SaveAsync_WithDisallowedExtension_ThrowsArgumentException()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();
        using var content = new MemoryStream("malicious"u8.ToArray());

        Func<Task> act = async () => await service.SaveAsync(documentId, 1, content, "malware.exe");

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task OpenReadAsync_WithPathEscapingRoot_ThrowsArgumentException()
    {
        var service = CreateService();

        Func<Task> act = async () => await service.OpenReadAsync("../../../etc/passwd");

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task OpenReadAsync_WithAbsolutePathEscapingRoot_ThrowsArgumentException()
    {
        var service = CreateService();
        var absolutePath = OperatingSystem.IsWindows()
            ? "C:\\Windows\\win.ini"
            : "/etc/passwd";

        Func<Task> act = async () => await service.OpenReadAsync(absolutePath);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public void Delete_WithPathEscapingRoot_ThrowsArgumentException()
    {
        var service = CreateService();

        Action act = () => service.Delete("../../../etc/passwd");

        act.Should().Throw<ArgumentException>();
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
        {
            Directory.Delete(_tempRoot, recursive: true);
        }
    }
}
