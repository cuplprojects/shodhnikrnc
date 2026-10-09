using System.Net;
using System.Text;
using API.Application.Documents;
using API.Application.Reporting;

namespace API.Infrastructure.Reporting;

/// <inheritdoc cref="IReportPdfExportService"/>
public class ReportPdfExportService(IHtmlPdfRenderer renderer) : IReportPdfExportService
{
    public async Task<byte[]> ExportAsync<T>(
        string title, IReadOnlyList<ReportColumn<T>> columns, IReadOnlyList<T> rows, CancellationToken ct = default)
    {
        var html = Wrap(title, columns, rows);
        return await renderer.RenderAsync(html, ct);
    }

    private static string Wrap<T>(string title, IReadOnlyList<ReportColumn<T>> columns, IReadOnlyList<T> rows)
    {
        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>");
        sb.Append(Encode(title));
        sb.Append("</title><style>");
        sb.Append("""
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { font-size: 16pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
            th { background-color: #f2f2f2; }
            .empty { color: #888; font-style: italic; padding: 12px 0; }
            """);
        sb.Append("</style></head><body>");
        sb.Append("<h1>").Append(Encode(title)).Append("</h1>");

        if (rows.Count == 0)
        {
            sb.Append("<p class=\"empty\">No rows in this report for the selected scope/date range.</p>");
        }
        else
        {
            sb.Append("<table><thead><tr>");
            foreach (var column in columns)
            {
                sb.Append("<th>").Append(Encode(column.Header)).Append("</th>");
            }

            sb.Append("</tr></thead><tbody>");

            foreach (var row in rows)
            {
                sb.Append("<tr>");
                foreach (var column in columns)
                {
                    sb.Append("<td>").Append(Encode(FormatCell(column.Value(row)))).Append("</td>");
                }

                sb.Append("</tr>");
            }

            sb.Append("</tbody></table>");
        }

        sb.Append("</body></html>");
        return sb.ToString();
    }

    private static string FormatCell(object? value) => value switch
    {
        null => string.Empty,
        DateOnly d => d.ToString("yyyy-MM-dd"),
        DateTimeOffset dto => dto.UtcDateTime.ToString("yyyy-MM-dd HH:mm"),
        decimal d => d.ToString("N2"),
        _ => value.ToString() ?? string.Empty,
    };

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
