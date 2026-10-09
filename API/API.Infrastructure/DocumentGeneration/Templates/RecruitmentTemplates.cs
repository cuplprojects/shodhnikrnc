using System.Net;
using System.Text;
using API.Application.Recruitment;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// The recruitment documents, ported from legacy generate_advertisement.php,
/// generate_screening_proforma.php, generate_minutes_proforma.php and
/// generate_manpower_offer_letter.php.
/// </summary>
/// <remarks>
/// All six reuse <see cref="IndentHtmlShell"/> so recruitment, procurement and
/// travel share one set of fonts, page metrics and CSS class names.
/// </remarks>
public static class RecruitmentTemplates
{
    private const string UploadedImageSrcPrefix = "/uploads/advertisement-images/";

    public static string Advertisement(RecruitmentDocumentModel m, string? baseUrl = null)
    {
        // Section-driven rendering only when the advertise/readvertise call
        // actually chose a template. With no sections this falls through to
        // the free-text rendering below: the rich text editor is now the
        // sole source of the advertisement body, including the project/
        // agency/salary/dates details the fixed table used to print
        // automatically -- the PI types all of that directly into the
        // editor, so this branch no longer duplicates it in a separate
        // table above the editor's own text.
        if (m.ResolvedAdvertisementSections is { Count: > 0 })
        {
            return AdvertisementFromSections(m);
        }

        // Legacy printed the round only implicitly, by issuing a new document.
        // Naming it makes a re-advertised post obvious on the page itself.
        var roundNote = m.AdvertisementRound > 1
            ? $"<p class=\"english-text\"><strong>Advertisement round:</strong> {m.AdvertisementRound} (re-advertised)</p>"
            : string.Empty;

        var advertisementTextForRender = RewriteUploadedImageSrcToAbsolute(m.AdvertisementText, baseUrl);

        return Header(m) + $$"""
        <div class="content">
            {{roundNote}}

            {{(string.IsNullOrWhiteSpace(advertisementTextForRender)
                ? ""
                // AdvertisementText is sanitized before storage
                // (AdvertisementTextSanitizer, called from
                // RecruitmentService.AdvertiseAsync/ReadvertiseAsync), so
                // rendering it unescaped here is safe -- and required, so
                // the stored HTML markup actually renders as formatting
                // instead of literal angle-bracket text.
                : $"<div class=\"english-text\" style=\"margin-top:12px;\">{advertisementTextForRender}</div>")}}

            {{Signature(m)}}
        </div>
        """;
    }

    /// <summary>
    /// Puppeteer's page.SetContentAsync loads the assembled HTML with no base
    /// URL to resolve a relative src against, so any &lt;img src="/uploads/..."&gt;
    /// left in AdvertisementText (already guaranteed by
    /// AdvertisementTextSanitizer to only ever point under
    /// /uploads/advertisement-images/) must be rewritten to an absolute URL
    /// before the PDF renderer sees it, or the image silently fails to load.
    /// baseUrl is null when no HTTP context is available at render time (e.g.
    /// tests) -- in that case the text is returned unmodified, matching the
    /// pre-existing (relative-only) behavior.
    /// </summary>
    private static string RewriteUploadedImageSrcToAbsolute(string? advertisementText, string? baseUrl)
    {
        if (string.IsNullOrEmpty(advertisementText) || string.IsNullOrEmpty(baseUrl))
        {
            return advertisementText ?? string.Empty;
        }

        var trimmedBaseUrl = baseUrl.TrimEnd('/');
        return advertisementText.Replace(
            $"src=\"{UploadedImageSrcPrefix}",
            $"src=\"{trimmedBaseUrl}{UploadedImageSrcPrefix}");
    }

    /// <summary>
    /// Renders an advertisement from a resolved template's own sections, in the
    /// template's own order. The sections replace the old fixed Fellowship and
    /// Tenure rows plus the single free-text blob -- Salary and
    /// TenureOfAppointment are themselves sections now, so printing the fixed
    /// rows as well would print each of them twice.
    /// </summary>
    private static string AdvertisementFromSections(RecruitmentDocumentModel m)
    {
        var closing = m.ClosingDate?.ToString("dd MMM yyyy") ?? "&mdash;";
        var published = m.PublishedOn?.ToString("dd MMM yyyy") ?? "&mdash;";

        var roundNote = m.AdvertisementRound > 1
            ? $"<p class=\"english-text\"><strong>Advertisement round:</strong> {m.AdvertisementRound} (re-advertised)</p>"
            : string.Empty;

        var sections = new StringBuilder();
        foreach (var s in m.ResolvedAdvertisementSections!.Where(s => s.IsIncluded))
        {
            // Section content is PI-authored free text, so it goes through the
            // same escaping every other user-entered field on these documents
            // does; only the author's own line breaks are turned back into
            // markup, so a multi-line section still prints as multiple lines.
            var content = string.IsNullOrWhiteSpace(s.Content)
                ? "&mdash;"
                : WebUtility.HtmlEncode(s.Content).Replace("\r\n", "\n").Replace("\n", "<br>");

            sections.Append($$"""
            <div class="english-text" style="margin-top:10px;">
                <strong>{{SectionLabel(s.Key)}}:</strong> {{content}}
            </div>
            """);
        }

        return Header(m) + $$"""
        <div class="content">
            <h2 class="english-text" style="text-align:center;text-decoration:underline;">
                Advertisement for the Post of {{E(m.Designation)}}
            </h2>

            {{roundNote}}

            <table>
                <tr><th style="width:30%">Research Project Entitled</th><td>{{E(m.ProjectTitle)}}</td></tr>
                <tr><th>Funding Agency</th><td>{{E(m.Agency)}}</td></tr>
                <tr><th>Sanction Order No.</th><td>{{E(m.SanctionNo)}}</td></tr>
                <tr><th>Name of the Post</th><td>{{E(m.Designation)}}</td></tr>
                <tr><th>Number of the Position</th><td>{{m.Positions}}</td></tr>
                <tr><th>Date of Publication</th><td>{{published}}</td></tr>
                <tr><th>Last Date of Application</th><td>{{closing}}</td></tr>
            </table>

            {{sections}}

            {{Signature(m)}}
        </div>
        """;
    }

    private static string SectionLabel(API.Domain.Enums.AdvertisementSectionKey key) => key switch
    {
        API.Domain.Enums.AdvertisementSectionKey.EssentialQualifications => "Essential Qualifications",
        API.Domain.Enums.AdvertisementSectionKey.Salary => "Salary",
        API.Domain.Enums.AdvertisementSectionKey.OtherBenefits => "Other Benefits",
        API.Domain.Enums.AdvertisementSectionKey.AgeLimit => "Age Limit",
        API.Domain.Enums.AdvertisementSectionKey.TenureOfAppointment => "Tenure of Appointment",
        API.Domain.Enums.AdvertisementSectionKey.DesirableQualifications => "Desirable Qualifications (Not Mandatory)",
        API.Domain.Enums.AdvertisementSectionKey.HowToApply => "How to Apply",
        API.Domain.Enums.AdvertisementSectionKey.Notes => "Note",
        _ => key.ToString(),
    };

    public static string ScreeningProforma(RecruitmentDocumentModel m)
    {
        var rows = new StringBuilder();
        foreach (var c in m.Candidates)
        {
            rows.Append($$"""
            <tr>
                <td>{{c.SerialNumber}}</td>
                <td>{{E(c.Name)}}</td>
                <td>{{E(c.Qualification)}}</td>
                <td>{{E(c.Experience)}}</td>
                <td>{{E(c.ScreeningResultLabel)}}</td>
            </tr>
            """);
        }

        if (m.Candidates.Count == 0)
        {
            rows.Append("<tr><td colspan=\"5\" style=\"text-align:center;\">No applications received.</td></tr>");
        }

        return Header(m) + $$"""
        <div class="content">
            <h2 class="english-text" style="text-align:center;text-decoration:underline;">
                Screening Proforma
            </h2>

            <table>
                <tr><th style="width:30%">Title of the Project</th><td>{{E(m.ProjectTitle)}}</td></tr>
                <tr><th>Name of Funding Agency</th><td>{{E(m.Agency)}}</td></tr>
                <tr><th>Name, Designation and Department of the PI</th>
                    <td>{{E(m.PiName)}}, {{E(m.PiDesignation)}}, {{E(m.PiDepartment)}}</td></tr>
                <tr><th>Last date of Advertisement</th>
                    <td>{{m.ClosingDate?.ToString("dd MMM yyyy") ?? "&mdash;"}}</td></tr>
                <tr><th>Details of the Post</th><td>{{E(m.Designation)}} ({{m.Positions}} position(s))</td></tr>
            </table>

            <h3 class="english-text">Applicants</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width:6%">S. No.</th>
                        <th>Name</th>
                        <th>Qualification</th>
                        <th>Experience</th>
                        <th style="width:16%">Eligibility</th>
                    </tr>
                </thead>
                <tbody>{{rows}}</tbody>
            </table>

            {{CommitteeTable("Screening Committee", m.ScreeningCommittee)}}
        </div>
        """;
    }

    public static string SelectionProforma(RecruitmentDocumentModel m)
    {
        var coPiValue = !string.IsNullOrWhiteSpace(m.CoPiName) ? m.CoPiName : "NA";

        return Header(m) + $$"""
        <div class="content">
            <h2 class="english-text" style="text-align:center;text-decoration:underline;margin-bottom:10px;">
                Project Staff Selection Proforma
            </h2>

            <div style="text-align:center;text-decoration:underline;font-size:10pt;font-weight:bold;margin-bottom:20px;">
                Request for Dean (R&amp;C)'s Nominee in Selection Committee for the Appointment of the Project Staff
            </div>

            <div style="margin-bottom:10px;text-decoration:underline;">
                <strong>Dean (R&amp;C)</strong>
            </div>

            <div style="margin-bottom:10px;">
                <strong>Through-</strong> Head of Department
            </div>
            
            <div style="margin-bottom:10px;text-align:left;">
                <strong>Sub:</strong> Request for nominating members of the Selection committee for the appointment of the Project Staff
            </div>

            <table style="border:none;margin-bottom:20px;">
                <tr><th style="width:30%;text-align:left;border:none;">Title of the Project:</th><td style="border:none;">{{E(m.ProjectTitle)}}</td></tr>
                <tr><th style="text-align:left;border:none;">Name of Funding Agency:</th><td style="border:none;">{{E(m.Agency)}}</td></tr>
                <tr><th style="text-align:left;border:none;">Name, Designation and Department of the PI:</th>
                    <td style="border:none;">{{E(m.PiName)}}, {{E(m.PiDesignation)}}, {{E(m.PiDepartment)}}</td></tr>
                <tr><th style="text-align:left;border:none;">Details of the Post:</th>
                    <td style="border:none;">{{E(m.Designation)}} - {{m.Positions:00}}</td></tr>
            </table>

            <p style="margin-bottom:10px;">The constitution of the Selection Committee will be as under:</p>
            <table style="border:none;margin-bottom:30px;">
                <tr>
                    <td style="width:5%;border:none;">1.</td>
                    <th style="width:30%;text-align:left;border:none;">Head of Department</th>
                    <td style="border:none;">Chairperson</td>
                </tr>
                <tr>
                    <td style="border:none;">2.</td>
                    <th style="text-align:left;border:none;">...................................</th>
                    <td style="border:none;">Dean (R&amp;C) Nominee Member (Concern Department from MNNIT Allahabad)</td>
                </tr>
                <tr>
                    <td style="border:none;">3.</td>
                    <th style="text-align:left;border:none;">...................................</th>
                    <td style="border:none;">Dean (R&amp;C) Nominee Member (From Other Institute)</td>
                </tr>
                <tr>
                    <td style="border:none;">4.</td>
                    <th style="text-align:left;border:none;">Principal Investigator</th>
                    <td style="border:none;">Convener</td>
                </tr>
                <tr>
                    <td style="border:none;">5.</td>
                    <th style="text-align:left;border:none;">Co-PI (if any): {{E(coPiValue)}}</th>
                    <td style="border:none;">[Member]</td>
                </tr>
            </table>

            <div style="margin-top:40px;">
                <div style="text-align:right;">
                    <div style="margin-top:20px;">
                        <strong>Signature of PI with date</strong><br>
                        ({{E(m.PiName)}})
                    </div>
                </div>

                <div style="margin-top:20px;">Forwarded</div>
                
                <div style="text-align:right;margin-top:20px;">
                    <strong>Signature of HOD with date and seal</strong><br><br><br><br>
                </div>
                
                <div style="margin-top:20px;">Approval of evaluation committee</div>
                
                <div style="text-align:right;margin-top:20px;"> 
                    <strong>Signature of Dean (R&amp;C) with date and seal</strong>
                </div>
            </div>
        </div>
        """;
    }

    public static string MinutesOfSelection(RecruitmentDocumentModel m)
    {
        var ranked = m.Candidates.Where(c => c.MeritRank is not null)
            .OrderBy(c => c.MeritRank).ToList();

        var rows = new StringBuilder();
        foreach (var c in ranked)
        {
            rows.Append($$"""
            <tr>
                <td>{{c.MeritRank}}</td>
                <td>{{E(c.Name)}}</td>
                <td>{{E(c.Qualification)}}</td>
                <td>{{E(c.InterviewModeLabel)}}</td>
            </tr>
            """);
        }

        if (ranked.Count == 0)
        {
            rows.Append("<tr><td colspan=\"4\" style=\"text-align:center;\">No candidates were ranked.</td></tr>");
        }

        return Header(m) + $$"""
        <div class="content">
            <h2 class="english-text" style="text-align:center;text-decoration:underline;">
                Minutes of the Selection Committee
            </h2>

            <table>
                <tr><th style="width:30%">Project</th><td>{{E(m.ProjectTitle)}}</td></tr>
                <tr><th>Funding Agency</th><td>{{E(m.Agency)}}</td></tr>
                <tr><th>Post</th><td>{{E(m.Designation)}}</td></tr>
                <tr><th>Date of Interview</th>
                    <td>{{m.InterviewDate?.ToString("dd MMM yyyy") ?? "&mdash;"}}</td></tr>
                <tr><th>Time of Interview</th>
                    <td>{{m.InterviewTime?.ToString("hh:mm tt") ?? "&mdash;"}}</td></tr>
                <tr><th>Venue</th><td>{{E(m.InterviewVenue)}}</td></tr>
            </table>

            <h3 class="english-text">Merit Order</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width:10%">Merit</th>
                        <th>Name</th>
                        <th>Qualification</th>
                        <th style="width:20%">Interview Mode</th>
                    </tr>
                </thead>
                <tbody>{{rows}}</tbody>
            </table>

            {{CommitteeTable("Selection Committee", m.SelectionCommittee)}}
        </div>
        """;
    }

    public static string MeritList(RecruitmentDocumentModel m)
    {
        var ranked = m.Candidates.Where(c => c.MeritRank is not null)
            .OrderBy(c => c.MeritRank).ToList();

        var rows = new StringBuilder();
        foreach (var c in ranked)
        {
            rows.Append($$"""
            <tr>
                <td>{{c.MeritRank}}</td>
                <td>{{E(c.Name)}}</td>
                <td>{{E(c.Mobile)}}</td>
                <td>{{E(c.Qualification)}}</td>
            </tr>
            """);
        }

        return Header(m) + $$"""
        <div class="content">
            <h2 class="english-text" style="text-align:center;text-decoration:underline;">
                Merit List &mdash; {{E(m.Designation)}}
            </h2>

            <p class="english-text">
                Project: <strong>{{E(m.ProjectTitle)}}</strong>, funded by
                <strong>{{E(m.Agency)}}</strong> [Sanction order no.: {{E(m.SanctionNo)}}].
            </p>

            <table>
                <thead>
                    <tr>
                        <th style="width:10%">Merit</th>
                        <th>Name</th>
                        <th style="width:20%">Contact</th>
                        <th>Qualification</th>
                    </tr>
                </thead>
                <tbody>{{rows}}</tbody>
            </table>

            {{CommitteeTable("Selection Committee &mdash; signatures", m.SelectionCommittee)}}
        </div>
        """;
    }

    public static string OfferLetter(OfferLetterModel m) => OfferOrJoining(m, isOffer: true);

    public static string JoiningLetter(OfferLetterModel m) => OfferOrJoining(m, isOffer: false);

    private static string OfferOrJoining(OfferLetterModel m, bool isOffer)
    {
        var title = isOffer ? "Offer of Appointment" : "Joining Letter";
        var body = isOffer
            ? $"""
               <p class="english-text" style="text-align:justify;">
                   You are hereby offered the position of <strong>{E(m.Designation)}</strong> in the
                   research project entitled <strong>'{E(m.ProjectTitle)}'</strong>, funded by
                   <strong>{E(m.Agency)}</strong> [Sanction order no.: {E(m.SanctionNo)}].
               </p>
               <p class="english-text" style="text-align:justify;">
                   This offer is subject to your joining on or before the date shown below. Please
                   report to the Principal Investigator with the originals of all documents
                   submitted with your application.
               </p>
               """
            : $"""
               <p class="english-text" style="text-align:justify;">
                   This is to certify that <strong>{E(m.CandidateName)}</strong> has joined as
                   <strong>{E(m.Designation)}</strong> in the research project entitled
                   <strong>'{E(m.ProjectTitle)}'</strong>, funded by <strong>{E(m.Agency)}</strong>
                   [Sanction order no.: {E(m.SanctionNo)}].
               </p>
               """;

        var logo = EmbeddedAssets.MnnitLogoDataUri;
        var today = DateOnly.FromDateTime(DateTime.Now).ToString("dd-MM-yyyy");

        var parentLine = string.IsNullOrEmpty(m.ParentName) ? "" : $"S/o / D/o {E(m.ParentName)}<br>";
        var addressLine = string.IsNullOrEmpty(m.Address) ? "" : $"{E(m.Address)}<br>";
        
        var cityStateParts = new List<string>();
        if (!string.IsNullOrEmpty(m.City)) cityStateParts.Add(E(m.City));
        if (!string.IsNullOrEmpty(m.State)) cityStateParts.Add(E(m.State));
        var cityState = string.Join(", ", cityStateParts);
        var pin = string.IsNullOrEmpty(m.Pincode) ? "" : $" - {E(m.Pincode)}";
        var cityStatePincodeLine = string.IsNullOrEmpty(cityState) && string.IsNullOrEmpty(pin) ? "" : $"{cityState}{pin}<br>";

        return $$"""
        <table class="header-table">
            <tr>
                <td class="logo-cell"><img src="{{logo}}"></td>
                <td class="institute-cell">
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Department of {{E(m.PiDepartment)}}</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
                </td>
            </tr>
        </table>

        <div class="content">
            <p class="english-text" style="text-align:right;"><strong>Date:</strong> {{today}}</p>

            <h2 class="english-text" style="text-align:center;text-decoration:underline;">{{title}}</h2>

            <p class="english-text">
                To,<br>
                <strong>{{E(m.CandidateName)}}</strong><br>
                {{parentLine}}
                {{addressLine}}
                {{cityStatePincodeLine}}
            </p>

            {{body}}

            <table>
                <tr><th style="width:35%">Post</th><td>{{E(m.Designation)}}</td></tr>
                <tr><th>Fellowship</th><td>Rs. {{m.FellowshipAmount:F2}} per month</td></tr>
                <tr><th>HRA</th><td>Rs. {{m.HraAmount:F2}} per month</td></tr>
                <tr><th>{{(isOffer ? "Date of Joining" : "Joined On")}}</th><td>{{m.JoiningDate:dd MMM yyyy}}</td></tr>
                <tr><th>Tenure Valid Till</th><td>{{m.ValidTill:dd MMM yyyy}}</td></tr>
            </table>

            <div style="text-align:right; margin-top:50px;">
                <div style="display:inline-block; text-align:center;">
                    <p style="margin:0;"><strong>{{E(m.PiName)}}</strong></p>
                    <p style="margin:0;"><strong>{{E(m.PiDesignation)}}</strong></p>
                    <p style="margin:0;"><strong>Department of {{E(m.PiDepartment)}}</strong></p>
                </div>
            </div>
        </div>
        """;
    }

    // ------------------------------------------------------------- shared bits

    private static string Header(RecruitmentDocumentModel m)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;
        return $$"""
        <table class="header-table">
            <tr>
                <td class="logo-cell"><img src="{{logo}}"></td>
                <td class="institute-cell">
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Department of {{E(m.PiDepartment)}}</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
                </td>
            </tr>
        </table>
        """;
    }

    private static string Signature(RecruitmentDocumentModel m) => $$"""
        <div style="text-align:right; margin-top:50px;">
            <div style="display:inline-block; text-align:center;">
                <p style="margin:0;"><strong>{{E(m.PiName)}}</strong></p>
                <p style="margin:0;"><strong>{{E(m.PiDesignation)}}</strong></p>
                <p style="margin:0;"><strong>Department of {{E(m.PiDepartment)}}</strong></p>
            </div>
        </div>
        """;

    private static string CommitteeTable(string heading, IReadOnlyList<RecruitmentCommitteeRow> members)
    {
        if (members.Count == 0)
        {
            return string.Empty;
        }

        var rows = new StringBuilder();
        foreach (var member in members)
        {
            // Always a ruled blank for the wet signature. Where the portal has
            // recorded an electronic sign-off, that is noted beneath it as
            // provenance -- it does not replace the signature on the printed
            // page, and printing a tick in its place would misrepresent the
            // document.
            var recorded = member.HasSigned
                ? "<br><span style=\"font-size:8pt;\">recorded in portal</span>"
                : string.Empty;

            rows.Append($$"""
            <tr>
                <td>{{member.SerialNumber}}</td>
                <td>{{E(member.Name)}}<br><span style="font-size:9pt;">{{E(member.RoleLabel)}}</span></td>
                <td>{{E(member.Department)}}{{(member.IsExternal ? " (external)" : "")}}</td>
                <td>{{E(member.Position)}}</td>
                <td style="height:38px;">&nbsp;{{recorded}}</td>
            </tr>
            """);
        }

        return $$"""
        <h3 class="english-text">{{heading}}</h3>
        <table>
            <thead>
                <tr>
                    <th style="width:6%">S. No.</th>
                    <th>Name and Role</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th style="width:22%">Signature</th>
                </tr>
            </thead>
            <tbody>{{rows}}</tbody>
        </table>
        """;
    }

    /// <summary>
    /// Legacy passed these through htmlspecialchars(). Names, qualifications and
    /// advertisement text are user-entered, so an apostrophe or angle bracket
    /// would otherwise corrupt the rendered document.
    /// </summary>
    private static string E(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "&mdash;" : WebUtility.HtmlEncode(value);
}
