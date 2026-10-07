using API.Application.Documents;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported verbatim from legacy generate_annexure6_html() (save_consumable.php:367-843).
/// GeM procurement requisition, up to Rs. 50,000/- (PR-3A).
/// </summary>
public static class Annexure6Template
{
    public static string Render(IndentDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;

        return $$"""
        <div class="annexure-header">
            <div class="blue-page-text">Print on Blue Page</div>
        </div>
        <div style="height: 60px;"></div> <!-- Spacer to prevent content overlap -->
        <!-- PR Header -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:5px;">
            <tr>
                <td style="width:10%;" class="no-bg-black-text">
                    <span style="font-family:'Times New Roman', Times, serif;font-size:12pt;">PR-3A</span>
                </td>
                <td style="width:30%;" class="no-bg-black-text">
                    <span style="font-family:'Times New Roman', Times, serif;font-size:12pt;">Through GeM Procurement</span>
                </td>
                <td style="width:60%;" class="no-bg-black-text">
                    <span class="hindi-text" style="font-family:'Kruti Dev 010';font-weight:bold;font-size:12pt;">la[;k@</span>
                    <span style="font-family:'Times New Roman', Times, serif;font-size:12pt;"> No.: {{model.IndentNumber}}</span>
                    <span style="font-family:'Times New Roman', Times, serif;font-size:12pt;">/FY: 2025-26 dt. {{model.IndentDate}}</span>
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
            <span class="english-text" style="font-family:'Times New Roman', Times, serif;font-size:12pt;">/ REQUISITION [Up to Rs. 50,000/-] [Under Research and Consultancy Projects]</span>
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
            <span class="english-text"><strong>Note: (i)</strong> Detailed specifications may be provided on separate sheets duly signed by Indenter.</span>
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
            <span class="english-text">/ Suggested method of procurement:</span>
            <span class="english-text">GeM - Rule 149 (i) of GFR-2017: Up to Rs. 50,000.00</span>
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
            <li class="english-text">It is certified that the estimated rate is reasonable.</li>
        </ol>

        <!-- Section F: Additional Information -->
        <div style="font-weight:bold;margin:8px 0 3px;">
            <div class="english-text">Additional Information:</div>
        </div>
        {{TemplateHelpers.RenderSectionF(model)}}

        <!-- Enclosures -->
        <table style="width:100%; border-collapse:collapse; margin-top:5px;">
            <tr>
                <td style="width:35%;border:1px solid #000;padding:3px;">
                    <div class="english-text">Copy of estimate</div>
                    <div class="english-text"><strong>(Please tick)</strong></div>
                </td>
                {{TemplateHelpers.RenderEstimateTickCell()}}
                <td style="width:85%;border:1px solid #000;padding:3px;">
                    <div class="english-text">Copy of specifications duly signed by the indenter</div>
                    <div class="english-text"><strong>(Please tick)</strong></div>
                </td>
                <td style="width:20%;border:1px solid #000;padding:3px;">
                    <span>    </span>
                </td>
            </tr>
        </table>

        <!-- Signatures -->
        <table class="no-border-table" style="width:100%; margin-top:15px;">
            <!-- First Row - Signature and Date -->
            <tr>
                <!-- Signature Column (wider) -->
                <td colspan="2" style="width:90%; vertical-align: top; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">ekWxdrkZ ds gLrk{kj </span>
                            <span class="english-text">/ Indenter's Signature:</span>
                        </div>
                    </div>
                </td>

                <!-- Date Column (narrower) -->
                <td style="width:10%; vertical-align: top; padding:0">
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
                <td style="width:25%; vertical-align: top; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">fnukad </span>
                            <span class="english-text">/ Date:</span>
                        </div>
                    </div>
                </td>

                <!-- Name (wider) -->
                <td style="width:37.5%; vertical-align: top; padding:0">
                    <div style="min-height:25px; padding:5px">
                        <div class="bilingual">
                            <span class="hindi-text" style="font-family:'Kruti Dev 010';">uke </span>
                            <span class="english-text">/ Name:</span>
                        </div>
                    </div>
                </td>

                <!-- Signature (widest) -->
                <td style="width:37.5%; vertical-align: top; padding:0">
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
                    <td colspan="2" style="padding:0; vertical-align: bottom;">
                        <div style="min-height:25px; padding:5px" class="english-text"><strong>A R (R&C)/DR (Concerned)</strong></div>
                    </td>
                    <td colspan="2" style="padding:0; vertical-align: bottom;">
                        <div style="min-height:25px; padding:5px" class="english-text"><strong>Date: _________</strong></div>
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
                        <div style="min-height:25px; padding:5px" class="english-text">1. <strong>Indent approved for the issuance of purchase order (PO).</strong></div>
                        <div style="min-height:25px; padding:5px" class="english-text">2. <strong>Financial Sanction within 10% of escalation of estimate and total cost not exceeding Rs. 50,000/- by Dean (R&C)</strong></div>
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
                        <div style="min-height:25px; text-align:center" class="english-text"><strong>________________</strong></div>
                        <div style="min-height:25px; text-align:center" class="english-text"><strong>Dean (R&C)</strong></div>
                    </td>
                </tr>
            </table>
        </div>
        """;
    }
}


