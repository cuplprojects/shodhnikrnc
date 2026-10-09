using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class PdfMergerTests
{
    private static int CountPages(byte[] pdf)
    {
        var content = System.Text.Encoding.ASCII.GetString(pdf);
        return System.Text.RegularExpressions.Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
    }

    [Fact]
    public async Task Merge_TwoDocuments_ProducesCombinedPageCount()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var first = await renderer.RenderAsync("<html><body><div>A</div></body></html>");
        var second = await renderer.RenderAsync("<html><body><div>B</div></body></html>");
        var merger = new PdfSharpPdfMerger();

        var merged = merger.Merge([first, second]);

        merged.Should().NotBeEmpty();
        CountPages(merged).Should().Be(CountPages(first) + CountPages(second));
    }

    [Fact]
    public async Task Merge_SingleDocument_ReturnsEquivalentPageCount()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var only = await renderer.RenderAsync("<html><body><div>Only</div></body></html>");
        var merger = new PdfSharpPdfMerger();

        var merged = merger.Merge([only]);

        CountPages(merged).Should().Be(CountPages(only));
    }

    [Fact]
    public void Merge_EmptyList_Throws()
    {
        var merger = new PdfSharpPdfMerger();

        var act = () => merger.Merge([]);

        act.Should().Throw<ArgumentException>();
    }
}
