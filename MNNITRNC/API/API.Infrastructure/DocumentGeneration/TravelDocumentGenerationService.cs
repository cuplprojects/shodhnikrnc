using API.Application.Documents;
using API.Application.Travel;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Infrastructure.DocumentGeneration;

/// <summary>
/// Renders the travel documents. Reuses the procurement HTML shell so both slices
/// share one set of fonts, page metrics and CSS class names.
/// </summary>
public class TravelDocumentGenerationService(IHtmlPdfRenderer renderer)
    : ITravelDocumentGenerationService
{
    public Task<byte[]> GenerateTravelRequestFormAsync(
        TravelDocumentModel model, CancellationToken ct = default) =>
        renderer.RenderAsync(IndentHtmlShell.Wrap(TravelRequestFormTemplate.Render(model)), ct);

    public Task<byte[]> GenerateTravelCoverLetterAsync(
        TravelDocumentModel model, CancellationToken ct = default) =>
        renderer.RenderAsync(IndentHtmlShell.Wrap(TravelCoverLetterTemplate.Render(model)), ct);
}
