using System.Net;
using API.Application.Common;
using API.Application.Notifications;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Notifications;

public class ApprovalNotificationService(
    IApplicationDbContext db,
    IEmailSender emailSender) : IApprovalNotificationService
{
    public async Task NotifyAsync(
        string templateKey,
        ApplicationUser recipient,
        IReadOnlyDictionary<string, string> variables,
        string relatedEntityType,
        Guid relatedEntityId,
        CancellationToken ct = default)
    {
        // The whole body is guarded, not just the SendAsync call: this
        // method's own contract (see IApprovalNotificationService's doc
        // comment) is that it never throws, because every caller invokes it
        // AFTER an approval/rejection has already been committed -- a
        // missing template row, an unknown placeholder, or a failed
        // EmailLog save must degrade to "notification lost" rather than
        // turn an already-successful approval into a 500 response.
        try
        {
            var template = await db.EmailTemplates.FirstOrDefaultAsync(t => t.Key == templateKey, ct)
                ?? throw new EmailTemplateNotFoundException(templateKey);

            // Defensive: call sites are code, not admin input, so this should
            // never trip in production -- but it catches a typo'd variable name
            // in dev/test immediately instead of silently omitting it from the
            // rendered email.
            var known = EmailTemplateCatalogue.Find(templateKey)?.Placeholders ?? [];
            foreach (var name in variables.Keys)
            {
                if (!known.Contains(name))
                {
                    throw new UnknownEmailPlaceholderException(templateKey, name);
                }
            }

            var subject = Render(template.Subject, variables);
            var body = Render(template.HtmlBody, variables);

            var log = new EmailLog
            {
                Id = Guid.NewGuid(),
                TemplateKey = templateKey,
                ToAddress = recipient.Email ?? string.Empty,
                Subject = subject,
                RenderedBody = body,
                SentAt = DateTimeOffset.UtcNow,
                RelatedEntityType = relatedEntityType,
                RelatedEntityId = relatedEntityId,
            };

            try
            {
                await emailSender.SendAsync(recipient.Email ?? string.Empty, subject, body, ct: ct);
                log.Succeeded = true;
            }
            catch (Exception ex)
            {
                log.Succeeded = false;
                log.ErrorMessage = ex.Message;
            }

            db.EmailLogs.Add(log);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Swallowed deliberately -- see the remarks above this try block.
            // A template-lookup/validation/log-save failure here is a
            // deployment or data bug to catch via monitoring, not something
            // that should ever surface to the caller.
        }
    }

    /// <summary>
    /// PortalLink is deliberately not HTML-encoded here -- it's a URL going
    /// into an href attribute, and the query-string-safe characters a URL
    /// legitimately contains (e.g. "&amp;") aren't the injection risk this
    /// guards against. Every other placeholder is user/PI-supplied display
    /// text (a name, a proposal title, an indent purpose) with no such
    /// guarantee, so it's encoded before substitution -- otherwise a title
    /// containing '&lt;' or '"' could break the surrounding markup (e.g.
    /// escape out of a nearby href="...") in a template an Office/SuperAdmin
    /// author never anticipated.
    /// </summary>
    private static string Render(string template, IReadOnlyDictionary<string, string> variables)
    {
        var result = template;
        foreach (var (name, value) in variables)
        {
            var substitution = name == "PortalLink" ? value : WebUtility.HtmlEncode(value);
            result = result.Replace("{{" + name + "}}", substitution);
        }
        return result;
    }
}
