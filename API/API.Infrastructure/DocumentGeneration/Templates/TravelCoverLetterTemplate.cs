using System.Net;
using API.Application.Travel;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported from legacy process_travel_bill.php (the $html heredoc). Generated when
/// the travel bill is processed, after the request itself has been approved.
/// </summary>
/// <remarks>
/// Department and designation render blank when no faculty profile store is
/// configured -- see <c>IFacultyProfileProvider</c>. That matches the procurement
/// annexures and is deliberate: printing an invented designation would be worse
/// than printing an empty ruled entry.
/// </remarks>
public static class TravelCoverLetterTemplate
{
    public static string Render(TravelDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;
        var today = DateOnly.FromDateTime(DateTime.Now).ToString("dd-MM-yyyy");
        var onward = model.OnwardDate.ToString("dd MMM yyyy");
        var ret = model.ReturnDate.ToString("dd MMM yyyy");

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
            <p class="english-text" style="text-align: right;"><strong>Date:</strong> {{today}}</p>

            <p class="english-text" style="text-decoration: underline; text-align: justify;"><strong>Dean [R&C]</strong></p>
            <p class="english-text" style="text-align: justify;"><strong>Through:</strong> Head of the Department</p>

            <p class="english-text" style="text-align: justify;">This is to inform you that following visit was made from the travel head of the R&C project entitled <strong>'{{Escape(model.ProjectTitle)}}'</strong>
            funded by <strong>'{{Escape(model.Agency)}}'</strong>. Its details are given below-</p>

            <table>
                <thead>
                    <tr>
                        <th class="english-text">S. No.</th>
                        <th class="english-text">Traveller Name</th>
                        <th class="english-text">Place of Visit</th>
                        <th class="english-text">Purpose</th>
                        <th class="english-text">Period</th>
                        <th class="english-text">Mode of Travel</th>
                        <th class="english-text">Approved Cost (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="english-text">1.</td>
                        <td class="english-text">{{Escape(model.TravelerName)}}</td>
                        <td class="english-text">{{Escape(model.Place)}}</td>
                        <td class="english-text">{{Escape(model.Purpose)}}</td>
                        <td class="english-text">{{onward}} to {{ret}}</td>
                        <td class="english-text">{{model.PrimaryModeLabel}}</td>
                        <td class="english-text">Rs.{{model.ExpectedCost:F2}}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin:8px 0 3px;">
                <div class="english-text">Duly filled TA/DA form along with bills/receipts are also submitted for reimbursement.</div>
            </div>

            <div style="text-align: right; margin-top: 50px;">
                <div style="display: inline-block; text-align: center;">
                    <p style="margin:0; padding:0;"><strong>{{Escape(model.FacultyName)}}</strong></p>
                    <p style="margin:0; padding:0;"><strong>{{model.FacultyDesignation}}</strong></p>
                    <p style="margin:0; padding:0;"><strong>Department of {{model.FacultyDepartment}}</strong></p>
                </div>
            </div>
        </div>
        """;
    }

    /// <summary>
    /// Legacy passed these through htmlspecialchars(). Place, purpose and traveller
    /// name are user-entered, so an apostrophe or angle bracket would otherwise
    /// corrupt the rendered letter.
    /// </summary>
    private static string Escape(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "&mdash;" : WebUtility.HtmlEncode(value);
}
