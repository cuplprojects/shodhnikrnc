using API.Application.Documents;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported verbatim from the legacy bill cover letter HTML in
/// process_consumable_bill.php (lines 101-204). This is a separate document from
/// the indent cover letter: it is past-tense ("has been procured"), submits a
/// signed bill for payment, and carries the five-point certification block that
/// the faculty member signs.
/// </summary>
public static class BillCoverLetterTemplate
{
    public static string Render(IndentDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;

        return $$"""
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <img src="{{logo}}" width="100">
                </td>
                <td class="institute-cell">
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Department of {{model.FacultyDepartment}}</div>
                    <div style="font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
                </td>
            </tr>
        </table>

        <div class="content">
            <p class="english-text" style="text-align: right;"><strong>Date:</strong> {{model.CurrentDate}}</p>

            <p class="english-text" style="text-decoration: underline; text-align: justify;"><strong>Dean [R&C]</strong></p>
            <p class="english-text" style="text-align: justify;"><strong>Through:</strong> Head of the Department</p>

            <p class="english-text" style="text-align: justify;">This is to inform you that following items has been procured from the consumable head of the R&C project entitled <strong>'{{model.ProjectTitle}}'</strong>
            funded by <strong>'{{model.Agency}}'</strong>. Duly signed bill is submitted for payment. Its details are given below-</p>

            <table>
                <thead>
                    <tr>
                        <th class="english-text">S. No.</th>
                        <th class="english-text">Name of the item [Consumables]</th>
                        <th class="english-text">Details</th>
                        <th class="english-text">Cost</th>
                        <th class="english-text">GeM</th>
                        <th class="english-text">Mode of Purchase</th>
                        <th class="english-text">Status</th>
                    </tr>
                </thead>
                <tbody>
                <tr>
                    <td class="english-text">1.</td>
                    <td class="english-text">{{model.ItemName}}</td>
                    <td class="english-text">
                        <div>Technical Specifications: {{model.TechnicalSpecs}}</div>
                        <div>Quantity: {{model.Quantity}}</div>
                    </td>
                    <td class="english-text">Rs. {{model.EstimatedCost}}</td>
                    <td class="english-text">{{model.GemAvailability}}</td>
                    <td class="english-text">{{model.ModeOfPurchase}}</td>
                    <td class="english-text">{{model.Status}}</td>
                </tr>
                </tbody>
            </table>

            <div style="font-weight:bold;margin:8px 0 3px;">
                <div class="english-text">We certify that-</div>
            </div>
            <ol style="padding-left: 20px; margin: 5px 0;">
                <li>
                    <div style="display: flex;">
                        <div>
                            <span class="english-text">The item has been received and stock entry has been made.</span>
                        </div>
                    </div>
                </li>
                <li>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="flex: 1;">
                            <span class="english-text">i) GeM non-availability certificate attached. [if applicable, otherwise strike off].</span>
                        </div>
                        <div style="flex: 0; padding: 0 10px;">
                            <span class="english-text">Or</span>
                        </div>
                        <div style="flex: 1;">
                            <span class="english-text">ii) GeM purchase order attached [if applicable, otherwise strike off].</span>
                        </div>
                    </div>
                </li>
                <li>
                    <div>
                        <span class="english-text">Bill is duly signed with remark 'verified and passed for payment'. </span>
                    </div>
                </li>
                <li>
                    <div style="display: flex;">
                        <div>
                            <span class="english-text">purchase of goods/chemicals has been made in accordance with GFR 2017. Similar items have not been procured without adherence to proper time gap and other conditions of GFR.</span>
                        </div>
                    </div>
                </li>
                <li>
                    <div style="display: flex;">
                        <div>
                            <span class="english-text">these items purchased are of the requisite quality and specification and have been purchased from a reliable supplier at a reasonable price.</span>
                        </div>
                    </div>
                </li>
            </ol>

            <div style="text-align: right; margin-top: 50px;">
                <div style="display: inline-block; text-align: center;">
                    <p class="english-text" style="margin:0; padding:0;"><strong>{{model.FacultyName}}</strong></p>
                    <p class="english-text" style="margin:0; padding:0;"><strong>{{model.FacultyDesignation}}</strong></p>
                    <p class="english-text" style="margin:0; padding:0;"><strong>Department of {{model.FacultyDepartment}}</strong></p>
                </div>
            </div>
        </div>
        """;
    }
}
