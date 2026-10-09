using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Infrastructure.DocumentGeneration;

public class DocumentGenerationService(
    IHtmlPdfRenderer renderer,
    IPdfMerger merger) : IDocumentGenerationService
{
    public async Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier,
        IndentDocumentModel model,
        byte[]? gemQuotationPdf = null,
        CancellationToken ct = default)
    {
        var annexureBody = tier switch
        {
            ProcurementTier.GemUpTo50k => Annexure6Template.Render(model),
            ProcurementTier.Gem50kTo1Lakh => Annexure7Template.Render(model),
            ProcurementTier.GemAbove1Lakh => Annexure8Template.Render(model),
            ProcurementTier.NonGemUpTo1Lakh => Annexure9Template.Render(model),
            ProcurementTier.NonGem1LakhTo2Lakh => Annexure10Template.Render(model),
            ProcurementTier.NonGem2LakhTo25Lakh => Annexure11Template.Render(model),
            _ => throw new ArgumentOutOfRangeException(nameof(tier), tier, "Unknown procurement tier."),
        };

        // Legacy always prepends the cover letter, then a page break, then the annexure.
        var body = IndentCoverLetterTemplate.Render(model)
                   + "<div class=\"page-break\"></div>"
                   + annexureBody;

        var pdf = await renderer.RenderAsync(IndentHtmlShell.Wrap(body), ct);

        if (gemQuotationPdf is { Length: > 0 })
        {
            pdf = merger.Merge([pdf, gemQuotationPdf]);
        }

        return pdf;
    }

    public async Task<byte[]> GenerateBillCoverLetterAsync(
        IndentDocumentModel model,
        CancellationToken ct = default)
    {
        var html = IndentHtmlShell.Wrap(BillCoverLetterTemplate.Render(model));
        return await renderer.RenderAsync(html, ct);
    }
}
