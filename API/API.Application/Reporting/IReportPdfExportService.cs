namespace API.Application.Reporting;

/// <summary>
/// One generic tabular PDF exporter, mirroring <see cref="IExcelExportService"/>'s
/// shape: reused by all seven reports rather than one per report. Reuses the
/// existing <c>IHtmlPdfRenderer</c>/Puppeteer path the indent/bill documents
/// already render through -- compose an HTML table, then through the same
/// renderer. No new PDF library.
/// </summary>
public interface IReportPdfExportService
{
    Task<byte[]> ExportAsync<T>(
        string title, IReadOnlyList<ReportColumn<T>> columns, IReadOnlyList<T> rows, CancellationToken ct = default);
}
