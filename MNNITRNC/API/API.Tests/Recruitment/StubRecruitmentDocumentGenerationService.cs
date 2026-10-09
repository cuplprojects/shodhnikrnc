using API.Application.Recruitment;

namespace API.Tests.Recruitment;

/// <summary>
/// Records which documents were asked for instead of rendering PDFs, so the
/// service tests do not need a headless browser.
/// </summary>
public class StubRecruitmentDocumentGenerationService : IRecruitmentDocumentGenerationService
{
    public static readonly byte[] FakePdf = [0x25, 0x50, 0x44, 0x46];

    public List<string> Generated { get; } = [];

    /// <summary>The last model handed to a RecruitmentDocumentModel-based
    /// generator, so tests can assert what the templates would have been
    /// given without rendering a real PDF.</summary>
    public RecruitmentDocumentModel? LastModel { get; private set; }

    public Task<byte[]> GenerateAdvertisementAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        return Record(nameof(GenerateAdvertisementAsync));
    }

    public Task<string> RenderAdvertisementHtmlAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        Generated.Add(nameof(RenderAdvertisementHtmlAsync));
        return Task.FromResult($"<html><body>{model.AdvertisementText}</body></html>");
    }

    public Task<byte[]> GenerateScreeningProformaAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        return Record(nameof(GenerateScreeningProformaAsync));
    }

    public Task<byte[]> GenerateSelectionProformaAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        return Record(nameof(GenerateSelectionProformaAsync));
    }

    public Task<byte[]> GenerateMinutesOfSelectionAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        return Record(nameof(GenerateMinutesOfSelectionAsync));
    }

    public Task<byte[]> GenerateMeritListAsync(RecruitmentDocumentModel model, CancellationToken ct = default)
    {
        LastModel = model;
        return Record(nameof(GenerateMeritListAsync));
    }

    public Task<byte[]> GenerateOfferLetterAsync(OfferLetterModel model, CancellationToken ct = default)
        => Record(nameof(GenerateOfferLetterAsync));

    public Task<byte[]> GenerateJoiningLetterAsync(OfferLetterModel model, CancellationToken ct = default)
        => Record(nameof(GenerateJoiningLetterAsync));

    private Task<byte[]> Record(string name)
    {
        Generated.Add(name);
        return Task.FromResult(FakePdf);
    }
}
