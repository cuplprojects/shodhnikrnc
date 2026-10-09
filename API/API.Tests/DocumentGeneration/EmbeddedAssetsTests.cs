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
    public void MnnitLogoBase64_IsLoadedAndDecodesToJpeg()
    {
        var base64 = EmbeddedAssets.MnnitLogoBase64;

        base64.Should().NotBeNullOrEmpty();
        var bytes = Convert.FromBase64String(base64);
        // JPEG magic bytes. The legacy asset is named MNNIT_LOGO.png but is
        // actually a JPEG; the legacy code sniffed the real MIME type at runtime
        // rather than trusting the file extension.
        bytes.Take(3).Should().Equal([0xFF, 0xD8, 0xFF]);
    }

    [Fact]
    public void MnnitLogoDataUri_CarriesTheJpegMimeType()
    {
        EmbeddedAssets.MnnitLogoDataUri.Should().StartWith("data:image/jpeg;base64,");
    }
}
