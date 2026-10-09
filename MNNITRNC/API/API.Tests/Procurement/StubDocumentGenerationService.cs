using API.Application.Documents;

namespace API.Tests.Procurement;

public class StubDocumentGenerationService : IDocumentGenerationService
{
    public static readonly byte[] FakePdf = "%PDF-1.4 stub"u8.ToArray();

    public List<(ProcurementTier Tier, IndentDocumentModel Model, byte[]? Quotation)> IndentCalls { get; } = [];
    public List<IndentDocumentModel> BillCoverLetterCalls { get; } = [];

    public Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier, IndentDocumentModel model, byte[]? gemQuotationPdf = null, CancellationToken ct = default)
    {
        IndentCalls.Add((tier, model, gemQuotationPdf));
        return Task.FromResult(FakePdf);
    }

    public Task<byte[]> GenerateBillCoverLetterAsync(IndentDocumentModel model, CancellationToken ct = default)
    {
        BillCoverLetterCalls.Add(model);
        return Task.FromResult(FakePdf);
    }
}
