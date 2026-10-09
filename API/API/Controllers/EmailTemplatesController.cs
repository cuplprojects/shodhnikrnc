using API.Application.Common;
using API.Application.Notifications;
using API.Authorization;
using API.Contracts.Notifications;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/email-templates")]
[PageAccess("content.email-templates")]
public class EmailTemplatesController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateResponse>>> List(CancellationToken ct)
    {
        var templates = await db.EmailTemplates.AsNoTracking().OrderBy(t => t.Name).ToListAsync(ct);
        return Ok(templates.Select(ToResponse).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponse>> Get(Guid id, CancellationToken ct)
    {
        var template = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return NotFound();
        return Ok(ToResponse(template));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponse>> Update(
        Guid id, [FromBody] UpdateEmailTemplateRequest request, CancellationToken ct)
    {
        var template = await db.EmailTemplates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return NotFound();

        var known = EmailTemplateCatalogue.Find(template.Key)?.Placeholders ?? [];
        var invalid = FindUnknownPlaceholders(request.Subject, known)
            .Concat(FindUnknownPlaceholders(request.HtmlBody, known))
            .Distinct()
            .ToList();
        if (invalid.Count > 0)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Unknown placeholder",
                Detail = $"Unknown placeholder(s): {string.Join(", ", invalid)}. Valid placeholders for this template: {string.Join(", ", known)}.",
            });
        }

        var userId = User.GetUserId();
        template.Subject = request.Subject;
        template.HtmlBody = request.HtmlBody;
        template.IsSystemDefault = false;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        template.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);

        return Ok(ToResponse(template));
    }

    private static EmailTemplateResponse ToResponse(EmailTemplate t) => new(
        t.Id, t.Key, t.Name, t.Subject, t.HtmlBody, t.IsSystemDefault, t.UpdatedAt,
        EmailTemplateCatalogue.Find(t.Key)?.Placeholders ?? []);

    /// <summary>Finds every {{Name}} token in text that isn't in the known set.</summary>
    private static IEnumerable<string> FindUnknownPlaceholders(string text, string[] known)
    {
        var matches = System.Text.RegularExpressions.Regex.Matches(text, @"\{\{(\w+)\}\}");
        foreach (System.Text.RegularExpressions.Match m in matches)
        {
            var name = m.Groups[1].Value;
            if (!known.Contains(name))
            {
                yield return name;
            }
        }
    }
}
