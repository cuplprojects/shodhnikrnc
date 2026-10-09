using API.Application.Fellowship;

namespace API.Tests.Fellowship;

/// <summary>
/// Captures the model instead of rendering a PDF, so tests can assert on what
/// the form would print without needing a headless browser.
/// </summary>
public class StubFellowshipDocumentGenerationService : IFellowshipDocumentGenerationService
{
    public static readonly byte[] FakePdf = [0x25, 0x50, 0x44, 0x46];

    public List<StipendFormModel> Generated { get; } = [];

    public Task<byte[]> GenerateStipendFormAsync(
        StipendFormModel model, CancellationToken ct = default)
    {
        Generated.Add(model);
        return Task.FromResult(FakePdf);
    }
}
