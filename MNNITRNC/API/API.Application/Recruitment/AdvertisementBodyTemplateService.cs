using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Recruitment;

/// <summary>
/// Save/list/delete for a PI's own saved advertisement bodies -- the raw
/// rich-text HTML from the "Generate Advertisement" editor, named and
/// reusable across different recruitments. Every template is private to the
/// PI who saved it; there is no system-default or sharing concept here,
/// unlike the older section-based <see cref="AdvertisementTemplateService"/>.
/// </summary>
public class AdvertisementBodyTemplateService(IApplicationDbContext db) : IAdvertisementBodyTemplateService
{
    public async Task<IReadOnlyList<AdvertisementBodyTemplateSummary>> ListForUserAsync(
        Guid userId, CancellationToken ct = default)
    {
        var templates = await db.AdvertisementBodyTemplates
            .Where(t => t.OwnerUserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return [.. templates.Select(t => new AdvertisementBodyTemplateSummary(t.Id, t.Name, t.HtmlBody, t.CreatedAt))];
    }

    public async Task<Guid> CreateAsync(
        Guid userId, string name, string htmlBody, CancellationToken ct = default)
    {
        var template = new AdvertisementBodyTemplate
        {
            Id = Guid.NewGuid(),
            OwnerUserId = userId,
            Name = name,
            HtmlBody = htmlBody,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.AdvertisementBodyTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return template.Id;
    }

    public async Task DeleteAsync(Guid templateId, Guid userId, CancellationToken ct = default)
    {
        var template = await db.AdvertisementBodyTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId, ct)
            ?? throw new AdvertisementBodyTemplateNotFoundException(templateId);

        if (template.OwnerUserId != userId)
        {
            throw new AdvertisementBodyTemplateNotOwnedException(templateId);
        }

        db.AdvertisementBodyTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
    }
}
