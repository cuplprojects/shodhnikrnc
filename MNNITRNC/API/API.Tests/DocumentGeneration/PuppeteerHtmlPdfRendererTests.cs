using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class PuppeteerHtmlPdfRendererTests
{
    [Fact]
    public async Task RenderAsync_SimpleHtml_ProducesPdfBytes()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();

        var bytes = await renderer.RenderAsync("<html><body><h1>Hello</h1></body></html>");

        bytes.Should().NotBeEmpty();
        // A PDF file always starts with the magic bytes "%PDF-"
        System.Text.Encoding.ASCII.GetString(bytes, 0, 5).Should().Be("%PDF-");
    }

    [Fact]
    public async Task RenderAsync_MultiPageHtml_ProducesMultiPagePdf()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var html = "<html><body><div>Page one</div>" +
                   "<div style='page-break-before: always;'>Page two</div></body></html>";

        var bytes = await renderer.RenderAsync(html);

        // Each page object in a PDF is marked with "/Type /Page" (not /Pages).
        var content = System.Text.Encoding.ASCII.GetString(bytes);
        var pageCount = System.Text.RegularExpressions.Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
        pageCount.Should().BeGreaterThanOrEqualTo(2);
    }
}
