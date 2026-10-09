using API.Application.Recruitment;
using API.Infrastructure.DocumentGeneration;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace API.Tests.DocumentGeneration;

/// <summary>
/// RenderAdvertisementHtmlAsync is pure string composition -- no Puppeteer
/// involved -- so it's safe to exercise the real (non-stub)
/// RecruitmentDocumentGenerationService directly here, unlike the PDF-byte
/// generator methods on this same class.
/// </summary>
public class RecruitmentDocumentGenerationServiceTests
{
    private static readonly RecruitmentDocumentModel Model = new(
        "Project Title", "DST", "SAN-R1", "Prof. PI", "Professor", "CSE",
        "Junior Research Fellow", 1, 31_000m, 0m, 1,
        new DateOnly(2024, 7, 1), new DateOnly(2024, 7, 21),
        "<p><strong>Apply now</strong></p>", null, null, null,
        [], [], [], null, null);

    [Fact]
    public async Task RenderAdvertisementHtmlAsync_ReturnsWrappedHtmlMatchingTheTemplate()
    {
        var service = new RecruitmentDocumentGenerationService(
            renderer: null!, httpContextAccessor: new HttpContextAccessor());

        var html = await service.RenderAdvertisementHtmlAsync(Model);

        html.Should().Contain("<strong>Apply now</strong>");
        // The rich text editor is the sole source of the body -- no fixed
        // table of project/agency/salary details, and no auto-generated
        // "Advertisement for the Post of X" heading either, since the PI
        // writes that themselves.
        html.Should().NotContain("Advertisement for the Post of");
        html.Should().Contain("Prof. PI"); // still printed in the signature block
        // Confirms IndentHtmlShell.Wrap actually ran (a real document, not a bare fragment).
        html.Should().Contain("<html");
    }

    [Fact]
    public async Task RenderAdvertisementHtmlAsync_NeverCallsThePdfRenderer()
    {
        // Passing a null IHtmlPdfRenderer and NOT throwing proves this
        // method never touches the PDF-generation path at all -- the whole
        // point of having a separate HTML-only method for a live preview.
        var service = new RecruitmentDocumentGenerationService(
            renderer: null!, httpContextAccessor: new HttpContextAccessor());

        var act = () => service.RenderAdvertisementHtmlAsync(Model);

        await act.Should().NotThrowAsync();
    }
}
