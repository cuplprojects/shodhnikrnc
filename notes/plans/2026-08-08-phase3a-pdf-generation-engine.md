# Phase 3a: PDF Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the document generation engine that renders pixel-accurate Annexure 6–11 indent forms and bill cover letters as PDFs, by porting the legacy HTML/CSS templates near-verbatim and rendering them with headless Chromium — plus GeM quotation PDF merging.

**Architecture:** An `IHtmlPdfRenderer` abstraction in `API.Application` wraps PuppeteerSharp (headless Chromium) in `API.Infrastructure`. Legacy PHP heredoc HTML templates are ported to C# raw string literals in a dedicated `API.Infrastructure/DocumentGeneration/Templates/` folder, one file per Annexure, sharing a common HTML shell that base64-embeds the Kruti Dev fonts and MNNIT logo exactly as legacy does. `IDocumentGenerationService` composes template + view-model → HTML → PDF bytes, then optionally merges an uploaded GeM quotation PDF via PdfSharpCore.

**Tech Stack:** .NET 8, PuppeteerSharp (headless Chromium HTML→PDF), PdfSharpCore (PDF merge), xUnit + FluentAssertions. Legacy font/logo assets copied from `Old/Source_Code/assets/`.

## Global Constraints

- Target framework `net8.0`, nullable + implicit usings enabled — matches every existing `.csproj`.
- **Pixel accuracy is the acceptance criterion.** Templates are ported from the legacy HTML near-verbatim — same tags, same inline styles, same class names, same content order. Do NOT "clean up", restructure, or re-indent the legacy markup while porting; fidelity beats tidiness here. Only PHP interpolation syntax (`{$var['key']}`) changes to C# (`{model.Property}`).
- **Hindi text is copied byte-for-byte from the legacy source.** It is Kruti Dev glyph-mapped Latin text (e.g. `ek¡x i=`), NOT Unicode Devanagari. Do not "fix", transliterate, or re-encode it — it only renders correctly through the embedded Kruti Dev font. Preserve exactly.
- Fonts (`K010.TTF`, `K010_Bold.ttf`) and the MNNIT logo are base64-embedded directly into the generated HTML via `@font-face` data URIs and an `<img>` data URI, exactly as legacy does — no external file references in the HTML, so rendering never depends on the renderer's filesystem access.
- Money is `decimal`. Dates are `DateOnly`.
- Generated PDFs go through Phase 1's existing `IDocumentStorageService` for persistence — this engine returns bytes/streams, it does not write files directly.
- No changes to Phase 1's `IDocumentStorageService`, `IWorkflowEngineService`, or Phase 2's project/grant code in this plan.

## Reference Material

The legacy templates live in `Old/Source_Code/save_consumable.php` (3,580 lines). Relevant function line ranges (all three `save_*.php` files contain byte-identical copies of these — use the consumable one as the source of truth):

| Legacy function | Lines | Ports to |
|---|---|---|
| `generate_indent_html` (HTML shell + font embed + template switch) | 270–366 | `IndentHtmlShell.cs` |
| `generate_annexure6_html` (GeM ≤₹50k) | 367–843 | `Annexure6Template.cs` |
| `generate_annexure7_html` (GeM ₹50k–1L) | 844–1380 | `Annexure7Template.cs` |
| `generate_annexure8_html` (GeM >₹1L) | 1381–1958 | `Annexure8Template.cs` |
| `generate_annexure9_html` (non-GeM ≤₹1L) | 1959–2444 | `Annexure9Template.cs` |
| `generate_annexure10_html` (non-GeM ₹1L–2L) | 2445–2977 | `Annexure10Template.cs` |
| `generate_annexure11_html` (non-GeM ₹2L–25L, committee) | 2978–3509 | `Annexure11Template.cs` |
| `generate_cover_letter` (prepended to every annexure) | 3510–3580 | `IndentCoverLetterTemplate.cs` |

Bill-phase cover letter template: `Old/Source_Code/process_consumable_bill.php` (single hardcoded HTML template, the "We certify that—" 5-point letter).

Data fields the templates interpolate (confirmed by extracting every `{$...}` occurrence): from project — `sanction_no`; from faculty — `name`, `designation`, `department`; from the item — `name`, `technical_specs`, `unit_of_measurement`, `quantity`, `purpose`, `estimated_cost`, `stock_book_page`, `stock_description`, `stock_quantity`, `stock_actual_cost`, `stock_condition`, and (Annexure 11 only) `suggested_faculty`.

---

## File Structure

```
API/
  API.Application/
    Documents/
      IHtmlPdfRenderer.cs                    (new)
      IPdfMerger.cs                          (new)
      IDocumentGenerationService.cs          (new)
      IndentDocumentModel.cs                 (new — view-model)
      ProcurementTier.cs                     (new — enum, shared with Phase 3b)
  API.Infrastructure/
    DocumentGeneration/
      PuppeteerHtmlPdfRenderer.cs            (new)
      PdfSharpPdfMerger.cs                   (new)
      DocumentGenerationService.cs           (new)
      EmbeddedAssets.cs                      (new — font/logo base64 loader)
      Templates/
        IndentHtmlShell.cs                   (new)
        IndentCoverLetterTemplate.cs         (new)
        Annexure6Template.cs                 (new)
        Annexure7Template.cs                 (new)
        Annexure8Template.cs                 (new)
        Annexure9Template.cs                 (new)
        Annexure10Template.cs                (new)
        Annexure11Template.cs                (new)
        BillCoverLetterTemplate.cs           (new)
    Assets/
      Fonts/K010.TTF                         (copied from legacy)
      Fonts/K010_Bold.ttf                    (copied from legacy)
      Images/mnnit-logo.png                  (copied from legacy)
  API/
    API.csproj                               (modify: PuppeteerSharp browser fetch on build)
    Program.cs                               (modify: DI registration)
  API.Tests/
    DocumentGeneration/
      DocumentGenerationServiceTests.cs      (new)
      PdfMergerTests.cs                      (new)
```

---

## Task 1: PDF renderer abstraction + PuppeteerSharp implementation

**Files:**
- Create: `API/API.Application/Documents/IHtmlPdfRenderer.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/PuppeteerHtmlPdfRenderer.cs`
- Modify: `API/API.Infrastructure/API.Infrastructure.csproj`
- Test: `API/API.Tests/DocumentGeneration/PuppeteerHtmlPdfRendererTests.cs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (consumed by Task 5's `DocumentGenerationService`):
  ```csharp
  public interface IHtmlPdfRenderer
  {
      Task<byte[]> RenderAsync(string html, CancellationToken ct = default);
  }
  ```
  Renders at A4 with `printBackground: true` (legacy uses background colors on table headers — without this they render white).

- [ ] **Step 1: Add the PuppeteerSharp package**

Run:
```bash
cd D:/Projects/MNNITRNC
dotnet add API/API.Infrastructure/API.Infrastructure.csproj package PuppeteerSharp
```

- [ ] **Step 2: Write the failing test**

`API/API.Tests/DocumentGeneration/PuppeteerHtmlPdfRendererTests.cs`:
```csharp
using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class PuppeteerHtmlPdfRendererTests
{
    [Fact]
    public async Task RenderAsync_SimpleHtml_ProducesPdfBytes()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();

        var bytes = await renderer.RenderAsync("<html><body><h1>Hello</h1></body></html>");

        bytes.Should().NotBeEmpty();
        // A PDF file always starts with the magic bytes "%PDF-"
        System.Text.Encoding.ASCII.GetString(bytes, 0, 5).Should().Be("%PDF-");
    }

    [Fact]
    public async Task RenderAsync_MultiPageHtml_ProducesMultiPagePdf()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var html = "<html><body><div>Page one</div>" +
                   "<div style='page-break-before: always;'>Page two</div></body></html>";

        var bytes = await renderer.RenderAsync(html);

        // Each page object in a PDF is marked with "/Type /Page" (not /Pages).
        var content = System.Text.Encoding.ASCII.GetString(bytes);
        var pageCount = System.Text.RegularExpressions.Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
        pageCount.Should().BeGreaterThanOrEqualTo(2);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter PuppeteerHtmlPdfRendererTests`
Expected: FAIL — compile error, `PuppeteerHtmlPdfRenderer` doesn't exist.

- [ ] **Step 4: Write `IHtmlPdfRenderer`**

`API/API.Application/Documents/IHtmlPdfRenderer.cs`:
```csharp
namespace API.Application.Documents;

public interface IHtmlPdfRenderer
{
    Task<byte[]> RenderAsync(string html, CancellationToken ct = default);
}
```

- [ ] **Step 5: Write `PuppeteerHtmlPdfRenderer`**

`API/API.Infrastructure/DocumentGeneration/PuppeteerHtmlPdfRenderer.cs`:
```csharp
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

        await page.SetContentAsync(html, new NavigationOptions
        {
            WaitUntil = [WaitUntilNavigation.Networkidle0],
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
                using var browserFetcher = new BrowserFetcher();
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter PuppeteerHtmlPdfRendererTests`
Expected: PASS — 2 tests passed. Note: the first run downloads Chromium (~150MB) and may take several minutes; this is expected and cached for subsequent runs.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Documents/IHtmlPdfRenderer.cs API/API.Infrastructure/DocumentGeneration/PuppeteerHtmlPdfRenderer.cs API/API.Infrastructure/API.Infrastructure.csproj API/API.Tests/DocumentGeneration/PuppeteerHtmlPdfRendererTests.cs
git commit -m "Add HTML-to-PDF renderer backed by headless Chromium"
```

---

## Task 2: PDF merger for GeM quotations

**Files:**
- Create: `API/API.Application/Documents/IPdfMerger.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/PdfSharpPdfMerger.cs`
- Modify: `API/API.Infrastructure/API.Infrastructure.csproj`
- Test: `API/API.Tests/DocumentGeneration/PdfMergerTests.cs`

**Interfaces:**
- Consumes: `IHtmlPdfRenderer` (Task 1) in tests only, to produce real PDFs to merge.
- Produces (consumed by Task 5):
  ```csharp
  public interface IPdfMerger
  {
      byte[] Merge(IReadOnlyList<byte[]> pdfDocuments);
  }
  ```
  Concatenates the pages of each input PDF in order into one document. Matches legacy's FPDI page-append behavior (generated indent pages first, then quotation pages).

- [ ] **Step 1: Add the PdfSharpCore package**

Run:
```bash
cd D:/Projects/MNNITRNC
dotnet add API/API.Infrastructure/API.Infrastructure.csproj package PdfSharpCore
```

- [ ] **Step 2: Write the failing test**

`API/API.Tests/DocumentGeneration/PdfMergerTests.cs`:
```csharp
using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class PdfMergerTests
{
    private static int CountPages(byte[] pdf)
    {
        var content = System.Text.Encoding.ASCII.GetString(pdf);
        return System.Text.RegularExpressions.Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
    }

    [Fact]
    public async Task Merge_TwoDocuments_ProducesCombinedPageCount()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var first = await renderer.RenderAsync("<html><body><div>A</div></body></html>");
        var second = await renderer.RenderAsync("<html><body><div>B</div></body></html>");
        var merger = new PdfSharpPdfMerger();

        var merged = merger.Merge([first, second]);

        merged.Should().NotBeEmpty();
        CountPages(merged).Should().Be(CountPages(first) + CountPages(second));
    }

    [Fact]
    public async Task Merge_SingleDocument_ReturnsEquivalentPageCount()
    {
        var renderer = new PuppeteerHtmlPdfRenderer();
        var only = await renderer.RenderAsync("<html><body><div>Only</div></body></html>");
        var merger = new PdfSharpPdfMerger();

        var merged = merger.Merge([only]);

        CountPages(merged).Should().Be(CountPages(only));
    }

    [Fact]
    public void Merge_EmptyList_Throws()
    {
        var merger = new PdfSharpPdfMerger();

        var act = () => merger.Merge([]);

        act.Should().Throw<ArgumentException>();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter PdfMergerTests`
Expected: FAIL — compile error, `PdfSharpPdfMerger` doesn't exist.

- [ ] **Step 4: Write `IPdfMerger`**

`API/API.Application/Documents/IPdfMerger.cs`:
```csharp
namespace API.Application.Documents;

public interface IPdfMerger
{
    byte[] Merge(IReadOnlyList<byte[]> pdfDocuments);
}
```

- [ ] **Step 5: Write `PdfSharpPdfMerger`**

`API/API.Infrastructure/DocumentGeneration/PdfSharpPdfMerger.cs`:
```csharp
using API.Application.Documents;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace API.Infrastructure.DocumentGeneration;

public class PdfSharpPdfMerger : IPdfMerger
{
    public byte[] Merge(IReadOnlyList<byte[]> pdfDocuments)
    {
        if (pdfDocuments.Count == 0)
        {
            throw new ArgumentException("At least one PDF document is required to merge.", nameof(pdfDocuments));
        }

        using var output = new PdfDocument();

        foreach (var pdfBytes in pdfDocuments)
        {
            using var inputStream = new MemoryStream(pdfBytes);
            using var input = PdfReader.Open(inputStream, PdfDocumentOpenMode.Import);

            for (var pageIndex = 0; pageIndex < input.PageCount; pageIndex++)
            {
                output.AddPage(input.Pages[pageIndex]);
            }
        }

        using var outputStream = new MemoryStream();
        output.Save(outputStream);
        return outputStream.ToArray();
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter PdfMergerTests`
Expected: PASS — 3 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Documents/IPdfMerger.cs API/API.Infrastructure/DocumentGeneration/PdfSharpPdfMerger.cs API/API.Infrastructure/API.Infrastructure.csproj API/API.Tests/DocumentGeneration/PdfMergerTests.cs
git commit -m "Add PDF merger for appending GeM quotation pages to generated indents"
```

---

## Task 3: Embedded assets (Kruti Dev fonts + MNNIT logo)

**Files:**
- Create: `API/API.Infrastructure/Assets/Fonts/K010.TTF` (copied)
- Create: `API/API.Infrastructure/Assets/Fonts/K010_Bold.ttf` (copied)
- Create: `API/API.Infrastructure/Assets/Images/mnnit-logo.png` (copied)
- Create: `API/API.Infrastructure/DocumentGeneration/EmbeddedAssets.cs`
- Modify: `API/API.Infrastructure/API.Infrastructure.csproj` (embed as resources)
- Test: `API/API.Tests/DocumentGeneration/EmbeddedAssetsTests.cs`

**Interfaces:**
- Produces (consumed by Task 4's HTML shell):
  ```csharp
  public static class EmbeddedAssets
  {
      public static string KrutiDevRegularBase64 { get; }
      public static string KrutiDevBoldBase64 { get; }
      public static string MnnitLogoBase64 { get; }
  }
  ```
  All three are lazily loaded once from embedded resources and cached — the font files are ~57KB/~68KB, so base64-encoding them on every PDF render would be wasteful.

- [ ] **Step 1: Copy the asset files from the legacy source**

Run:
```bash
cd D:/Projects/MNNITRNC
mkdir -p API/API.Infrastructure/Assets/Fonts API/API.Infrastructure/Assets/Images
cp Old/Source_Code/assets/fonts/K010.TTF API/API.Infrastructure/Assets/Fonts/K010.TTF
cp Old/Source_Code/assets/fonts/K010_Bold.ttf API/API.Infrastructure/Assets/Fonts/K010_Bold.ttf
```

For the logo: legacy embeds it from `assets/images/`. Locate the exact file the indent generator uses by reading how `$logoBase64` is built in `Old/Source_Code/save_consumable.php` (search for `logoBase64` near the top of the file), then copy that specific file to `API/API.Infrastructure/Assets/Images/mnnit-logo.png`. Report in your task report which legacy file you copied.

- [ ] **Step 2: Register the assets as embedded resources**

Add to `API/API.Infrastructure/API.Infrastructure.csproj` inside a new `<ItemGroup>`:
```xml
  <ItemGroup>
    <EmbeddedResource Include="Assets\Fonts\K010.TTF" />
    <EmbeddedResource Include="Assets\Fonts\K010_Bold.ttf" />
    <EmbeddedResource Include="Assets\Images\mnnit-logo.png" />
  </ItemGroup>
```

- [ ] **Step 3: Write the failing test**

`API/API.Tests/DocumentGeneration/EmbeddedAssetsTests.cs`:
```csharp
using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class EmbeddedAssetsTests
{
    [Fact]
    public void KrutiDevRegularBase64_IsLoadedAndDecodesToTrueTypeFont()
    {
        var base64 = EmbeddedAssets.KrutiDevRegularBase64;

        base64.Should().NotBeNullOrEmpty();
        var bytes = Convert.FromBase64String(base64);
        // TrueType fonts start with the version tag 0x00010000.
        bytes.Take(4).Should().Equal([0x00, 0x01, 0x00, 0x00]);
    }

    [Fact]
    public void KrutiDevBoldBase64_IsLoadedAndDecodesToTrueTypeFont()
    {
        var base64 = EmbeddedAssets.KrutiDevBoldBase64;

        base64.Should().NotBeNullOrEmpty();
        var bytes = Convert.FromBase64String(base64);
        bytes.Take(4).Should().Equal([0x00, 0x01, 0x00, 0x00]);
    }

    [Fact]
    public void MnnitLogoBase64_IsLoadedAndDecodesToPng()
    {
        var base64 = EmbeddedAssets.MnnitLogoBase64;

        base64.Should().NotBeNullOrEmpty();
        var bytes = Convert.FromBase64String(base64);
        // PNG magic bytes.
        bytes.Take(4).Should().Equal([0x89, 0x50, 0x4E, 0x47]);
    }
}
```

If the logo copied in Step 1 turns out to be a JPEG rather than a PNG, adjust this third test's magic-byte assertion to `[0xFF, 0xD8, 0xFF]` (JPEG) and rename the asset file accordingly — report the deviation in your task report.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter EmbeddedAssetsTests`
Expected: FAIL — compile error, `EmbeddedAssets` doesn't exist.

- [ ] **Step 5: Write `EmbeddedAssets`**

`API/API.Infrastructure/DocumentGeneration/EmbeddedAssets.cs`:
```csharp
using System.Reflection;

namespace API.Infrastructure.DocumentGeneration;

/// <summary>
/// Loads and base64-encodes the font and image assets that generated indent HTML
/// embeds as data URIs. Values are cached — the fonts are ~60KB each and would
/// otherwise be re-encoded on every PDF render.
/// </summary>
public static class EmbeddedAssets
{
    private static readonly Lazy<string> KrutiDevRegular =
        new(() => LoadBase64("API.Infrastructure.Assets.Fonts.K010.TTF"));

    private static readonly Lazy<string> KrutiDevBold =
        new(() => LoadBase64("API.Infrastructure.Assets.Fonts.K010_Bold.ttf"));

    private static readonly Lazy<string> MnnitLogo =
        new(() => LoadBase64("API.Infrastructure.Assets.Images.mnnit-logo.png"));

    public static string KrutiDevRegularBase64 => KrutiDevRegular.Value;
    public static string KrutiDevBoldBase64 => KrutiDevBold.Value;
    public static string MnnitLogoBase64 => MnnitLogo.Value;

    private static string LoadBase64(string resourceName)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Embedded resource '{resourceName}' was not found. Available resources: " +
                string.Join(", ", assembly.GetManifestResourceNames()));

        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return Convert.ToBase64String(memory.ToArray());
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter EmbeddedAssetsTests`
Expected: PASS — 3 tests passed. If a resource-name mismatch error appears, the exception message lists the actual embedded resource names — correct the constants in `EmbeddedAssets` to match.

- [ ] **Step 7: Commit**

```bash
git add API/API.Infrastructure/Assets API/API.Infrastructure/DocumentGeneration/EmbeddedAssets.cs API/API.Infrastructure/API.Infrastructure.csproj API/API.Tests/DocumentGeneration/EmbeddedAssetsTests.cs
git commit -m "Embed Kruti Dev fonts and MNNIT logo as PDF generation assets"
```

---

## Task 4: View-model, HTML shell, and cover letter template

**Files:**
- Create: `API/API.Application/Documents/ProcurementTier.cs`
- Create: `API/API.Application/Documents/IndentDocumentModel.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/IndentHtmlShell.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/IndentCoverLetterTemplate.cs`
- Test: `API/API.Tests/DocumentGeneration/IndentHtmlShellTests.cs`

**Interfaces:**
- Consumes: `EmbeddedAssets` (Task 3).
- Produces (consumed by Tasks 5 and 6, and by Phase 3b's indent services):
  ```csharp
  public enum ProcurementTier
  {
      GemUpTo50k,            // Annexure 6
      Gem50kTo1Lakh,         // Annexure 7
      GemAbove1Lakh,         // Annexure 8
      NonGemUpTo1Lakh,       // Annexure 9
      NonGem1LakhTo2Lakh,    // Annexure 10
      NonGem2LakhTo25Lakh,   // Annexure 11
  }

  public record IndentCommitteeMemberModel(string Name, string Role);

  public record IndentDocumentModel(
      string SanctionNo,
      string BudgetHeadName,
      string FacultyName,
      string FacultyDesignation,
      string FacultyDepartment,
      string ItemName,
      string TechnicalSpecs,
      string UnitOfMeasurement,
      int Quantity,
      string Purpose,
      decimal EstimatedCost,
      string? StockBookPage,
      string? StockDescription,
      string? StockQuantity,
      string? StockActualCost,
      string? StockCondition,
      IReadOnlyList<IndentCommitteeMemberModel> CommitteeMembers);

  public static class IndentHtmlShell
  {
      public static string Wrap(string bodyHtml);
  }

  public static class IndentCoverLetterTemplate
  {
      public static string Render(IndentDocumentModel model);
  }
  ```

- [ ] **Step 1: Write `ProcurementTier` and `IndentDocumentModel`**

`API/API.Application/Documents/ProcurementTier.cs`:
```csharp
namespace API.Application.Documents;

public enum ProcurementTier
{
    GemUpTo50k,
    Gem50kTo1Lakh,
    GemAbove1Lakh,
    NonGemUpTo1Lakh,
    NonGem1LakhTo2Lakh,
    NonGem2LakhTo25Lakh,
}
```

`API/API.Application/Documents/IndentDocumentModel.cs`:
```csharp
namespace API.Application.Documents;

public record IndentCommitteeMemberModel(string Name, string Role);

public record IndentDocumentModel(
    string SanctionNo,
    string BudgetHeadName,
    string FacultyName,
    string FacultyDesignation,
    string FacultyDepartment,
    string ItemName,
    string TechnicalSpecs,
    string UnitOfMeasurement,
    int Quantity,
    string Purpose,
    decimal EstimatedCost,
    string? StockBookPage,
    string? StockDescription,
    string? StockQuantity,
    string? StockActualCost,
    string? StockCondition,
    IReadOnlyList<IndentCommitteeMemberModel> CommitteeMembers);
```

- [ ] **Step 2: Write the failing test**

`API/API.Tests/DocumentGeneration/IndentHtmlShellTests.cs`:
```csharp
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class IndentHtmlShellTests
{
    [Fact]
    public void Wrap_EmbedsBothKrutiDevFontFaces()
    {
        var html = IndentHtmlShell.Wrap("<div>body</div>");

        html.Should().Contain("@font-face");
        html.Should().Contain("font-family: \"Kruti Dev 010\"");
        html.Should().Contain("font-weight: normal");
        html.Should().Contain("font-weight: bold");
        html.Should().Contain("data:font/truetype;charset=utf-8;base64,");
    }

    [Fact]
    public void Wrap_PreservesLegacyStyleClasses()
    {
        var html = IndentHtmlShell.Wrap("<div>body</div>");

        // These class names are referenced by the ported annexure markup —
        // renaming any of them silently breaks layout fidelity.
        html.Should().Contain(".hindi-text");
        html.Should().Contain(".english-text");
        html.Should().Contain(".page-break");
        html.Should().Contain(".annexure-header");
        html.Should().Contain(".annexure-box");
        html.Should().Contain(".blue-page-text");
        html.Should().Contain(".logo-cell");
        html.Should().Contain(".gem-section");
        html.Should().Contain(".signature");
    }

    [Fact]
    public void Wrap_PlacesBodyHtmlInsideBodyTag()
    {
        var html = IndentHtmlShell.Wrap("<div id='marker'>content</div>");

        html.Should().Contain("<body>");
        html.Should().Contain("<div id='marker'>content</div>");
        html.Should().EndWith("</body></html>");
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentHtmlShellTests`
Expected: FAIL — compile error, `IndentHtmlShell` doesn't exist.

- [ ] **Step 4: Port the HTML shell from legacy**

Read `Old/Source_Code/save_consumable.php` lines 270–366 (the `generate_indent_html` function). Port the `<style>` block **verbatim** — every rule, same order, same values.

`API/API.Infrastructure/DocumentGeneration/Templates/IndentHtmlShell.cs`:
```csharp
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
```

Note the `$$"""..."""` raw string with doubled braces: `{{regular}}` interpolates, while literal CSS braces need no escaping. Verify the rendered output has real `{`/`}` in the CSS and the base64 values substituted.

- [ ] **Step 5: Port the cover letter template**

Read `Old/Source_Code/save_consumable.php` lines 3510–3580 (`generate_cover_letter`). Port the returned HTML verbatim into `IndentCoverLetterTemplate.Render`, replacing PHP interpolations with C# ones per this mapping:

| Legacy PHP | C# |
|---|---|
| `{$project['sanction_no']}` | `{model.SanctionNo}` |
| `{$faculty['name']}` | `{model.FacultyName}` |
| `{$faculty['designation']}` | `{model.FacultyDesignation}` |
| `{$faculty['department']}` | `{model.FacultyDepartment}` |
| `{$consumable['name']}` | `{model.ItemName}` |
| `{$consumable['technical_specs']}` | `{model.TechnicalSpecs}` |
| `{$consumable['unit_of_measurement']}` | `{model.UnitOfMeasurement}` |
| `{$consumable['quantity']}` | `{model.Quantity}` |
| `{$consumable['purpose']}` | `{model.Purpose}` |
| `{$consumable['estimated_cost']}` | `{model.EstimatedCost}` |
| `{$logoBase64}` | `{EmbeddedAssets.MnnitLogoBase64}` |

`API/API.Infrastructure/DocumentGeneration/Templates/IndentCoverLetterTemplate.cs`:
```csharp
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
        // PORT THE LEGACY HTML HERE, verbatim, using the interpolation mapping above.
        // Use $$"""...""" raw string syntax so literal CSS/HTML braces need no escaping.
        throw new NotImplementedException("Port from save_consumable.php:3510-3580");
    }
}
```

Replace the `throw` with the ported markup. The stub above exists only to make the file's contract clear — the task is not complete until real ported HTML is in place.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentHtmlShellTests`
Expected: PASS — 3 tests passed.

- [ ] **Step 7: Visual verification against the legacy reference**

Render a cover letter to PDF and inspect it:
```bash
cd D:/Projects/MNNITRNC
# Write a small throwaway console check, or add a temporary xUnit fact that renders
# IndentHtmlShell.Wrap(IndentCoverLetterTemplate.Render(sampleModel)) via
# PuppeteerHtmlPdfRenderer and writes the bytes to a file you can open.
```
Open the produced PDF and confirm: the MNNIT logo appears, Hindi text renders as readable Devanagari glyphs (not Latin gibberish — if it looks like `ek¡x i=`, the Kruti Dev font failed to load), and the layout matches the legacy cover letter. Report what you observed in your task report; if the Hindi renders as Latin characters, stop and report BLOCKED rather than proceeding — every later annexure depends on this working.

- [ ] **Step 8: Commit**

```bash
git add API/API.Application/Documents/ProcurementTier.cs API/API.Application/Documents/IndentDocumentModel.cs API/API.Infrastructure/DocumentGeneration/Templates/IndentHtmlShell.cs API/API.Infrastructure/DocumentGeneration/Templates/IndentCoverLetterTemplate.cs API/API.Tests/DocumentGeneration/IndentHtmlShellTests.cs
git commit -m "Add indent document view-model, HTML shell, and cover letter template"
```

---

## Task 5: Port Annexure templates 6, 7, and 8 (GeM tiers)

**Files:**
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure6Template.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure7Template.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure8Template.cs`
- Test: `API/API.Tests/DocumentGeneration/GemAnnexureTemplateTests.cs`

**Interfaces:**
- Consumes: `IndentDocumentModel` (Task 4), `EmbeddedAssets` (Task 3).
- Produces (consumed by Task 7):
  ```csharp
  public static class Annexure6Template { public static string Render(IndentDocumentModel model); }
  public static class Annexure7Template { public static string Render(IndentDocumentModel model); }
  public static class Annexure8Template { public static string Render(IndentDocumentModel model); }
  ```

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/DocumentGeneration/GemAnnexureTemplateTests.cs`:
```csharp
using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class GemAnnexureTemplateTests
{
    private static IndentDocumentModel SampleModel() => new(
        SanctionNo: "SAN-001",
        BudgetHeadName: "Recurring: Consumable",
        FacultyName: "Dr. A Sharma",
        FacultyDesignation: "Professor",
        FacultyDepartment: "Computer Science",
        ItemName: "Test Reagent Kit",
        TechnicalSpecs: "High purity, 500ml",
        UnitOfMeasurement: "Nos",
        Quantity: 4,
        Purpose: "Required for sample analysis",
        EstimatedCost: 42000m,
        StockBookPage: "12",
        StockDescription: "Prior kit",
        StockQuantity: "2",
        StockActualCost: "38000",
        StockCondition: "Consumed",
        CommitteeMembers: []);

    [Fact]
    public void Annexure6_RendersItemAndFacultyFields()
    {
        var html = Annexure6Template.Render(SampleModel());

        html.Should().Contain("Test Reagent Kit");
        html.Should().Contain("Dr. A Sharma");
        html.Should().Contain("Computer Science");
        html.Should().Contain("SAN-001");
        html.Should().Contain("42000");
    }

    [Fact]
    public void Annexure6_IdentifiesItselfAsTheUpTo50kGemForm()
    {
        var html = Annexure6Template.Render(SampleModel());

        // Legacy Annexure 6 carries the PR-3A code and the GFR Rule 149(i) citation.
        html.Should().Contain("PR-3A");
        html.Should().Contain("149");
    }

    [Fact]
    public void Annexure7_IdentifiesItselfAsThe50kTo1LakhGemForm()
    {
        var html = Annexure7Template.Render(SampleModel());

        html.Should().Contain("PR-3B");
    }

    [Fact]
    public void Annexure8_IncludesBidEvaluationCommitteeSection()
    {
        var html = Annexure8Template.Render(SampleModel());

        // Legacy Annexure 8 (GeM >1L) adds a bid-evaluation committee block.
        html.Should().Contain("Committee");
    }

    [Fact]
    public void AllGemAnnexures_RenderStockRegisterFields()
    {
        foreach (var html in new[]
                 {
                     Annexure6Template.Render(SampleModel()),
                     Annexure7Template.Render(SampleModel()),
                     Annexure8Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("Prior kit");
            html.Should().Contain("38000");
        }
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter GemAnnexureTemplateTests`
Expected: FAIL — compile error, the template classes don't exist.

- [ ] **Step 3: Port Annexure 6**

Read `Old/Source_Code/save_consumable.php` lines 367–843. Port the returned HTML **verbatim** into `Annexure6Template.Render`, using the same PHP→C# interpolation mapping from Task 4 Step 5, plus:

| Legacy PHP | C# |
|---|---|
| `{$consumable['stock_book_page']}` | `{model.StockBookPage}` |
| `{$consumable['stock_description']}` | `{model.StockDescription}` |
| `{$consumable['stock_quantity']}` | `{model.StockQuantity}` |
| `{$consumable['stock_actual_cost']}` | `{model.StockActualCost}` |
| `{$consumable['stock_condition']}` | `{model.StockCondition}` |

Use `$$"""..."""` raw strings. Preserve every `<div style="...">`, spacer div, table structure, and Hindi string byte-for-byte.

- [ ] **Step 4: Port Annexure 7**

Same process, from lines 844–1380 into `Annexure7Template.Render`.

- [ ] **Step 5: Port Annexure 8**

Same process, from lines 1381–1958 into `Annexure8Template.Render`. Note this annexure includes a bid-evaluation committee block; legacy fills it from the single `suggested_faculty` field. Render `model.CommitteeMembers` there instead — if the list is empty, render the same blank/placeholder line legacy produced when `suggested_faculty` was empty, so the form still prints correctly.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter GemAnnexureTemplateTests`
Expected: PASS — 5 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Infrastructure/DocumentGeneration/Templates/Annexure6Template.cs API/API.Infrastructure/DocumentGeneration/Templates/Annexure7Template.cs API/API.Infrastructure/DocumentGeneration/Templates/Annexure8Template.cs API/API.Tests/DocumentGeneration/GemAnnexureTemplateTests.cs
git commit -m "Port GeM-tier Annexure templates 6, 7, and 8 from legacy"
```

---

## Task 6: Port Annexure templates 9, 10, and 11 (non-GeM tiers)

**Files:**
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure9Template.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure10Template.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/Annexure11Template.cs`
- Test: `API/API.Tests/DocumentGeneration/NonGemAnnexureTemplateTests.cs`

**Interfaces:**
- Consumes: `IndentDocumentModel` (Task 4).
- Produces (consumed by Task 7): three `Render(IndentDocumentModel model)` methods matching Task 5's shape.

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/DocumentGeneration/NonGemAnnexureTemplateTests.cs`:
```csharp
using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class NonGemAnnexureTemplateTests
{
    private static IndentDocumentModel SampleModel(IReadOnlyList<IndentCommitteeMemberModel>? committee = null) => new(
        SanctionNo: "SAN-002",
        BudgetHeadName: "Equipment/Non-recurring",
        FacultyName: "Dr. B Kumar",
        FacultyDesignation: "Associate Professor",
        FacultyDepartment: "Mechanical Engineering",
        ItemName: "Vacuum Pump",
        TechnicalSpecs: "Two-stage rotary vane",
        UnitOfMeasurement: "Nos",
        Quantity: 1,
        Purpose: "Vacuum chamber experiments",
        EstimatedCost: 350000m,
        StockBookPage: "45",
        StockDescription: "Older pump",
        StockQuantity: "1",
        StockActualCost: "180000",
        StockCondition: "Unserviceable",
        CommitteeMembers: committee ?? []);

    [Fact]
    public void Annexure9_RendersItemAndFacultyFields()
    {
        var html = Annexure9Template.Render(SampleModel());

        html.Should().Contain("Vacuum Pump");
        html.Should().Contain("Dr. B Kumar");
        html.Should().Contain("350000");
    }

    [Fact]
    public void NonGemAnnexures_CiteTheMarketSurveyCommitteeRule()
    {
        // Legacy annexures 9/10/11 all cite GFR 2017 Rule 155 for the
        // market-survey / quotation-evaluation committee.
        foreach (var html in new[]
                 {
                     Annexure9Template.Render(SampleModel()),
                     Annexure10Template.Render(SampleModel()),
                     Annexure11Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("155");
        }
    }

    [Fact]
    public void Annexure11_RendersEachCommitteeMemberByNameAndRole()
    {
        var committee = new List<IndentCommitteeMemberModel>
        {
            new("Prof. C Rao", "Chairperson"),
            new("Dr. D Singh", "FacultyMember"),
        };

        var html = Annexure11Template.Render(SampleModel(committee));

        html.Should().Contain("Prof. C Rao");
        html.Should().Contain("Dr. D Singh");
    }

    [Fact]
    public void Annexure11_WithNoCommitteeMembers_StillRendersWithoutError()
    {
        var html = Annexure11Template.Render(SampleModel());

        html.Should().NotBeNullOrEmpty();
        html.Should().Contain("Vacuum Pump");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter NonGemAnnexureTemplateTests`
Expected: FAIL — compile error, the template classes don't exist.

- [ ] **Step 3: Port Annexure 9**

Read `Old/Source_Code/save_consumable.php` lines 1959–2444. Port verbatim into `Annexure9Template.Render` using the same interpolation mapping.

- [ ] **Step 4: Port Annexure 10**

Same process, from lines 2445–2977 into `Annexure10Template.Render`.

- [ ] **Step 5: Port Annexure 11 with real committee members**

Same process, from lines 2978–3509 into `Annexure11Template.Render`, with one deliberate change: legacy renders a static 6-role committee roster where only one slot is filled from the free-text `suggested_faculty` field. Replace that block so it renders one row per `model.CommitteeMembers` entry (name + role), keeping the surrounding table/heading markup identical. When `CommitteeMembers` is empty, render the legacy blank-roster markup unchanged so the printed form is still signable by hand.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter NonGemAnnexureTemplateTests`
Expected: PASS — 4 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Infrastructure/DocumentGeneration/Templates/Annexure9Template.cs API/API.Infrastructure/DocumentGeneration/Templates/Annexure10Template.cs API/API.Infrastructure/DocumentGeneration/Templates/Annexure11Template.cs API/API.Tests/DocumentGeneration/NonGemAnnexureTemplateTests.cs
git commit -m "Port non-GeM Annexure templates 9, 10, and 11 with real committee rendering"
```

---

## Task 7: Bill cover letter template and `IDocumentGenerationService`

**Files:**
- Create: `API/API.Infrastructure/DocumentGeneration/Templates/BillCoverLetterTemplate.cs`
- Create: `API/API.Application/Documents/IDocumentGenerationService.cs`
- Create: `API/API.Infrastructure/DocumentGeneration/DocumentGenerationService.cs`
- Modify: `API/API/Program.cs`
- Test: `API/API.Tests/DocumentGeneration/DocumentGenerationServiceTests.cs`

**Interfaces:**
- Consumes: `IHtmlPdfRenderer` (Task 1), `IPdfMerger` (Task 2), all templates (Tasks 4–6).
- Produces (consumed by Phase 3b's indent services):
  ```csharp
  public interface IDocumentGenerationService
  {
      Task<byte[]> GenerateIndentAsync(
          ProcurementTier tier,
          IndentDocumentModel model,
          byte[]? gemQuotationPdf = null,
          CancellationToken ct = default);

      Task<byte[]> GenerateBillCoverLetterAsync(
          IndentDocumentModel model,
          CancellationToken ct = default);
  }
  ```
  `GenerateIndentAsync` composes cover letter + page break + the tier's annexure, wraps in the HTML shell, renders to PDF, and — when `gemQuotationPdf` is supplied — appends its pages via `IPdfMerger`, matching legacy's merge-at-raise-time behavior.

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/DocumentGeneration/DocumentGenerationServiceTests.cs`:
```csharp
using API.Application.Documents;
using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class DocumentGenerationServiceTests
{
    private static DocumentGenerationService CreateService() =>
        new(new PuppeteerHtmlPdfRenderer(), new PdfSharpPdfMerger());

    private static IndentDocumentModel SampleModel() => new(
        SanctionNo: "SAN-003",
        BudgetHeadName: "Recurring: Contingency",
        FacultyName: "Dr. E Nair",
        FacultyDesignation: "Assistant Professor",
        FacultyDepartment: "Physics",
        ItemName: "Optical Bench",
        TechnicalSpecs: "1.5m granite",
        UnitOfMeasurement: "Nos",
        Quantity: 1,
        Purpose: "Interferometry setup",
        EstimatedCost: 45000m,
        StockBookPage: null,
        StockDescription: null,
        StockQuantity: null,
        StockActualCost: null,
        StockCondition: null,
        CommitteeMembers: []);

    private static int CountPages(byte[] pdf)
    {
        var content = System.Text.Encoding.ASCII.GetString(pdf);
        return System.Text.RegularExpressions.Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
    }

    [Fact]
    public async Task GenerateIndentAsync_ProducesMultiPagePdf()
    {
        var service = CreateService();

        var pdf = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel());

        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
        // Cover letter + page break + annexure means at least 2 pages.
        CountPages(pdf).Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task GenerateIndentAsync_WithQuotation_AppendsQuotationPages()
    {
        var service = CreateService();
        var renderer = new PuppeteerHtmlPdfRenderer();
        var quotation = await renderer.RenderAsync("<html><body><div>Quotation</div></body></html>");

        var without = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel());
        var with = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel(), quotation);

        CountPages(with).Should().Be(CountPages(without) + CountPages(quotation));
    }

    [Theory]
    [InlineData(ProcurementTier.GemUpTo50k)]
    [InlineData(ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(ProcurementTier.GemAbove1Lakh)]
    [InlineData(ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(ProcurementTier.NonGem2LakhTo25Lakh)]
    public async Task GenerateIndentAsync_EveryTier_ProducesAValidPdf(ProcurementTier tier)
    {
        var service = CreateService();

        var pdf = await service.GenerateIndentAsync(tier, SampleModel());

        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
        CountPages(pdf).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task GenerateBillCoverLetterAsync_ProducesValidPdf()
    {
        var service = CreateService();

        var pdf = await service.GenerateBillCoverLetterAsync(SampleModel());

        System.Text.Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter DocumentGenerationServiceTests`
Expected: FAIL — compile error, `DocumentGenerationService` doesn't exist.

- [ ] **Step 3: Port the bill cover letter template**

Read `Old/Source_Code/process_consumable_bill.php` and locate its hardcoded cover-letter HTML (the "We certify that—" 5-point letter). Port verbatim into `BillCoverLetterTemplate.Render(IndentDocumentModel model)` using the same interpolation mapping as Task 4 Step 5.

- [ ] **Step 4: Write `IDocumentGenerationService`**

`API/API.Application/Documents/IDocumentGenerationService.cs`:
```csharp
namespace API.Application.Documents;

public interface IDocumentGenerationService
{
    Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier,
        IndentDocumentModel model,
        byte[]? gemQuotationPdf = null,
        CancellationToken ct = default);

    Task<byte[]> GenerateBillCoverLetterAsync(
        IndentDocumentModel model,
        CancellationToken ct = default);
}
```

- [ ] **Step 5: Write `DocumentGenerationService`**

`API/API.Infrastructure/DocumentGeneration/DocumentGenerationService.cs`:
```csharp
using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Infrastructure.DocumentGeneration;

public class DocumentGenerationService(
    IHtmlPdfRenderer renderer,
    IPdfMerger merger) : IDocumentGenerationService
{
    public async Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier,
        IndentDocumentModel model,
        byte[]? gemQuotationPdf = null,
        CancellationToken ct = default)
    {
        var annexureBody = tier switch
        {
            ProcurementTier.GemUpTo50k => Annexure6Template.Render(model),
            ProcurementTier.Gem50kTo1Lakh => Annexure7Template.Render(model),
            ProcurementTier.GemAbove1Lakh => Annexure8Template.Render(model),
            ProcurementTier.NonGemUpTo1Lakh => Annexure9Template.Render(model),
            ProcurementTier.NonGem1LakhTo2Lakh => Annexure10Template.Render(model),
            ProcurementTier.NonGem2LakhTo25Lakh => Annexure11Template.Render(model),
            _ => throw new ArgumentOutOfRangeException(nameof(tier), tier, "Unknown procurement tier."),
        };

        // Legacy always prepends the cover letter, then a page break, then the annexure.
        var body = IndentCoverLetterTemplate.Render(model)
                   + "<div class=\"page-break\"></div>"
                   + annexureBody;

        var pdf = await renderer.RenderAsync(IndentHtmlShell.Wrap(body), ct);

        if (gemQuotationPdf is { Length: > 0 })
        {
            pdf = merger.Merge([pdf, gemQuotationPdf]);
        }

        return pdf;
    }

    public async Task<byte[]> GenerateBillCoverLetterAsync(
        IndentDocumentModel model,
        CancellationToken ct = default)
    {
        var html = IndentHtmlShell.Wrap(BillCoverLetterTemplate.Render(model));
        return await renderer.RenderAsync(html, ct);
    }
}
```

- [ ] **Step 6: Register the services in `Program.cs`**

Add alongside the existing service registrations:
```csharp
builder.Services.AddScoped<IHtmlPdfRenderer, PuppeteerHtmlPdfRenderer>();
builder.Services.AddScoped<IPdfMerger, PdfSharpPdfMerger>();
builder.Services.AddScoped<IDocumentGenerationService, DocumentGenerationService>();
```
Add `using API.Infrastructure.DocumentGeneration;` at the top (`using API.Application.Documents;` is already present from Phase 1).

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter DocumentGenerationServiceTests`
Expected: PASS — 9 tests passed (2 + 6 theory cases + 1).

- [ ] **Step 8: Commit**

```bash
git add API/API.Infrastructure/DocumentGeneration/Templates/BillCoverLetterTemplate.cs API/API.Application/Documents/IDocumentGenerationService.cs API/API.Infrastructure/DocumentGeneration/DocumentGenerationService.cs API/API/Program.cs API/API.Tests/DocumentGeneration/DocumentGenerationServiceTests.cs
git commit -m "Add document generation service composing annexures, cover letters, and quotation merge"
```

---

## Task 8: Visual fidelity verification against legacy reference PDFs

**Files:** none (verification only, plus a scratch output folder that is not committed).

This task is the actual acceptance gate for "pixel-accurate" — the unit tests above only prove the templates render *something* containing the right data.

- [ ] **Step 1: Generate a reference PDF from each tier**

Add a temporary xUnit fact (or a small console program) that, for each of the 6 tiers, renders `GenerateIndentAsync` with a realistic model and writes the bytes to `D:/Projects/MNNITRNC/pdf-verify/annexure-<n>.pdf`. Run it. Do not commit the output folder or the temporary fact.

- [ ] **Step 2: Compare each against the legacy layout**

For each of the 6 generated PDFs, open it and compare against the corresponding legacy template markup (`Old/Source_Code/save_consumable.php`, line ranges in the Reference Material table). Verify, and record findings per annexure in your task report:
- The MNNIT logo renders at the expected size/position.
- Hindi text renders as Devanagari glyphs, not Latin characters.
- The "Print on Blue Page" header and annexure box appear where legacy places them.
- Section ordering matches (Item Requisitioned → Stock Register → Purpose → Procurement Method → Certificate → Office-Use Fund Availability → decision block).
- Table borders, shaded header rows, and signature lines are present.
- Content is not clipped at page edges and page breaks fall between the cover letter and the annexure.

- [ ] **Step 3: Fix any fidelity gaps found**

For any discrepancy, re-check the corresponding legacy markup and correct the ported template. Common causes: a dropped inline `style` attribute, a missing spacer `<div>`, or a `<table>` width/`colspan` that was altered during porting. Re-run Step 1 and re-verify after each fix.

- [ ] **Step 4: Clean up**

```bash
rm -rf D:/Projects/MNNITRNC/pdf-verify
```
Remove the temporary rendering fact/program. Confirm `git status` is clean apart from any template fixes from Step 3.

- [ ] **Step 5: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: all tests pass (33 pre-existing from Phases 1–2, plus this plan's ~26).

- [ ] **Step 6: Commit any fidelity fixes**

```bash
git add API/API.Infrastructure/DocumentGeneration/Templates
git commit -m "Correct annexure template fidelity gaps found in visual verification"
```
If Step 3 found no gaps, skip this commit and note that in your task report.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: HTML-to-PDF renderer ✅ (Task 1), PDF merge for GeM quotations ✅ (Task 2, wired in Task 7), Kruti Dev font embedding ✅ (Tasks 3, 4), 6 Annexure templates ✅ (Tasks 5, 6), bill cover letter ✅ (Task 7), committee members rendering on Annexure 11 replacing legacy's free-text field ✅ (Task 6 Step 5), pixel-accuracy acceptance ✅ (Task 8). The `IndentDocumentModel` carries `BudgetHeadName` which no legacy template interpolates — it is included because the spec's Office-Use Fund Availability block is to be populated with real figures; wiring those actual numbers is Phase 3b's job (it owns `IIndentBudgetValidator`), so this plan renders the block as legacy does and 3b extends the model if needed. Flagged so 3b's author knows the seam.
- **Type consistency**: `IndentDocumentModel` and `ProcurementTier` (Task 4) are consumed unchanged by every template (Tasks 5, 6) and by `IDocumentGenerationService` (Task 7). `IHtmlPdfRenderer.RenderAsync` (Task 1) and `IPdfMerger.Merge` (Task 2) signatures are used verbatim in `DocumentGenerationService` (Task 7). Template classes all expose the same `static string Render(IndentDocumentModel model)` shape.
- **Known risk**: Task 1's first test run downloads ~150MB of Chromium and can be slow; this is called out in that step so an implementer does not mistake it for a hang. Task 4 Step 7 is a deliberate hard gate — if Kruti Dev fails to load there, every subsequent template task would produce wrong output, so stopping there is correct.
