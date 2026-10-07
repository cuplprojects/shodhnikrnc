using System.Net;
using System.Text;
using API.Application.Travel;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported from legacy generate_travel_request_pdf.php. The permission-and-financial-
/// approval letter raised before travel, listing each journey leg with its cost,
/// then accommodation and other expenses, then the total.
/// </summary>
/// <remarks>
/// One addition over legacy: each journey row names the booking platform. The BRD
/// restricts bookings to IRCTC / Ashoka Travel / Balmer Lawrie, and printing the
/// platform is what makes that rule checkable on the signed form.
/// </remarks>
public static class TravelRequestFormTemplate
{
    public static string Render(TravelDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;
        var onward = model.OnwardDate.ToString("dd MMM yyyy");
        var ret = model.ReturnDate.ToString("dd MMM yyyy");

        // Legacy counted inclusive days ("including the travel days").
        var days = model.ReturnDate.DayNumber - model.OnwardDate.DayNumber + 1;

        var journeyRows = new StringBuilder();
        foreach (var leg in model.Journeys)
        {
            var particulars = Escape($"Journey {leg.SerialNumber}: {leg.From} to {leg.To}");
            var details = Escape(
                $"{leg.Date:dd MMM yyyy} · {leg.ModeLabel} · booked via {leg.PlatformLabel}"
                + (string.IsNullOrWhiteSpace(leg.Remarks) ? "" : $" · {leg.Remarks}"));

            journeyRows.Append($$"""
            <tr>
                <td style="border:1px solid #000; padding:8px;">{{particulars}}</td>
                <td style="border:1px solid #000; padding:8px;">{{details}}</td>
                <td style="border:1px solid #000; padding:8px; text-align:right;">Rs.{{leg.Amount:F2}}</td>
            </tr>
            """);
        }

        var taxiNote = model.TaxiReimbursementOptedIn
            ? "<p class=\"english-text\">Taxi reimbursement has been opted for at the time of submission of this request.</p>"
            : string.Empty;

        return $$"""
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <img src="{{logo}}">
                </td>
                <td class="institute-cell">
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Department of {{model.FacultyDepartment}}</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
                </td>
            </tr>
        </table>

        <div class="content">
            <p class="english-text">
                <strong>Dean R &amp; C</strong><br>
                <strong>Through:</strong> Head of the Department
            </p>

            <p class="english-text" style="text-align: justify;">
                <strong>Subject:</strong> Request to permit the visit to {{Escape(model.Place)}} under
                "{{Escape(model.ProjectTitle)}}" Research Project with financial approval (TA. DA.)
            </p>

            <p class="english-text">Sir,</p>

            <p class="english-text" style="text-align: justify;">
                With reference to the approved {{Escape(model.Agency)}} research project entitled
                "{{Escape(model.ProjectTitle)}}" [Sanction order no.: {{Escape(model.SanctionNo)}}].
                The visit to {{Escape(model.Place)}} is required during {{onward}} to {{ret}}
                for {{Escape(model.Purpose)}}.
            </p>

            <p class="english-text" style="text-align: justify;">
                In view of this, it is requested to permit the {{days}} days [{{onward}} to {{ret}}]
                visit including the travel days with the financial approval to meet the TA, DA, and
                other expenses that is estimated as follows:
            </p>

            <table class="details">
                <thead>
                    <tr>
                        <th class="english-text" style="width:25%">Particulars</th>
                        <th class="english-text" style="width:55%">Details</th>
                        <th class="english-text" style="width:20%">Amount (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    {{journeyRows}}
                    <tr>
                        <td style="border:1px solid #000; padding:8px;">Accommodation Details</td>
                        <td style="border:1px solid #000; padding:8px;">{{Escape(model.AccommodationDetails)}}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:right;">Rs.{{model.AccommodationCost:F2}}</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000; padding:8px;">Others</td>
                        <td style="border:1px solid #000; padding:8px;">{{Escape(model.OtherExpensesDetails)}}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:right;">Rs.{{model.OtherExpensesCost:F2}}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><strong>Total</strong></td>
                        <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>Rs.{{model.ExpectedCost:F2}}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <p class="english-text"><strong>Traveller:</strong> {{Escape(model.TravelerName)}} ({{Escape(model.TravelerTypeLabel)}})</p>
            <p class="english-text"><strong>Budget head:</strong> {{Escape(model.BudgetHeadName)}}</p>
            {{taxiNote}}

            <div style="text-align: right; margin-top: 50px;">
                <div style="display: inline-block; text-align: center;">
                    <p style="margin:0; padding:0;"><strong>{{Escape(model.FacultyName)}}</strong></p>
                    <p style="margin:0; padding:0;"><strong>{{Escape(model.FacultyDesignation)}}</strong></p>
                    <p style="margin:0; padding:0;"><strong>Department of {{Escape(model.FacultyDepartment)}}</strong></p>
                </div>
            </div>
        </div>
        """;
    }

    /// <summary>
    /// Legacy passed these through htmlspecialchars(). User-entered place, purpose
    /// and remarks reach this template verbatim, so they are escaped here too --
    /// without it an apostrophe or angle bracket would corrupt the rendered form.
    /// </summary>
    private static string Escape(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "&mdash;" : WebUtility.HtmlEncode(value);
}
