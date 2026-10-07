using API.Application.Documents;

namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// Ported verbatim from legacy generate_cover_letter() (save_consumable.php:3510-3580).
/// Prepended to every annexure, followed by a page break.
/// </summary>
public static class IndentCoverLetterTemplate
{
    public static string Render(IndentDocumentModel model)
    {
        var logo = EmbeddedAssets.MnnitLogoDataUri;

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
            <p class="english-text" style="text-align: right;"><strong>Date:</strong> {{model.CurrentDate}}</p>

            <p class="english-text" style="text-decoration: underline; text-align: justify;"><strong>Dean [R&C]</strong></p>
            <p class="english-text" style="text-align: justify;"><strong>Through:</strong> Head of the Department</p>

            <p class="english-text" style="text-align: justify;">This is to inform you that following items are required from the consumable head of the R&C project entitled <strong>'{{model.ProjectTitle}}'</strong>
            funded by <strong>'{{model.Agency}}'</strong>. Its details are given below-</p>

            <table style="width:100%; border-collapse:collapse; margin:5px 0;">
                <thead>
                    <tr>
                        <th class="english-text" style="width:5%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">S. No.</th>
                        <th class="english-text" style="width:20%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">Name of the item [Consumables]</th>
                        <th class="english-text" style="width:20%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">Details</th>
                        <th class="english-text" style="width:15%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">Cost</th>
                        <th class="english-text" style="width:10%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">GeM</th>
                        <th class="english-text" style="width:15%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">Mode of Purchase</th>
                        <th class="english-text" style="width:15%;border:1px solid #000;padding:3px;text-align:center;background-color:#e0e0e0;font-weight:bold;font-size:10pt;">Status</th>
                    </tr>
                </thead>
                <tbody>
                <tr>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">1.</td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">{{model.ItemName}}</td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">
                        <div style="min-height:25px; padding:5px" class="english-text">Technical Specifications: {{model.TechnicalSpecs}}</div>
                        <div style="min-height:25px; padding:5px" class="english-text">Quantity: {{model.Quantity}}</div>
                    </td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">Rs.{{model.EstimatedCost}}</td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">{{model.GemAvailability}}</td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">{{model.ModeOfPurchase}}</td>
                    <td class="english-text" style="border:1px solid #000;padding:3px;text-align:center;">{{model.Status}}</td>
                </tr>
                </tbody>
            </table>

            <p class="english-text" style="text-align: justify;">Duly filled indent form is also submitted for necessary approval.</p>
            <span></span>
            <div class="signature" style="text-align: right; margin-top: 20px;">
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
