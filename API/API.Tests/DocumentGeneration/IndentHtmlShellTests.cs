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
