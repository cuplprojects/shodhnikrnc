using System.Text;
using API.Application.Documents;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported verbatim from legacy generate_annexure11_html() (save_consumable.php:2978-3509).
/// Non-GeM procurement requisition, Rs. 2,00,000 to Rs. 25 Lakh (PR-4B-1, green page).
/// Cites Rule 155 of GFR 2017 for the market-survey / quotation-evaluation committee.
/// </summary>
public static class Annexure11Template
{
    public static string Render(IndentDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;
        var committee = RenderCommitteeMembers(model);

        return $$"""
        <div class="annexure-header">
            <div class="blue-page-text">Print on Green Page</div>
        </div>
        <div style="height: 60px;"></div> <!-- Spacer to prevent content overlap -->
        <!-- PR Header -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:5px;">
            <tr>
                <td style="width:15%;" class="no-bg-black-text">
                    <span style="font-family:'Times New Roman', Times, serif;font-size:10pt;">PR-4B-1</span>
                </td>
                <td style="width:25%;" class="no-bg-black-text">
                    <span style="font-family:'Times New Roman', Times, serif;font-size:11pt;">Through Non-GeM Procurement</span>
                </td>
                <td style="width:60%;" class="no-bg-black-text">
                    <span class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;font-size:11pt;">la[;k@</span>
                    <span style="font-family:'Times New Roman', Times, serif;font-size:11pt;"> No.: {{model.IndentNumber}}</span>
                    <span style="font-family:'Times New Roman', Times, serif;font-size:11pt;">/FY: 2025-26 dt. {{model.IndentDate}}</span>
                </td>
            </tr>
        </table>

        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <img src="{{logo}}">
                </td>
                <td class="institute-cell">
                    <div style="font-family:'Kruti Dev 010';font-weight:bold;font-size:12pt;text-align:center;line-height:1.2;">eksrhyky usg# jk"Vªh; çkS|ksfxdh laLFkku] bykgkckn & ç;kxjkt 211004 ¼Hkkjr½</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:11pt;">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:9pt;">(An Institute of National Importance as Declared by NIT Act, GOI, 2007)</div>
                </td>
            </tr>
        </table>

        <!-- Annexure Title -->
        <div style="text-align:center;text-decoration: underline;font-weight:bold;margin:5px 0;">
            <span class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;font-size:12pt;">ek¡x i=</span>
            <span class="english-text">/ REQUISITION </span>
            <span class="english-text" style="font-family:'Times New Roman', Times, serif;font-size:9pt;">[Rs. 2,00,000 to Rs. 25 Lakh][Under Research & Consultancy Projects]</span>
        </div>

        <!-- Project Details -->
        <table style="width:100%; border-collapse:collapse; margin:5px 0;">
            <tr>
                <td style="width:50%;border:1px solid #000;padding:3px;">
                    <div class="english-text"><strong>Project Number:</strong> {{model.SanctionNo}} & <strong>Head:</strong> {{model.BudgetHeadName}}</div>
                </td>
            </tr>
        </table>

        <!-- Requester Details -->
        <table style="width:100%; border-collapse:collapse; margin:5px 0;">
            <tr>
                <td style="width:15%;border:1px solid #000;padding:3px;">
                    <div class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;">ekaxdrkZ dk uke</div>
                    <div class="english-text">Indenter's Name:</div>
                </td>
                <td style="width:35%;border:1px solid #000;padding:3px;">{{model.FacultyName}}</td>
                <td style="width:15%;border:1px solid #000;padding:3px;">
                    <div class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;">inuke</div>
                    <div class="english-text">Designation:</div>
                </td>
                <td style="width:35%;border:1px solid #000;padding:3px;">{{model.FacultyDesignation}}</td>
            </tr>
            <tr>
                <td style="border:1px solid #000;padding:3px;">
                    <div class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;">foHkkx@vuqHkkx@dsUnz</div>
                    <div class="english-text">Department/Section/Center:</div>
                </td>
                <td colspan="3" style="border:1px solid #000;padding:3px;">{{model.FacultyDepartment}}</td>
            </tr>
        </table>

        <!-- Section A: Item Requisitioned -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <span class="english-text">A). </span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">ekWxsa x;s lkeku dk fooj.k </span>
            <span class="english-text">/ Item Requisitioned:</span>
        </div>
        <table style="width:100%; border-collapse:collapse; margin:5px 0;">
            <thead>
                <tr>
                    <th style="width:5%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">Øe la0</div>
                        <div class="english-text">S.No.</div>
                    </th>
                    <th style="width:15%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">uke</div>
                        <div class="english-text">Name</div>
                    </th>
                    <th style="width:10%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">oxZ</div>
                        <div class="english-text">Consumables / Non-Consumables</div>
                    </th>
                    <th style="width:25%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">foLr`r rduhdh fo'ks"krk,a</div>
                        <div class="english-text">Detailed technical specifications</div>
                    </th>
                    <th style="width:10%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">eki dh bdkbZ</div>
                        <div class="english-text">Unit of Measurement</div>
                    </th>
                    <th style="width:10%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">ek=k</div>
                        <div class="english-text">Quantity</div>
                    </th>
                    <th style="width:15%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">vuqekfur jkf'k</div>
                        <div class="english-text">Estimated Cost (Rs.) Including TAX</div>
                    </th>
                </tr>
            </thead>
            <tbody>
        {{TemplateHelpers.RenderItems(model)}}
            </tbody>
        </table>
        <div style="font-size:10pt; margin-top:3px">
            <span class="english-text"><strong>Note:</strong></span>
            <ol style="list-style-type: lower-roman; text-align: justify; padding-left:15px; margin:5px 0;">
                <li class="english-text">Separate requisition is required for each item requisitioned.</li>
                <li class="english-text">Detailed specifications may be provided on separate sheets duly signed by Indenter.</li>
            </ol>
        </div>

        <!-- Section B: Stock Register -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <span class="english-text">B). </span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">eakxs x;s lkeku ls lcaf/kr LVkd jftLVj esa vafre izfof"V dk fooj.k </span>
            <span class="english-text">/ Last entry recorded in the Stock Register for indented item (s):</span>
        </div>
        <table style="width:100%; border-collapse:collapse; margin:5px 0;">
            <thead>
                <tr>
                    <th style="width:5%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">Øe la0</div>
                        <div class="english-text">S.No.</div>
                    </th>
                    <th style="width:25%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">LVkWd iqfLrdk dh i`"B la0 ,oa fnukad</div>
                        <div class="english-text">Stock Book page No. and Date</div>
                    </th>
                    <th style="width:20%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">fooj.k</div>
                        <div class="english-text">Description</div>
                    </th>
                    <th style="width:10%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">eki </div>
                        <div class="english-text">Qty.</div>
                    </th>
                    <th style="width:20%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">okLrfod ewY;@</div>
                        <div class="english-text">Actual Cost (Rs.) as per stock book</div>
                    </th>
                    <th style="width:20%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">
                        <div class="hindi-text" style="font-family:'Kruti Dev 010';">n'kk@</div>
                        <div class="english-text">Condition</div>
                    </th>
                </tr>
            </thead>
            <tbody>
        {{TemplateHelpers.RenderStock(model)}}
            </tbody>
        </table>

        <!-- Section C: Purpose -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <span class="english-text">C). </span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">mís'; ,oa vkSfpR; </span>
            <span class="english-text">/ Purpose and justification:</span>
        </div>
        <div style="border:1px solid #000; padding:5px; min-height:40px">
            {{model.Purpose}}
        </div>

        <!-- Section D: Procurement Method -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <span class="english-text">D). </span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">[kjhn dh fof/k dk lq>ko </span>
            <span class="english-text">/ Suggested method of procurement (Strike off whichever is not applicable):</span>
        </div>
        <div class="english-text" style="margin-left: 20px;">
                <div style="margin-top: 10px;">
                    <strong>(a) Rule 155 of GFR2017:</strong> Committee for market survey and evaluation of quotations
                </div>
            <table class="no-border-table" style="width:100%; margin-top:15px;">
                <tr>
                    <td style="width:45%; vertical-align: center; padding:0">
                        <div class="english-text">(1) HoD/Chairperson of Cell/Centre/Dean</div>
                    </td>
                    <td style="width:40%; vertical-align: center; padding:0">
        {{committee}}
                    </td>
                    <td style="width:15%; vertical-align: center; padding:0">
                        <div class="english-text">(3) Indenter</div>
                    </td>
                </tr>
                <tr>
                    <td style="width:45%; vertical-align: center; padding:0">
                        <div class="english-text">(4) AR [R&C]/Dy. Registrar</div>
                    </td>
                    <td style="width:40%; vertical-align: center; padding:0">
                        <div class="english-text">(5) AR [Admin-III]</div>
                    </td>
                    <td style="width:15%; vertical-align: center; padding:0">
                        <div class="english-text">(6) FIP</div>
                    </td>
                </tr>
            </table>
            <div style="margin-top: 10px;">
                (b) Single Tender Enquiry for Proprietary Item-<strong>Rule 166 of GFR 2017</strong> <span style="font-size:9pt;">(Please attach Certificate Rule 166 of GFR 2017)</span>
            </div>
        </div>

        <!-- Section E: Certificate -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <span class="english-text">E). </span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">izek.ki= </span>
            <span class="english-text">/ Certificate:</span>
        </div>
        <ol style="list-style-type: lower-roman; text-align: justify; padding-left:15px; margin:5px 0;">
            <li class="english-text">The specifications in terms of quality, type etc. and also quantity of goods to be procured is clearly spelt out keeping in view of the specific needs.</li>
            <li class="english-text">The specifications given above are to meet the basic needs of the department/Section/Center/Cell and are without including superfluous and non-essential features which may result in unwarranted expenditure.</li>
            <li class="english-text">The specifications are broad-based to the extent feasible. Efforts are made to use section standard specifications, which are widely known to the industry, and do not have any restrictive parameter to suit a particular bidder.</li>
            <li class="english-text">Also, certified that I have checked the indent and further certify that details and specifications of all accessories/add-ons /power supply/software required for installation/operation of indented item, have been indented in this indent.</li>
            <li class="english-text">It is certified that the estimated rate is reasonable and Equipment /Consumable is required for research purpose.</li>
        </ol>

        <!-- Section F: Additional Information -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <div class="english-text">Additional Information <span style="font-size:9pt;">(Strike off whichever is not applicable)</span>:</div>
        </div>
                {{TemplateHelpers.RenderSectionF(model)}}

        <!-- Enclosures -->
        <table style="width:100%; border-collapse:collapse; margin-top:5px;">
            <tr>
                <td style="width:35%;border:1px solid #000;padding:3px;">
                    <div class="english-text">Copy of estimate</div>
                    <div class="english-text"><strong>(Please tick)</strong></div>
                </td>
                <td style="width:20%;border:1px solid #000;padding:3px;text-align:center;font-size:14pt;">
                    <span>&#10003;</span>
                </td>
                <td style="width:85%;border:1px solid #000;padding:3px;">
                    <div class="english-text">Copy of specifications duly signed by the indenter</div>
                    <div class="english-text"><strong>(Please tick)</strong></div>
                </td>
                {{TemplateHelpers.RenderEstimateTickCell()}}
                <td style="width:50%;border:1px solid #000;padding:3px;">
                    <div class="english-text">GeMAR&PTS Report </div>
                    <div class="english-text"><strong>(Please tick)</strong></div>
                </td>
                <td style="width:20%;border:1px solid #000;padding:3px;">
                    <span>    </span>
                </td>
            </tr>
        </table>
        <div style="font-size:10pt; text-align: justify; margin-top:3px">
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">çekf.kr fd;k tkrk gS fd okafNr fof'k"Vrkvksa okyh oLrq</span>
            <span class="english-text">GeM</span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">ij miyCèk ugÈ gSA</span>
            <span class="english-text">Certified that the subject item with desired specifications is /are not found available on GeM [</span>
            <span class="hindi-text" style="font-family:'Kruti Dev 010';">[[kjhn dh fof/k dk lq>ko</span>
            <!--
                Legacy save_consumable.php:3303 tags this English phrase as hindi-text,
                which renders it through Kruti Dev as Devanagari gibberish on the printed
                form. The other five occurrences of the same phrase in the legacy file
                (lines 556, 1035, 1572, 2639, 2767) all use english-text, so this is an
                isolated typo rather than intent. Corrected here.
            -->
            <span class="english-text">Suggested method of procurement:</span>
            <span class="english-text"><strong> GeM Rule-155 and Gem Rule-166 of GFR-2017 upto 25,00,000/-</strong> [GeMARPTS Report is to be enclosed]</span>
        </div>

        <!-- Signatures -->
        <table class="no-border-table" style="width:100%; margin-top:15px;">
            <!-- First Row - Signature and Date -->
            <tr>
                <!-- Signature Column (wider) -->
                <td colspan="2" style="width:90%; vertical-align: bottom; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">ekWxdrkZ ds gLrk{kj </span>
                            <span class="english-text">/ Indenter's Signature:</span>
                        </div>
                    </div>
                </td>

                <!-- Date Column (narrower) -->
                <td style="width:10%; vertical-align: bottom; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">fnukad </span>
                            <span class="english-text">/ Date:</span>
                        </div>
                    </div>
                </td>
            </tr>

            <!-- Second Row - Recommendation (Full Width) -->
            <tr>
                <td colspan="3" style="padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">foHkkx@vuqHkkx@dsUn ds izeq[k dh laLrqfr </span>
                            <span class="english-text">/ Recommendation of Head of department/section/center:</span>
                        </div>
                    </div>
                </td>
            </tr>

            <!-- Third Row - Date, Name, Signature -->
            <tr>
                <!-- Date (narrowest) -->
                <td style="width:25%; vertical-align: bottom; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">fnukad </span>
                            <span class="english-text">/ Date:</span>
                        </div>
                    </div>
                </td>

                <!-- Name (wider) -->
                <td style="width:37.5%; vertical-align: bottom; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">uke </span>
                            <span class="english-text">/ Name:</span>
                        </div>
                    </div>
                </td>

                <!-- Signature (widest) -->
                <td style="width:37.5%; vertical-align: bottom; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">gLrk{kj </span>
                            <span class="english-text">/ Signature:</span>
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <!-- Office Use Section -->
        <div style="margin-top:15px; border-top:1px; padding-top:5px;">
            <div style="font-weight:bold;text-decoration: underline;">
                <div class="english-text">For Office Use of Dean R&C :</div>
            </div>

            <div style="font-weight:bold;margin:8px 0 3px;">
                <span class="english-text">G). </span>
                <span class="hindi-text" style="font-family:'Kruti Dev 010';">foRr miyC/krk fLFkfr </span>
                <span class="english-text">/ Fund Availability Status: For Project Funding</span>
            </div>

            <table class="no-border-table" style="width:100%; margin-top:15px;">
                <tr>
                    <td colspan="4" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">(a) Verified that the indented item is in the list of items sanctioned by competent authority for Project No.</span>
                            <span style="text-decoration: underline">{{model.SanctionNo}}</span>
                            <span class="english-text">Nature of item <strong>(Consumable/Non-consumable)</strong></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="width:25%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">Budget Head:</span>
                        </div>
                    </td>
                    <td style="width:25%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text"></span>
                        </div>
                    </td>
                    <td style="width:25%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">Allocation:</span>
                        </div>
                    </td>
                    <td style="width:25%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">Expenditure till:</span>
                        </div>
                    </td>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">Committed Expenditure till:</span>
                        </div>
                    </td>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text">Balance:</span>
                        </div>
                    </td>
                    <td colspan="2" style="padding:0">
                        <div style="min-height:25px; padding:5px">
                            <span class="english-text"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="4" style="padding:0">
                        <div style="min-height:25px; padding:5px" class="english-text">(b) Necessary funds are available to process this time:</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0; vertical-align: bottom;">
                        <div style="min-height:45px; padding:5px" class="english-text"><strong>Assistant Registrar (R&C)/Dy. Registrar</strong></div>
                    </td>
                    <td style="padding:0;l vertical-align: bottom;">
                        <div style="min-height:15px; vertical-align: bottom; padding:5px" class="english-text"><strong>Date: _________</strong></div>
                    </td>
                    <td style="padding:0; vertical-align: bottom;">
                        <div style="min-height:25px; vertical-align: bottom; padding:5px" class="english-text"><strong>Dean(R&C)</strong></div>
                    </td>
                    <td style="padding:0; vertical-align: bottom;">
                        <div style="min-height:15px; vertical-align: bottom; padding:5px" class="english-text"><strong>Date: _________</strong></div>
                    </td>
                </tr>
            </table>

            <table class="no-border-table" style="width:100%; margin-top:15px;">
                <tr>
                    <td style="width:30%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px" class="english-text">Approved</div>
                    </td>
                    <td style="width:10%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px" class="english-text">:</div>
                    </td>
                    <td style="width:60%; vertical-align: top; padding:0">
                        <div style="min-height:25px; text-align: justify; padding:5px" class="english-text">With financial sanction and issuance of purchase order (within 10% of escalation of estimated price and not total cost exceeding Rs.25 Lakhs).</div>
                    </td>
                </tr>
            </table>
            <table class="no-border-table" style="width:100%; margin-top:15px;">
                <tr>
                    <td style="width:30%; vertical-align: top; padding:0">
                        <div style="min-height:25px" class="english-text">Returned for Review/</div>
                        <div style="min-height:25px" class="english-text">Returned with note</div>
                    </td>
                    <td style="width:10%; vertical-align: top; padding:0">
                        <div style="min-height:25px; padding:5px" class="english-text">:</div>
                    </td>
                    <td style="width:60%; vertical-align: bottom; padding:0">
                        <div style="min-height:25px; text-align:center" class="english-text"><strong>(Director)</strong></div>
                    </td>
                </tr>
            </table>
        </div>
        """;
    }

    /// <summary>
    /// Renders the market-survey committee roster that occupied slot (2) of the legacy
    /// committee table. Legacy emitted a single line "(2) One faculty/Official ({suggested_faculty})";
    /// when the field was empty it still printed the line with empty parentheses so the form
    /// could be completed by hand. One line per committee member is emitted here, with the
    /// legacy blank line as the fallback.
    /// </summary>
    private static string RenderCommitteeMembers(IndentDocumentModel model)
    {
        // The interpolation hole sits at the raw string's own margin, so every emitted
        // line carries the full indentation that aligns it with the sibling <div>s.
        const string indent = "                        ";

        if (model.CommitteeMembers is null || model.CommitteeMembers.Count == 0)
        {
            return indent + "<div class=\"english-text\">(2) One faculty/Official ()</div>";
        }

        var sb = new StringBuilder();
        for (var i = 0; i < model.CommitteeMembers.Count; i++)
        {
            var member = model.CommitteeMembers[i];
            if (i > 0)
            {
                sb.Append('\n');
            }

            sb.Append(indent);

            // Slot (2) is numbered once; further members continue inside the same cell.
            sb.Append("<div class=\"english-text\">")
              .Append(i == 0 ? "(2) " : string.Empty)
              .Append(member.Name)
              .Append(" (")
              .Append(member.Role)
              .Append(")</div>");
        }

        return sb.ToString();
    }
}


