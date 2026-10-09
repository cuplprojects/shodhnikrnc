using API.Application.Common;
using API.Application.Procurement;
using API.Application.Projects;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Recruitment;

/// <summary>
/// Clone/edit/delete/resolve for a PI's reusable advertisement wording. The
/// single seeded system-default template is readable by everyone but never
/// mutated -- a PI clones it into their own copy first.
/// </summary>
public class AdvertisementTemplateService(
    IApplicationDbContext db,
    IFacultyProfileProvider facultyProfiles) : IAdvertisementTemplateService
{
    public async Task<IReadOnlyList<AdvertisementTemplateSummary>> ListForUserAsync(
        Guid userId, CancellationToken ct = default)
    {
        var templates = await db.AdvertisementTemplates
            .Include(t => t.Sections)
            .Where(t => t.OwnerUserId == userId || t.IsSystemDefault)
            .ToListAsync(ct);

        return
        [
            .. templates
                .OrderByDescending(t => t.IsSystemDefault) // the default lists first
                .ThenBy(t => t.Name, StringComparer.OrdinalIgnoreCase)
                .Select(t => ToSummary(t, userId))
        ];
    }

    public async Task<Guid> CloneAsync(
        Guid sourceTemplateId, string newName, Guid userId, CancellationToken ct = default)
    {
        var source = await db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(t => t.Id == sourceTemplateId, ct)
            ?? throw new AdvertisementTemplateNotFoundException(sourceTemplateId);

        // Cloning is allowed from the system default OR from any of the
        // caller's own templates -- but not from another PI's template,
        // matching the spec's "per-PI custom templates" boundary.
        if (!source.IsSystemDefault && source.OwnerUserId != userId)
        {
            throw new TemplateNotOwnedException(sourceTemplateId);
        }

        var now = DateTimeOffset.UtcNow;
        var cloneId = Guid.NewGuid();
        var clone = new AdvertisementTemplate
        {
            Id = cloneId,
            OwnerUserId = userId,
            Name = newName,
            IsSystemDefault = false,
            CreatedAt = now,
            UpdatedAt = now,
            Sections =
            [
                .. source.Sections
                    .OrderBy(s => s.SortOrder)
                    .Select(s => new AdvertisementTemplateSection
                    {
                        Id = Guid.NewGuid(),
                        TemplateId = cloneId,
                        Key = s.Key,
                        Content = s.Content,
                        IsIncluded = s.IsIncluded,
                        SortOrder = s.SortOrder,
                    })
            ],
        };

        db.AdvertisementTemplates.Add(clone);
        await db.SaveChangesAsync(ct);
        return clone.Id;
    }

    public async Task UpdateAsync(
        Guid templateId, string name, IReadOnlyList<AdvertisementTemplateSectionInput> sections,
        Guid userId, CancellationToken ct = default)
    {
        var template = await db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(t => t.Id == templateId, ct)
            ?? throw new AdvertisementTemplateNotFoundException(templateId);

        EnsureMutableBy(template, userId);

        template.Name = name;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        // A whole-template replace rather than a per-section diff: the editor
        // hands back the complete section list, and sections carry no identity
        // the caller is expected to preserve.
        //
        // The old rows go through the DbSet and the new ones are added to the
        // DbSet too, never to template.Sections. Calling Clear() on the loaded
        // navigation makes EF treat the rows as severed orphans and try to
        // UPDATE their (required) FK to default instead of honouring the
        // delete, which then fails with DbUpdateConcurrencyException --
        // confirmed against the in-memory provider.
        db.AdvertisementTemplateSections.RemoveRange(template.Sections.ToList());

        foreach (var s in sections)
        {
            db.AdvertisementTemplateSections.Add(new AdvertisementTemplateSection
            {
                Id = Guid.NewGuid(),
                TemplateId = templateId,
                Key = s.Key,
                Content = s.Content,
                IsIncluded = s.IsIncluded,
                SortOrder = s.SortOrder,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid templateId, Guid userId, CancellationToken ct = default)
    {
        var template = await db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(t => t.Id == templateId, ct)
            ?? throw new AdvertisementTemplateNotFoundException(templateId);

        EnsureMutableBy(template, userId);

        // No cascade concern beyond Sections (already Cascade in the entity
        // configuration) -- deleting a template never affects already-generated
        // PDFs, since nothing persists a copy of resolved section content.
        db.AdvertisementTemplateSections.RemoveRange(template.Sections.ToList());
        db.AdvertisementTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ResolvedAdvertisementTemplate> ResolveAsync(
        Guid templateId, Guid recruitmentRequestId, Guid piUserId,
        int advertisementNo, DateOnly advertisementDate, CancellationToken ct = default)
    {
        var template = await db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstOrDefaultAsync(t => t.Id == templateId, ct)
            ?? throw new AdvertisementTemplateNotFoundException(templateId);

        if (!template.IsSystemDefault && template.OwnerUserId != piUserId)
        {
            throw new TemplateNotOwnedException(templateId);
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        var project = await db.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct)
            ?? throw new ProjectNotFoundException(request.ProjectId);

        // There is no SanctionedManpowerPositionNotFoundException in this
        // codebase; RecruitmentService.CreateAsync raises ArgumentException for
        // an unknown sanctioned position, so this mirrors it.
        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == request.SanctionedManpowerPositionId, ct)
            ?? throw new ArgumentException(
                $"Sanctioned position '{request.SanctionedManpowerPositionId}' was not found.",
                nameof(recruitmentRequestId));

        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        var tokenValues = AdvertisementTokenCatalogue.ResolveEntityBoundTokens(
            request, project, position, pi, advertisementNo, advertisementDate);

        var resolvedSections = template.Sections
            .OrderBy(s => s.SortOrder)
            .Select(s => new ResolvedAdvertisementSection(
                s.Key,
                AdvertisementTokenCatalogue.Substitute(s.Content, tokenValues),
                s.IsIncluded,
                s.SortOrder))
            .ToList();

        var unresolved = resolvedSections
            .SelectMany(s => AdvertisementTokenCatalogue.FindUnresolvedTokens(s.Content))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return new ResolvedAdvertisementTemplate(resolvedSections, unresolved);
    }

    private static void EnsureMutableBy(AdvertisementTemplate template, Guid userId)
    {
        if (template.IsSystemDefault)
        {
            throw new CannotEditSystemDefaultTemplateException(template.Id);
        }

        if (template.OwnerUserId != userId)
        {
            throw new TemplateNotOwnedException(template.Id);
        }
    }

    private static AdvertisementTemplateSummary ToSummary(AdvertisementTemplate t, Guid userId) => new(
        t.Id,
        t.Name,
        t.IsSystemDefault,
        t.OwnerUserId == userId,
        [
            .. t.Sections
                .OrderBy(s => s.SortOrder)
                .Select(s => new AdvertisementTemplateSectionSummary(
                    s.Id, s.Key, s.Content, s.IsIncluded, s.SortOrder))
        ]);
}
