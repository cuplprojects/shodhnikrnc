namespace API.Application.Reporting;

/// <summary>
/// One generic tabular exporter reused by all seven reports, not one per
/// report -- every report DTO (see <c>ReportDtos.cs</c>) is a flat record
/// with no nested structure, so a single header-row-plus-data-rows shape
/// covers all of them without forcing anything.
/// </summary>
public interface IExcelExportService
{
    byte[] Export<T>(string sheetName, IReadOnlyList<ReportColumn<T>> columns, IReadOnlyList<T> rows);
}
