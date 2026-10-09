using Ganss.Xss;

namespace API.Application.Recruitment;

/// <summary>
/// Advertisement.Text now legitimately contains HTML from the rich text
/// editor (GenerateAdvertisementModal.jsx) -- this is the one place that
/// HTML is sanitized before it is ever persisted, so neither the database
/// nor the generated PDF (which stops HTML-encoding this one field once
/// sanitization makes it safe to -- see RecruitmentTemplates.Advertisement's
/// fixed-table branch) can ever render markup or a script an attacker
/// controlled. Called from RecruitmentService.AdvertiseAsync and
/// ReadvertiseAsync before Text is written to the entity.
/// </summary>
public static class AdvertisementTextSanitizer
{
    private static readonly HtmlSanitizer Sanitizer = BuildSanitizer();

    private const string AllowedImageSrcPrefix = "/uploads/advertisement-images/";

    public static string Sanitize(string? html)
    {
        if (string.IsNullOrEmpty(html))
        {
            return string.Empty;
        }

        var sanitized = Sanitizer.Sanitize(html);
        return StripImagesWithDisallowedSrc(sanitized);
    }

    private static HtmlSanitizer BuildSanitizer()
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[]
        {
            "p", "br", "b", "strong", "i", "em", "u", "s", "sub", "sup",
            "ul", "ol", "li",
            "h1", "h2", "h3", "h4", "h5", "h6", "hr", "span",
            "table", "thead", "tbody", "tr", "th", "td",
            "img", "a",
        })
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        foreach (var attr in new[] { "class", "style", "src", "alt", "href", "colspan", "rowspan" })
        {
            sanitizer.AllowedAttributes.Add(attr);
        }

        // Only the editor's own known token-chip class may survive on a
        // span -- Task 3's frontend editor marks its token-insertion chips
        // with this exact class name, so it must not be renamed here.
        //
        // NOTE: the package resolved to HtmlSanitizer 9.2.1039, whose API
        // names this property AllowedClasses (not AllowedCssClasses, as
        // earlier 8.x releases named it). The behavior is identical --
        // restrict the value of the `class` attribute to this allow-list --
        // just under the current property name.
        sanitizer.AllowedClasses.Add("ad-token-chip");

        // style is now allowed (needed for font/color formatting from the
        // TinyMCE toolbar), but only these properties -- anything else
        // (position, z-index, background:url(...), etc.) is stripped even
        // though the style attribute itself is allowed.
        sanitizer.AllowedCssProperties.Clear();
        foreach (var prop in new[]
        {
            "font-family", "font-size", "color", "background-color",
            "text-align", "width", "height", "border", "border-collapse",
        })
        {
            sanitizer.AllowedCssProperties.Add(prop);
        }

        // href on <a> restricted to http/https -- blocks javascript: URLs.
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("http");
        sanitizer.AllowedSchemes.Add("https");

        return sanitizer;
    }

    private static string StripImagesWithDisallowedSrc(string html)
    {
        // Ganss.Xss's AllowedSchemes only constrains the URL *scheme*
        // (http/https/etc.), not the host or path -- an attacker-hosted
        // https:// image would otherwise still pass. Every image in an
        // advertisement must have been uploaded through this app's own
        // endpoint, so anything not matching that exact relative-path
        // prefix is stripped here as a second, independent check.
        return System.Text.RegularExpressions.Regex.Replace(
            html,
            "<img\\b[^>]*>",
            match => match.Value.Contains($"src=\"{AllowedImageSrcPrefix}")
                ? match.Value
                : string.Empty,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
}
