using API.Application.Documents;
using API.Application.Reporting;
using API.Infrastructure.Reporting;
using FluentAssertions;
using Xunit;

namespace API.Tests.Reporting;

/// <summary>
/// Exercises the HTML composition ReportPdfExportService builds -- the part
/// that is actually this class's own logic. The renderer itself
/// (IHtmlPdfRenderer/PuppeteerSharp) has no unit test coverage anywhere in
/// this codebase already (confirmed before writing this file); it is
/// verified live, matching how the indent/bill document generation it is
/// shared with is verified. A fake IHtmlPdfRenderer captures the composed
/// HTML instead of launching a real browser.
/// </summary>
public class ReportPdfExportServiceTests
{
    private sealed record SampleRow(string Title, decimal Amount, DateOnly Date);

    private sealed class CapturingRenderer : IHtmlPdfRenderer
    {
        public string? CapturedHtml { get; private set; }

        public Task<byte[]> RenderAsync(string html, CancellationToken ct = default)
        {
            CapturedHtml = html;
            return Task.FromResult(new byte[] { 1, 2, 3 }); // stand-in PDF bytes
        }
    }

    [Fact]
    public async Task ExportAsync_TitleAppearsInTheComposedHtml()
    {
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);

        await service.ExportAsync("Number of Projects", [new ReportColumn<SampleRow>("Title", r => r.Title)], []);

        renderer.CapturedHtml.Should().Contain("Number of Projects");
    }

    [Fact]
    public async Task ExportAsync_EveryColumnHeaderAppearsInTheTable()
    {
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);
        var columns = new ReportColumn<SampleRow>[] { new("Title", r => r.Title), new("Amount", r => r.Amount) };
        var rows = new[] { new SampleRow("x", 0m, default) }; // headers only render alongside the table itself

        await service.ExportAsync("Report", columns, rows);

        renderer.CapturedHtml.Should().Contain("<th>Title</th>").And.Contain("<th>Amount</th>");
    }

    [Fact]
    public async Task ExportAsync_EveryRowAppearsInTheTable()
    {
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);
        var columns = new ReportColumn<SampleRow>[] { new("Title", r => r.Title) };
        var rows = new[] { new SampleRow("First", 100m, default), new SampleRow("Second", 200m, default) };

        await service.ExportAsync("Report", columns, rows);

        renderer.CapturedHtml.Should().Contain("<td>First</td>").And.Contain("<td>Second</td>");
    }

    [Fact]
    public async Task ExportAsync_EmptyRows_RendersAnExplicitEmptyStateNotAnEmptyTable()
    {
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);

        await service.ExportAsync("Report", [new ReportColumn<SampleRow>("Title", r => r.Title)], []);

        renderer.CapturedHtml.Should().Contain("No rows in this report");
        renderer.CapturedHtml.Should().NotContain("<table>");
    }

    [Fact]
    public async Task ExportAsync_TitleAndCellValuesAreHtmlEncoded()
    {
        // A project title or reason containing "<" or "&" must not be
        // interpreted as markup by the PDF renderer.
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);
        var columns = new ReportColumn<SampleRow>[] { new("Title", r => r.Title) };
        var rows = new[] { new SampleRow("<script>alert(1)</script> & Co", 0m, default) };

        await service.ExportAsync("R&D <Report>", columns, rows);

        renderer.CapturedHtml.Should().NotContain("<script>");
        renderer.CapturedHtml.Should().Contain("&lt;script&gt;");
        renderer.CapturedHtml.Should().Contain("R&amp;D &lt;Report&gt;");
    }

    [Fact]
    public async Task ExportAsync_DecimalCellsAreFormattedWithTwoDecimalPlaces()
    {
        var renderer = new CapturingRenderer();
        var service = new ReportPdfExportService(renderer);
        var columns = new ReportColumn<SampleRow>[] { new("Amount", r => r.Amount) };
        var rows = new[] { new SampleRow("x", 1500m, default) };

        await service.ExportAsync("Report", columns, rows);

        renderer.CapturedHtml.Should().Contain("1,500.00");
    }
}
