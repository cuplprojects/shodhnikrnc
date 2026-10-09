using API.Application.Common;
using API.Application.Notifications;
using API.Authorization;
using API.Contracts.Notifications;
using API.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/email-log")]
[PageAccess("content.email-log")]
public class EmailLogController(IApplicationDbContext db, IEmailSender emailSender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmailLogResponse>>> List(
        [FromQuery] bool? succeeded, CancellationToken ct)
    {
        var query = db.EmailLogs.AsNoTracking().AsQueryable();
        if (succeeded.HasValue)
        {
            query = query.Where(l => l.Succeeded == succeeded.Value);
        }

        var logs = await query.OrderByDescending(l => l.SentAt).ToListAsync(ct);
        return Ok(logs.Select(ToResponse).ToList());
    }

    [HttpPost("{id:guid}/resend")]
    public async Task<ActionResult<EmailLogResponse>> Resend(Guid id, CancellationToken ct)
    {
        var original = await db.EmailLogs.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (original is null) return NotFound();

        var resendLog = new EmailLog
        {
            Id = Guid.NewGuid(),
            TemplateKey = original.TemplateKey,
            ToAddress = original.ToAddress,
            Subject = original.Subject,
            RenderedBody = original.RenderedBody,
            SentAt = DateTimeOffset.UtcNow,
            RelatedEntityType = original.RelatedEntityType,
            RelatedEntityId = original.RelatedEntityId,
        };

        try
        {
            await emailSender.SendAsync(original.ToAddress, original.Subject, original.RenderedBody, ct: ct);
            resendLog.Succeeded = true;
        }
        catch (Exception ex)
        {
            resendLog.Succeeded = false;
            resendLog.ErrorMessage = ex.Message;
        }

        db.EmailLogs.Add(resendLog);
        await db.SaveChangesAsync(ct);

        return Ok(ToResponse(resendLog));
    }

    private static EmailLogResponse ToResponse(EmailLog l) => new(
        l.Id, l.TemplateKey, l.ToAddress, l.Subject, l.Succeeded, l.ErrorMessage, l.SentAt,
        l.RelatedEntityType, l.RelatedEntityId);
}
