using System;
using System.Text;
using API.Application.Documents;

namespace API.Infrastructure.DocumentGeneration.Templates;

public static class TemplateHelpers
{
    public static string GetFinancialYear(string currentDateStr)
    {
        if (DateTime.TryParseExact(currentDateStr, "dd-MM-yyyy", null, System.Globalization.DateTimeStyles.None, out var date))
        {
            var year = date.Year;
            var month = date.Month;
            if (month < 4) return $"{year - 1}-{year % 100}";
            return $"{year}-{(year + 1) % 100}";
        }
        return "2025-26"; // fallback
    }

    public static string RenderItems(IndentDocumentModel model)
    {
        if (model.Items is null || model.Items.Count == 0) return string.Empty;
        var sb = new StringBuilder();
        foreach (var item in model.Items)
        {
            sb.Append($@"
        <tr>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.SerialNumber}.</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.Name}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{(item.IsConsumable ? "Consumable" : "Non-Consumable")}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.TechnicalSpecs}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.UnitOfMeasurement}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.Quantity}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">Rs. {item.EstimatedCost:N2}</td>
        </tr>");
        }
        return sb.ToString();
    }

    public static string RenderStock(IndentDocumentModel model)
    {
        if (string.IsNullOrWhiteSpace(model.StockBookPage) && string.IsNullOrWhiteSpace(model.StockDescription))
        {
            return @"
        <tr>
            <td colspan=""6"" style=""border:1px solid #000;padding:3px;text-align:center;font-weight:bold;"">Stock Availability: Not Available in Stock</td>
        </tr>";
        }

        try
        {
            var items = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.List<StockItemDto>>(model.StockDescription ?? "[]") ?? [];
            if (items.Count > 0)
            {
                var sb = new StringBuilder();
                int sNo = 1;
                foreach (var item in items)
                {
                    var dateFormatted = !string.IsNullOrWhiteSpace(item.stockBookDate)
                        ? DateTime.Parse(item.stockBookDate).ToString("dd-MM-yyyy")
                        : "";
                    sb.Append($@"
        <tr>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{sNo++}.</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">Page: {item.stockBookPage}<br/>Date: {dateFormatted}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.stockDescription}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{(string.IsNullOrWhiteSpace(item.qty) ? item.stockQuantity : item.qty)}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">Rs. {(string.IsNullOrWhiteSpace(item.actualCost) ? item.stockActualCost : item.actualCost)}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{item.stockCondition}</td>
        </tr>");
                }
                return sb.ToString();
            }
        }
        catch { }

        // Legacy format fallback
        return $@"
        <tr>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">1.</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{model.StockBookPage}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{model.StockDescription}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{model.StockQuantity}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">Rs.{model.StockActualCost}</td>
            <td style=""border:1px solid #000;padding:3px;text-align:center;"">{model.StockCondition}</td>
        </tr>";
    }

    public static string RenderSectionF(IndentDocumentModel model)
    {
        var inst = model.InstallationRequired ? "&#10003; YES" : "&#10007; NO";
        var train = model.TrainingRequired ? "&#10003; YES" : "&#10007; NO";
        var qual = string.IsNullOrWhiteSpace(model.QualificationCriterion) ? "N/A" : model.QualificationCriterion;
        var enc = model.NumberOfEnclosures.HasValue ? model.NumberOfEnclosures.Value.ToString() : "\u2014";
        var del = string.IsNullOrWhiteSpace(model.MaxDeliveryPeriod) ? "\u2014" : model.MaxDeliveryPeriod;
        var purpose = string.IsNullOrWhiteSpace(model.PurposeOfAcquiring) ? "Research/Non-Research" : model.PurposeOfAcquiring;
        var perp = string.IsNullOrWhiteSpace(model.PerpetualLicense) ? "N/A" : model.PerpetualLicense;

        return $@"
        <ol style=""list-style-type: lower-roman; padding-left: 20px; margin: 5px 0;"">
            <li>
                <div style=""display: flex;""><div style=""width: 50%;"">
                    <span class=""english-text"">Installation required: <strong>{inst}</strong></span>
                </div></div>
            </li>
            <li>
                <div style=""display: flex;""><div style=""width: 50%;"">
                    <span class=""english-text"">Training required: <strong>{train}</strong></span>
                </div></div>
            </li>
            <li>
                <div><span class=""english-text"">Qualification criterion for Vendors if any: <strong>{qual}</strong></span></div>
            </li>
            <li>
                <div style=""display: flex;""><div style=""width: 50%;"">
                    <span class=""english-text"">No. of enclosures: <strong>{enc}</strong></span>
                </div></div>
            </li>
            <li>
                <div style=""display: flex;""><div style=""width: 50%;"">
                    <span class=""english-text"">Maximum period for delivery of items: <strong>{del}</strong></span>
                </div></div>
            </li>
            <li>
                <div><span class=""english-text"">Purpose of acquiring the item: <strong>{purpose}</strong></span></div>
            </li>
            <li>
                <div><span class=""english-text"">Perpetual license/Non-perpetual [In case software]: <strong>{perp}</strong></span></div>
            </li>
        </ol>";
    }

    /// <summary>Returns the pre-ticked HTML cell for the 'Copy of estimate' enclosure box.</summary>
    public static string RenderEstimateTickCell() =>
        """<td style="width:20%;border:1px solid #000;padding:3px;text-align:center;font-size:14pt;"><span>&#10003;</span></td>""";

    private class StockItemDto
    {
        public string? stockBookPage { get; set; }
        public string? stockBookDate { get; set; }
        public string? stockDescription { get; set; }
        // Legacy field names
        public string? stockQuantity { get; set; }
        public string? stockActualCost { get; set; }
        public string? stockCondition { get; set; }
        // Current UI field names (used by RequisitionModalShell.jsx)
        public string? qty { get; set; }
        public string? actualCost { get; set; }
    }
}
