using System.Net;
using API.Application.Fellowship;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// "Form for claiming fellowship/salary/remuneration", ported from legacy
/// generate_stipend_form.php.
/// </summary>
/// <remarks>
/// The leave block is printed exactly where legacy put it -- inside the section
/// the PI completes, next to the recommended amount. Neither this template nor
/// anything upstream reduces the amount from those figures: the deduction, if
/// any, is the PI's decision recorded in the recommended amount (spec D2).
/// </remarks>
public static class StipendFormTemplate
{
    public static string Render(StipendFormModel m)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;

        // Legacy printed a ruled blank where the PI had not yet decided. Doing
        // the same rather than pre-filling the computed total, which would imply
        // a recommendation nobody made.
        var recommended = m.RecommendedAmount is { } amount
            ? $"Rs. {amount:N2}"
            : "....................";

        var overrideNote = m.HraIsOverridden
            ? $"""
               <tr>
                   <td class="field-label">8a. HRA overridden by the Dean/Director</td>
                   <td>: {E(m.HraOverrideReason)}</td>
               </tr>
               """
            : string.Empty;

        return $$"""
        <table class="header-table" style="width: 100%; border: none; margin-bottom: 5px;">
            <tr>
                <td style="width: 15%; border: none; text-align: center; vertical-align: top;">
                    <img src="{{logo}}" style="width: 100px;">
                </td>
                <td style="width: 85%; border: none; text-align: center;">
                    <div style="font-family: 'Mangal', sans-serif; font-size: 16pt; font-weight: bold;">आधिष्ठाता (शोध एवं परामर्श) कार्यालय</div>
                    <div style="font-family: 'Mangal', sans-serif; font-size: 16pt; font-weight: bold;">मोतीलाल नेहरू राष्ट्रीय प्रौद्योगिकी संस्थान</div>
                    <div style="font-family: 'Mangal', sans-serif; font-size: 14pt; font-weight: bold;">इलाहाबाद - 211004 (भारत)</div>
                    <div style="font-family: 'Times New Roman', Times, serif; font-size: 14pt; font-weight: bold; margin-top: 3px;">OFFICE OF THE DEAN (RESEARCH AND CONSULTANCY)</div>
                    <div style="font-family: 'Times New Roman', Times, serif; font-size: 14pt; font-weight: bold;">MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY</div>
                    <div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; font-weight: bold;">Allahabad – 211 004 (India)</div>
                    <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; font-weight: bold;">Website: <a href="http://www.mnnit.ac.in" style="color: blue; text-decoration: underline;">http://www.mnnit.ac.in</a></div>
                </td>
            </tr>
        </table>

        <h2 class="english-text" style="text-align:center;text-decoration:underline; font-size: 14pt; margin-bottom: 15px;">
            FORM FOR CLAIMING FELLOWSHIP/SALARY/REMUNERATION
        </h2>

        <style>
            .value { font-weight: bold; margin-left: 5px; margin-right: 10px; }
            .field-row { margin-bottom: 3px; }
        </style>
        <div style="width: 100%; line-height: 1; font-size: 9pt;">
            <div class="field-row">
                <strong>1. Name of the Project Staff/प्रोजेक्ट स्टॉफ का नाम:</strong> <span class="value">{{E(m.FellowName)}}</span><br>
                &nbsp;&nbsp;&nbsp;&nbsp;(Full Name in Block Letters/स्पष्ट अक्षरों में पूरा नाम)
            </div>
            <div class="field-row">
                <strong>2. Account No of Project Staff (with other Details)/खाता संख्या (अन्य विवरण के साथ):</strong> <span class="value">{{E(m.BankAccountNo)}} / IFSC: {{E(m.IfscCode)}}</span>
            </div>
            <table style="width: 100%; border: none; margin-bottom: 1px;">
                <tr>
                    <td style="border: none; width: 50%;">
                        <strong>3. Contact Details (Mob.)/सम्पर्क विवरण:</strong> <span class="value">{{E(m.Mobile)}}</span>
                    </td>
                    <td style="border: none; width: 50%;">
                        <strong>Email ID/ईमेल आई.डी.:</strong> <span class="value">{{E(m.Email)}}</span>
                    </td>
                </tr>
            </table>
            <table style="width: 100%; border: none; margin-bottom: 1px;">
                <tr>
                    <td style="border: none; width: 50%;">
                        <strong>4. Date of Joining/पद ग्रहण करने की तारीख:</strong> <span class="value">{{m.JoinedOn:dd MMM yyyy}}</span>
                    </td>
                    <td style="border: none; width: 50%;">
                        <strong>Date of Renewal/termination/अनुबन्ध नवीनीकरण / समाप्ति दिनांक:</strong> <span class="value">N/A</span>
                    </td>
                </tr>
            </table>
            <table style="width: 100%; border: none; margin-bottom: 1px;">
                <tr>
                    <td style="border: none; width: 50%;">
                        <strong>5. Designation/पदनाम:</strong> <span class="value">{{E(m.Designation)}}</span>
                    </td>
                    <td style="border: none; width: 50%;">
                        <strong>Department/विभाग:</strong> <span class="value">{{E(m.PiDepartment)}}</span>
                    </td>
                </tr>
            </table>
            <div class="field-row">
                <strong>6. Period for which the claim of Fellowship/Salary/अवधि जिसके लिए वेतन/छात्रवृत्ति का दावा होना है:</strong> <span class="value">{{m.PeriodFrom:dd MMM yyyy}} to {{m.PeriodTo:dd MMM yyyy}}</span>
            </div>
            <div class="field-row">
                <strong>7. Rate of Fellowship/Salary per month/प्रतिमाह वेतन/छात्रवृत्ति की दर:</strong> Rs. <span class="value">{{m.FellowshipAmount:N2}}</span> <strong>HRA:</strong> Rs. <span class="value">{{m.HraAmount:N2}}</span> <strong>Total:</strong> Rs. <span class="value">{{m.TotalAmount:N2}}</span>
            </div>
            <div class="field-row">
                <strong>8. Sanction No. and Sanction Amount/स्वीकृत/संस्तुत धनराशि:</strong> <span class="value">{{E(m.SanctionNo)}} / Rs. {{m.TotalSanctioned:N2}}</span>
            </div>
            <div class="field-row">
                <strong>9. Name of the PI &amp; Department/मुख्य अन्वेषक एवं विभाग का नाम:</strong> <span class="value">{{E(m.PiName)}} / {{E(m.PiDepartment)}}</span>
            </div>
            <div class="field-row">
                <strong>10. Total Fund received/कुल प्राप्त अनुदान की धनराशि:</strong> Rs. <span class="value">{{m.TotalFundReceived:N2}}</span>
            </div>
            <div class="field-row">
                <strong>11. Name of the Scheme/Project/योजना का शीर्षक:</strong> <span class="value">{{E(m.ProjectTitle)}}</span>
            </div>
        </div>

        <table style="width:100%; margin: 5px 0 2px 0; border:none; font-size: 10pt;">
            <tr>
                <td style="border:none;text-align:left;">Date:</td>
                <td style="border:none;text-align:right;">Signature of the Project Staff</td>
            </tr>
        </table>

        <div style="text-align:center; font-weight:bold; margin-top: 3px; font-size: 9pt; line-height: 1.2;">
            (TO BE COMPLETED BY THE PRINCIPAL INVESTIGATOR/ DEPARTMENTAL OFFICE)<br>
            (मुख्य अन्वेषक/योजना स्टॉफ/विभागीय कार्यालय द्वारा भरा जायेगा)
        </div>

        <table style="width: 100%; border: none; line-height: 1.3; font-size: 9pt; margin-top: 3px;">
            <tr>
                <td style="border: none; width: 65%;">
                    <strong>a) Numbers of yearly leaves during the project period:</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;योजनावधि के दौरान वार्षिक छुट्टियों की संख्या
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.YearlyLeaveEntitlement}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>b) Total number of leaves taken:</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;अब तक उपभोग की गयी कुल छुट्टियों की संख्या
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.TotalLeavesTaken}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>c) Casual Leave/Medical Leave taken during the month:</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;माह के दौरान उपभोग की गयी छुट्टियों की संख्या
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.LeaveTakenThisMonth}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>d) No. of days unauthorized absence from duty during the month:</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;माह के दौरान अनाधिकृत अनुपस्थित के दिनों की संख्या
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.UnauthorisedAbsenceDays}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>e) Amount of fellowship/salary recommended:</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;वेतन/फेलोशिप हेतु सिफारिश की गयी धनराशि
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{recommended}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>f) Date of commencement of the project</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;योजना प्रारम्भ तिथि
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.ProjectStartDate:dd MMM yyyy}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>g) Date of completion of the project</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;योजना समाप्ति तिथि
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">{{m.ProjectEndDate:dd MMM yyyy}}</span></td>
            </tr>
            <tr>
                <td style="border: none;">
                    <strong>h) Fund available in Manpower Head</strong><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;मानवबल मद में उपलब्ध धनराशि
                </td>
                <td style="border: none; vertical-align: top;"><span class="value">Rs. {{m.ManpowerHeadFund:N2}}</span></td>
            </tr>
        </table>

        <table style="width:100%; margin-top:10px; border:none; font-size: 9pt;">
            <tr>
                <td style="width:50%; border:none; vertical-align:top; text-align:left; line-height: 1.3;">
                    <div>Recommendation of the P.I./Mentor with date</div>
                    <div>छात्रवृत्ति/वेतन भुगतान हेतु मुख्य अन्वेषक की सिफारिश</div>
                </td>
                <td style="width:50%; border:none; vertical-align:top; text-align:right; line-height: 1.3;">
                    <div>Forwarded by the Head of the Department</div>
                    <div>विभागाध्यक्ष द्वारा अग्रसारित किया गया</div>
                </td>
            </tr>
        </table>
        """;
    }

    /// <summary>
    /// Legacy passed these through htmlspecialchars(). Names, account details and
    /// override reasons are user-entered, so an apostrophe or angle bracket would
    /// otherwise corrupt the rendered form.
    /// </summary>
    private static string E(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "&mdash;" : WebUtility.HtmlEncode(value);
}
