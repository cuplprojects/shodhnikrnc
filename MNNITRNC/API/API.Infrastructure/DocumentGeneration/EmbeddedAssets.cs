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
        new(() => LoadBase64("API.Infrastructure.Assets.Images.mnnit-logo.jpg"));

    public static string KrutiDevRegularBase64 => KrutiDevRegular.Value;
    public static string KrutiDevBoldBase64 => KrutiDevBold.Value;

    /// <summary>
    /// Raw base64 of the institute logo. Despite the legacy filename ending in .png,
    /// the asset is actually a JPEG — the legacy code detected this at runtime via
    /// mime_content_type() rather than trusting the extension.
    /// </summary>
    public static string MnnitLogoBase64 => MnnitLogo.Value;

    /// <summary>
    /// The logo as a complete data URI, matching how the legacy templates consumed it
    /// (the PHP $logoBase64 variable already included the "data:mime;base64," prefix).
    /// </summary>
    public static string MnnitLogoDataUri => $"data:image/jpeg;base64,{MnnitLogo.Value}";

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
