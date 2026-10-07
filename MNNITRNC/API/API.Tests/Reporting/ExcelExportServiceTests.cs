using API.Application.Reporting;
using API.Infrastructure.Reporting;
using ClosedXML.Excel;
using FluentAssertions;
using Xunit;

namespace API.Tests.Reporting;

public class ExcelExportServiceTests
{
    private sealed record SampleRow(string Title, decimal Amount, DateOnly Date);

    [Fact]
    public void Export_HeaderRowMatchesTheDeclaredColumns()
    {
        var service = new ExcelExportService();
        var columns = new ReportColumn<SampleRow>[]
        {
            new("Title", r => r.Title),
            new("Amount", r => r.Amount),
            new("Date", r => r.Date),
        };

        var bytes = service.Export("Report", columns, []);

        using var stream = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(stream);
        var sheet = workbook.Worksheet(1);

        sheet.Cell(1, 1).GetString().Should().Be("Title");
        sheet.Cell(1, 2).GetString().Should().Be("Amount");
        sheet.Cell(1, 3).GetString().Should().Be("Date");
    }

    [Fact]
    public void Export_EveryRowIsPresent_NotJustAFileProducedWithARowCount()
    {
        var service = new ExcelExportService();
        var columns = new ReportColumn<SampleRow>[] { new("Title", r => r.Title), new("Amount", r => r.Amount) };
        var rows = new[]
        {
            new SampleRow("First", 100m, new DateOnly(2025, 1, 1)),
            new SampleRow("Second", 250m, new DateOnly(2025, 2, 1)),
            new SampleRow("Third", 75m, new DateOnly(2025, 3, 1)),
        };

        var bytes = service.Export("Report", columns, rows);

        using var stream = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(stream);
        var sheet = workbook.Worksheet(1);

        sheet.Cell(2, 1).GetString().Should().Be("First");
        sheet.Cell(2, 2).GetDouble().Should().Be(100);
        sheet.Cell(3, 1).GetString().Should().Be("Second");
        sheet.Cell(3, 2).GetDouble().Should().Be(250);
        sheet.Cell(4, 1).GetString().Should().Be("Third");
        sheet.Cell(4, 2).GetDouble().Should().Be(75);

        // Row 5 must be empty -- proves nothing beyond the three real rows
        // was written, not just that the first few came through.
        sheet.Cell(5, 1).IsEmpty().Should().BeTrue();
    }

    [Fact]
    public void Export_SheetNameIsSetFromTheParameter()
    {
        var service = new ExcelExportService();

        var bytes = service.Export("Number of Projects", [new ReportColumn<SampleRow>("Title", r => r.Title)], []);

        using var stream = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(stream);

        workbook.Worksheet(1).Name.Should().Be("Number of Projects");
    }

    [Fact]
    public void Export_DateOnlyColumnRoundTripsAsARealDate_NotAString()
    {
        var service = new ExcelExportService();
        var columns = new ReportColumn<SampleRow>[] { new("Date", r => r.Date) };
        var rows = new[] { new SampleRow("x", 0m, new DateOnly(2025, 6, 15)) };

        var bytes = service.Export("Report", columns, rows);

        using var stream = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(stream);
        var cell = workbook.Worksheet(1).Cell(2, 1);

        cell.DataType.Should().Be(XLDataType.DateTime);
        cell.GetDateTime().Should().Be(new DateTime(2025, 6, 15));
    }

    [Fact]
    public void Export_NullValueLeavesTheCellEmpty()
    {
        var service = new ExcelExportService();
        var columns = new ReportColumn<SampleRow>[] { new("Title", _ => null) };
        var rows = new[] { new SampleRow("ignored", 0m, default) };

        var bytes = service.Export("Report", columns, rows);

        using var stream = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(stream);

        workbook.Worksheet(1).Cell(2, 1).IsEmpty().Should().BeTrue();
    }
}
