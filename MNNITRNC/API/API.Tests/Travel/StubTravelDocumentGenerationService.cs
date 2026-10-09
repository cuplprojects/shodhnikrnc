using API.Application.Travel;

namespace API.Tests.Travel;

public class StubTravelDocumentGenerationService : ITravelDocumentGenerationService
{
    public static readonly byte[] FakePdf = [0x25, 0x50, 0x44, 0x46];

    public List<TravelDocumentModel> RequestForms { get; } = [];
    public List<TravelDocumentModel> CoverLetters { get; } = [];

    public Task<byte[]> GenerateTravelRequestFormAsync(
        TravelDocumentModel model, CancellationToken ct = default)
    {
        RequestForms.Add(model);
        return Task.FromResult(FakePdf);
    }

    public Task<byte[]> GenerateTravelCoverLetterAsync(
        TravelDocumentModel model, CancellationToken ct = default)
    {
        CoverLetters.Add(model);
        return Task.FromResult(FakePdf);
    }
}
