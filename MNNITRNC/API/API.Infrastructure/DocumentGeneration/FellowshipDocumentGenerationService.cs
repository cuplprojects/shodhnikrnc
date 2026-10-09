using API.Application.Documents;
using API.Application.Fellowship;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Infrastructure.DocumentGeneration;

public class FellowshipDocumentGenerationService(IHtmlPdfRenderer renderer)
    : IFellowshipDocumentGenerationService
{
    public Task<byte[]> GenerateStipendFormAsync(
        StipendFormModel model, CancellationToken ct = default) =>
        renderer.RenderAsync(IndentHtmlShell.Wrap(StipendFormTemplate.Render(model)), ct);
}
