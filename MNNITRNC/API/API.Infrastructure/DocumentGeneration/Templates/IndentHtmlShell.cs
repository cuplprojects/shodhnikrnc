namespace API.Infrastructure.DocumentGeneration.Templates;

/// <summary>
/// The shared HTML document shell for generated indent PDFs — ported verbatim from
/// the legacy generate_indent_html() (save_consumable.php:270-366). The CSS class
/// names here are referenced throughout the ported annexure markup; do not rename them.
/// </summary>
public static class IndentHtmlShell
{
    public static string Wrap(string bodyHtml)
    {
        var regular = EmbeddedAssets.KrutiDevRegularBase64;
        var bold = EmbeddedAssets.KrutiDevBoldBase64;

        return $$"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Indent</title>
            <style>
                @font-face {
                    font-family: "Kruti Dev 010";
                    src: url(data:font/truetype;charset=utf-8;base64,{{regular}}) format("truetype");
                    font-weight: normal;
                }
                @font-face {
                    font-family: "Kruti Dev 010";
                    src: url(data:font/truetype;charset=utf-8;base64,{{bold}}) format("truetype");
                    font-weight: bold;
                }

                .logo-cell {
                    width: 95px;
                    vertical-align: middle;
                    padding: 0;
                }

                .logo-cell img {
                    width: 75px;
                    height: auto;
                }

                .annexure-header {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    text-align: center;
                    z-index: 100;
                }
                .annexure-box {
                    border: 2px solid #000;
                    padding: 5px 15px;
                    font-weight: bold;
                    display: inline-block;
                }
                .blue-page-text {
                    font-weight: bold;
                    margin-top: 5px;
                    font-size: 10pt;
                }

                body { font-family: Arial, sans-serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .header { text-align: center; margin-bottom: 30px; }
                .signature { margin-top: 50px; }
                .gem-section { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; }
                .page-break { page-break-before: always; }
                .hindi-text { font-family: "Kruti Dev 010"; }
                .english-text { font-family: "Times New Roman", Times, serif; }
            </style>
        </head>
        <body>{{bodyHtml}}</body></html>
        """;
    }
}
