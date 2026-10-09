using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using PuppeteerSharp;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class KrutiDevFontRenderingTests
{
    /// <summary>
    /// Verifies the embedded Kruti Dev font actually loads in the renderer. The Hindi
    /// text throughout the annexures is legacy glyph-mapped Latin ("ek¡x i=" renders
    /// as "मांग पत्र" only through this font), so if the @font-face fails to load,
    /// every generated form silently prints Latin gibberish instead of Devanagari.
    ///
    /// Asserts by measuring rendered text width: the same string set in Kruti Dev
    /// versus a fallback serif produces different advance widths, so equal widths
    /// mean the custom font never applied.
    /// </summary>
    [Fact]
    public async Task KrutiDevFont_IsActuallyAppliedByTheRenderer()
    {
        var probeHtml = IndentHtmlShell.Wrap("""
            <span id="kruti" class="hindi-text" style="font-family:'Kruti Dev 010';font-size:12pt;">ek¡x i=</span>
            <span id="fallback" style="font-family:'Times New Roman', Times, serif;font-size:12pt;">ek¡x i=</span>
            """);

        var browserFetcher = new BrowserFetcher();
        await browserFetcher.DownloadAsync();

        await using var browser = await Puppeteer.LaunchAsync(new LaunchOptions { Headless = true });
        await using var page = await browser.NewPageAsync();
        await page.SetContentAsync(probeHtml, new SetContentOptions
        {
            WaitUntil = [WaitUntilNavigation.Load],
        });
        await page.EvaluateExpressionAsync("document.fonts.ready");

        var krutiWidth = await page.EvaluateExpressionAsync<double>(
            "document.getElementById('kruti').getBoundingClientRect().width");
        var fallbackWidth = await page.EvaluateExpressionAsync<double>(
            "document.getElementById('fallback').getBoundingClientRect().width");

        krutiWidth.Should().BeGreaterThan(0);
        fallbackWidth.Should().BeGreaterThan(0);
        krutiWidth.Should().NotBe(fallbackWidth,
            "identical widths mean the Kruti Dev @font-face never loaded and the browser fell back to a default font");
    }
}
