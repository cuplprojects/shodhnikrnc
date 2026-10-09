using API.Application.Documents;
using PuppeteerSharp;
using PuppeteerSharp.Media;

namespace API.Infrastructure.DocumentGeneration;

/// <summary>
/// Renders HTML to PDF using headless Chromium via PuppeteerSharp.
/// The browser binary is downloaded on first use and cached locally.
/// </summary>
public class PuppeteerHtmlPdfRenderer : IHtmlPdfRenderer
{
    private static readonly SemaphoreSlim DownloadLock = new(1, 1);
    private static bool _browserReady;

    public async Task<byte[]> RenderAsync(string html, CancellationToken ct = default)
    {
        await EnsureBrowserAsync();

        await using var browser = await Puppeteer.LaunchAsync(new LaunchOptions
        {
            Headless = true,
        });
        await using var page = await browser.NewPageAsync();

        await page.SetContentAsync(html, new SetContentOptions
        {
            WaitUntil = [WaitUntilNavigation.Load],
        });

        return await page.PdfDataAsync(new PdfOptions
        {
            Format = PaperFormat.A4,
            PrintBackground = true,
        });
    }

    private static async Task EnsureBrowserAsync()
    {
        if (_browserReady)
        {
            return;
        }

        await DownloadLock.WaitAsync();
        try
        {
            if (!_browserReady)
            {
                var browserFetcher = new BrowserFetcher();
                await browserFetcher.DownloadAsync();
                _browserReady = true;
            }
        }
        finally
        {
            DownloadLock.Release();
        }
    }
}
