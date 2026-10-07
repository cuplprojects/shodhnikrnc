using API.Application.Reporting;
using ClosedXML.Excel;

namespace API.Infrastructure.Reporting;

/// <inheritdoc cref="IExcelExportService"/>
public class ExcelExportService : IExcelExportService
{
    public byte[] Export<T>(string sheetName, IReadOnlyList<ReportColumn<T>> columns, IReadOnlyList<T> rows)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(sheetName);

        for (var col = 0; col < columns.Count; col++)
        {
            sheet.Cell(1, col + 1).Value = columns[col].Header;
            sheet.Cell(1, col + 1).Style.Font.Bold = true;
        }

        for (var row = 0; row < rows.Count; row++)
        {
            for (var col = 0; col < columns.Count; col++)
            {
                var value = columns[col].Value(rows[row]);
                SetCell(sheet.Cell(row + 2, col + 1), value);
            }
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// ClosedXML's <c>Cell.Value</c> setter is overloaded per concrete type,
    /// not <c>object</c> -- a boxed value needs its runtime type checked
    /// explicitly rather than assigned directly, or every column falls back
    /// to a plain string rendering (a decimal amount would print without
    /// numeric formatting, a date as raw text).
    /// </summary>
    private static void SetCell(IXLCell cell, object? value)
    {
        switch (value)
        {
            case null:
                break;
            case string s:
                cell.Value = s;
                break;
            case int i:
                cell.Value = i;
                break;
            case decimal d:
                cell.Value = d;
                break;
            case DateOnly date:
                cell.Value = date.ToDateTime(TimeOnly.MinValue);
                break;
            case DateTime dt:
                cell.Value = dt;
                break;
            case DateTimeOffset dto:
                cell.Value = dto.UtcDateTime;
                break;
            case Guid g:
                cell.Value = g.ToString();
                break;
            default:
                cell.Value = value.ToString();
                break;
        }
    }
}
