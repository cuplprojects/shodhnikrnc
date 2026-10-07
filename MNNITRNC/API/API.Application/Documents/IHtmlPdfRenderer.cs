namespace API.Application.Documents;

public interface IHtmlPdfRenderer
{
    Task<byte[]> RenderAsync(string html, CancellationToken ct = default);
}
