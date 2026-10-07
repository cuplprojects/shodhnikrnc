namespace API.Application.Reporting;

/// <summary>One exported column: a header label and how to read that
/// column's value off a row. Shared between <see cref="IExcelExportService"/>
/// and <see cref="IReportPdfExportService"/> -- both are tabular exporters
/// over the same report DTOs, and a report's column list should not be
/// declared twice just because it is offered in two formats.</summary>
public record ReportColumn<T>(string Header, Func<T, object?> Value);
