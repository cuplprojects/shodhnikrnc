using System.Text.Json;
using System.Text.Json.Serialization;
using API.Domain.Enums;

namespace API.Application.Procurement;

/// <summary>
/// Parses the committee roster the raise endpoint receives as a JSON string.
/// It travels as a string because a nested collection does not bind reliably
/// from multipart form data.
/// </summary>
public static class CommitteeMembersJson
{
    /// <remarks>
    /// Web defaults give camelCase property matching but not enum-name binding,
    /// so a role sent as "Chairperson" fails to convert without the converter
    /// below — the same one the global MVC options register for request bodies.
    /// </remarks>
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private sealed record Member(string Name, CommitteeMemberRole Role);

    public static IReadOnlyList<(string Name, CommitteeMemberRole Role)> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        List<Member>? members;
        try
        {
            members = JsonSerializer.Deserialize<List<Member>>(json, Options);
        }
        catch (JsonException ex)
        {
            throw new ArgumentException($"Committee members could not be parsed: {ex.Message}", nameof(json));
        }

        return members is null ? [] : [.. members.Select(m => (m.Name, m.Role))];
    }
}
