using API.Application.Recruitment;
using FluentAssertions;
using Xunit;

namespace API.Tests.Recruitment;

public class AdvertisementTextSanitizerTests
{
    [Fact]
    public void Sanitize_StripsScriptTags()
    {
        var result = AdvertisementTextSanitizer.Sanitize("<p>Hello</p><script>alert('x')</script>");

        result.Should().Contain("<p>Hello</p>");
        result.Should().NotContain("<script");
        result.Should().NotContain("alert");
    }

    [Fact]
    public void Sanitize_StripsOnClickAndOtherEventAttributes()
    {
        var result = AdvertisementTextSanitizer.Sanitize("<p onclick=\"alert('x')\">Hello</p>");

        result.Should().NotContain("onclick");
        result.Should().Contain("Hello");
    }

    [Fact]
    public void Sanitize_KeepsAllowedFormattingTags()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>");

        result.Should().Contain("<strong>Bold</strong>");
        result.Should().Contain("<em>italic</em>");
        result.Should().Contain("<ul>");
        result.Should().Contain("<li>Item</li>");
    }

    [Fact]
    public void Sanitize_StripsDisallowedAttributesButKeepsTheTag()
    {
        // style is now an allowed attribute (needed for font/color
        // formatting -- see Sanitize_KeepsAllowedInlineStyleProperties),
        // but class="evil" (not the one allow-listed chip class) must
        // still be stripped, and the tag itself must survive either way.
        var result = AdvertisementTextSanitizer.Sanitize("<p onmouseover=\"evil()\" class=\"evil\">Text</p>");

        result.Should().NotContain("onmouseover");
        result.Should().NotContain("class=\"evil\"");
        result.Should().Contain("Text");
    }

    [Fact]
    public void Sanitize_KeepsTheKnownTokenChipSpanClass()
    {
        // The editor's own token-chip markup must survive sanitization --
        // this is the exact class name Task 3's editor emits for its
        // token-insertion chips.
        var result = AdvertisementTextSanitizer.Sanitize(
            "<span class=\"ad-token-chip\">Project Title: Test</span>");

        result.Should().Contain("class=\"ad-token-chip\"");
    }

    [Fact]
    public void Sanitize_NullOrEmpty_ReturnsEmptyString()
    {
        AdvertisementTextSanitizer.Sanitize(null).Should().BeEmpty();
        AdvertisementTextSanitizer.Sanitize("").Should().BeEmpty();
    }

    [Fact]
    public void Sanitize_KeepsTablesAndTableCellSpanAttributes()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<table><tr><td colspan=\"2\">A</td></tr><tr><td>B</td><td rowspan=\"1\">C</td></tr></table>");

        result.Should().Contain("<table>");
        result.Should().Contain("<td colspan=\"2\">");
        result.Should().Contain("<td rowspan=\"1\">");
    }

    [Fact]
    public void Sanitize_KeepsAllowedInlineStyleProperties()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<p style=\"font-family:Arial;font-size:14px;color:#ff0000;background-color:#eeeeee;text-align:center\">Text</p>");

        result.Should().Contain("font-family");
        result.Should().Contain("font-size");
        result.Should().Contain("color");
        result.Should().Contain("background-color");
        result.Should().Contain("text-align");
        result.Should().Contain("Text");
    }

    [Fact]
    public void Sanitize_StripsDisallowedStyleProperties()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<p style=\"position:fixed;top:0;left:0;font-size:14px\">Text</p>");

        result.Should().NotContain("position");
        result.Should().NotContain("fixed");
        result.Should().Contain("font-size");
    }

    [Fact]
    public void Sanitize_KeepsStrikethroughSubAndSup()
    {
        var result = AdvertisementTextSanitizer.Sanitize("<s>old</s><sub>2</sub><sup>3</sup>");

        result.Should().Contain("<s>old</s>");
        result.Should().Contain("<sub>2</sub>");
        result.Should().Contain("<sup>3</sup>");
    }

    [Fact]
    public void Sanitize_KeepsHttpAndHttpsLinksButStripsJavascriptLinks()
    {
        var httpResult = AdvertisementTextSanitizer.Sanitize("<a href=\"https://example.com\">link</a>");
        httpResult.Should().Contain("href=\"https://example.com\"");

        var jsResult = AdvertisementTextSanitizer.Sanitize("<a href=\"javascript:alert(1)\">link</a>");
        jsResult.Should().NotContain("javascript:");
    }

    [Fact]
    public void Sanitize_KeepsImageWithAllowedUploadPath()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<img src=\"/uploads/advertisement-images/abc123.jpg\" alt=\"Photo\">");

        result.Should().Contain("src=\"/uploads/advertisement-images/abc123.jpg\"");
        result.Should().Contain("alt=\"Photo\"");
    }

    [Fact]
    public void Sanitize_StripsImageWithExternalOrArbitrarySrc()
    {
        var externalResult = AdvertisementTextSanitizer.Sanitize(
            "<img src=\"https://attacker.example/tracker.png\">");
        externalResult.Should().NotContain("<img");
        externalResult.Should().NotContain("attacker.example");

        var relativeButWrongPathResult = AdvertisementTextSanitizer.Sanitize(
            "<img src=\"/uploads/other-place/abc123.jpg\">");
        relativeButWrongPathResult.Should().NotContain("<img");

        var dataUriResult = AdvertisementTextSanitizer.Sanitize(
            "<img src=\"data:image/png;base64,aGVsbG8=\">");
        dataUriResult.Should().NotContain("<img");
    }

    [Fact]
    public void Sanitize_StillKeepsExistingTokenChipBehaviorUnchanged()
    {
        var result = AdvertisementTextSanitizer.Sanitize(
            "<span class=\"ad-token-chip\">Project Title: Test</span>");

        result.Should().Contain("class=\"ad-token-chip\"");
    }
}
