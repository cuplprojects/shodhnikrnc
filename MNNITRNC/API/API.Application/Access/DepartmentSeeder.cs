using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Access;

/// <summary>
/// Seeds the departments and backfills users from the free-text
/// <c>FacultyProfile.Department</c>.
/// </summary>
/// <remarks>
/// Phase 10 (BRD Prompt 6 / A11) replaces the original six-department
/// placeholder list -- transcribed from <c>CreateFacultyUser.jsx</c>'s
/// dropdown before any real department master existed -- with the BRD's own
/// 14 named departments. That dropdown is updated to match in the same
/// commit, so the free-text backfill's name match keeps working.
///
/// Matching on name rather than inventing a mapping is what makes the
/// backfill safe: a profile whose text does not match any seeded department
/// is left with no department rather than guessed at, and simply never
/// matches a Department-scoped permission.
///
/// Codes are added here because the free text has none, and a scoping key
/// needs something stable to join on. Full names for BTD, ChED and AMD are
/// the codebase's own best transcription of standard MNNIT Allahabad
/// department names -- the BRD gives only the abbreviation for those three
/// (Phase 10 spec §6).
/// </remarks>
public static class DepartmentSeeder
{
    /// <summary>
    /// The R&amp;C office's code. Membership here is what widens a
    /// Department-scoped permission to institute-wide -- see
    /// <c>Department.IsInstituteWide</c> and
    /// <c>InstituteWideScopeResolver</c>.
    /// </summary>
    public const string RncCode = "RNC";

    /// <summary>
    /// The old six-department placeholder list this seeder replaces, mapped
    /// to its nearest BRD equivalent. Retiring these rows and remapping any
    /// user who still points at one is <c>DbSeeder</c>'s job (it needs
    /// <c>UserManager</c>, which this application-layer class does not have
    /// access to) -- kept here as the single source of truth for the
    /// mapping, so the two stay in sync rather than duplicating the pairs.
    /// </summary>
    public static readonly (string OldCode, string NewCode)[] LegacyCodeRemap =
    [
        ("CSE", "CSED"), ("IT", "CSED"), ("EE", "EED"), ("ME", "MED"),
        ("CE", "CED"), ("ECE", "ELED"),
    ];

    public static readonly (string Code, string Name, bool IsInstituteWide)[] Departments =
    [
        ("ELED", "Electronics Engineering", false),
        ("HSS", "Humanities & Social Sciences", false),
        ("SMS", "School of Management Studies", false),
        ("CSED", "Computer Science & Engineering", false),
        ("BTD", "Biotechnology", false),
        ("EED", "Electrical Engineering", false),
        ("CED", "Civil Engineering", false),
        ("ChED", "Chemical Engineering", false),
        ("Chemistry", "Chemistry", false),
        ("Physics", "Physics", false),
        ("Mathematics", "Mathematics", false),
        ("GIS Cell", "GIS Cell", false),
        ("AMD", "Applied Mechanics", false),
        ("MED", "Mechanical Engineering", false),
        (RncCode, "Research & Consultancy", true),
    ];

    /// <summary>
    /// Inserts any missing department. Idempotent on <c>Code</c>, so a
    /// department an operator has since renamed is not reset on the next
    /// start. Does not remove the legacy placeholder departments -- see
    /// <c>DbSeeder.MigrateAwayFromLegacyDepartmentsAsync</c>, which needs
    /// <c>UserManager</c> to remap users off them first.
    /// </summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var existing = await db.Departments.Select(d => d.Code).ToListAsync(ct);
        var seen = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var added = false;
        foreach (var (code, name, instituteWide) in Departments)
        {
            if (!seen.Add(code))
            {
                continue;
            }

            db.Departments.Add(new Department
            {
                Id = Guid.NewGuid(),
                Code = code,
                Name = name,
                IsInstituteWide = instituteWide,
                IsActive = true,
            });
            added = true;
        }

        if (added)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
