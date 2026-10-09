using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Notifications;

/// <summary>
/// Inserts one EmailTemplate row per EmailTemplateCatalogue entry that
/// doesn't already exist yet, keyed by Key -- never overwrites a row an
/// admin has already customized. Mirrors AdvertisementTemplateSeeder's own
/// idempotency pattern.
/// </summary>
public static class EmailTemplateSeeder
{
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var existingKeys = await db.EmailTemplates.Select(t => t.Key).ToListAsync(ct);
        var missing = EmailTemplateCatalogue.Templates
            .Where(t => !existingKeys.Contains(t.Key))
            .ToList();

        if (missing.Count == 0)
        {
            return;
        }

        foreach (var seed in missing)
        {
            db.EmailTemplates.Add(new EmailTemplate
            {
                Id = Guid.NewGuid(),
                Key = seed.Key,
                Name = seed.Name,
                Subject = seed.DefaultSubject,
                HtmlBody = seed.DefaultHtmlBody,
                IsSystemDefault = true,
                UpdatedAt = DateTimeOffset.UtcNow,
                UpdatedByUserId = null,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
