using System.Text.RegularExpressions;
using API.Application.Procurement;
using API.Domain.Entities;

namespace API.Application.Recruitment;

/// <summary>
/// The fixed set of <c>{{Token}}</c> placeholders a template section's Content
/// may contain. Entity-bound tokens are always auto-resolved from the
/// recruitment's real data (mirroring what <see cref="RecruitmentDocumentModelFactory"/>
/// already assembles); any other <c>{{Token}}</c> left in a section after
/// resolution is reported back as a free-text field the caller must fill.
/// </summary>
public static partial class AdvertisementTokenCatalogue
{
    public static readonly IReadOnlyList<string> EntityBoundTokens =
    [
        "ProjectFileNo", "ProjectTitle", "PiName", "Department", "FundingAgency",
        "PositionCount", "SalaryJrf", "SalaryProjectAssociate",
        "AdvertisementNo", "AdvertisementDate",
    ];

    public static IReadOnlyDictionary<string, string> ResolveEntityBoundTokens(
        RecruitmentRequest request,
        Project project,
        SanctionedManpowerPosition position,
        FacultyProfileInfo pi,
        int advertisementNo,
        DateOnly advertisementDate)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(project);
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(pi);

        // JRF salary bracket is GATE/NET-qualified; Project Associate-I is the
        // same stipend line minus that qualification -- both are derived from
        // the same SanctionedManpowerPosition.Stipend/Hra the rest of the
        // recruitment module already uses, not two separate fields on the
        // position.
        var invariant = System.Globalization.CultureInfo.InvariantCulture;
        var jrf = string.Format(invariant, "Rs. {0:F2} per month", position.Stipend)
            + (position.Hra > 0
                ? string.Format(invariant, " + Rs. {0:F2} HRA", position.Hra)
                : string.Empty);

        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ProjectFileNo"] = project.SanctionNo,
            ["ProjectTitle"] = project.ProjectTitle,
            ["PiName"] = pi.Name,
            ["Department"] = pi.Department,
            ["FundingAgency"] = project.Agency,
            ["PositionCount"] = position.Positions.ToString(invariant),
            ["SalaryJrf"] = jrf,
            ["SalaryProjectAssociate"] = jrf,
            ["AdvertisementNo"] = advertisementNo.ToString(invariant),
            // "/" escaped and the culture pinned: the printed advertisement is
            // always dd/MM/yyyy regardless of the server's date separator.
            ["AdvertisementDate"] = advertisementDate.ToString(@"dd\/MM\/yyyy", invariant),
        };
    }

    /// <summary>Finds every <c>{{Token}}</c> still present in a resolved section's content.</summary>
    public static IReadOnlyList<string> FindUnresolvedTokens(string content) =>
        string.IsNullOrEmpty(content)
            ? []
            : [.. TokenPattern().Matches(content).Select(m => m.Groups[1].Value).Distinct()];

    public static string Substitute(string content, IReadOnlyDictionary<string, string> values)
    {
        if (string.IsNullOrEmpty(content))
        {
            return content;
        }

        foreach (var (key, value) in values)
        {
            content = content.Replace("{{" + key + "}}", value);
        }

        return content;
    }

    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex TokenPattern();
}
