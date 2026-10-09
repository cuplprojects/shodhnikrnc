namespace API.Application.Notifications;

/// <summary>
/// Outbound mail. Introduced for applicant email verification; the BRD's
/// committee-invitation and interview-mode notifications are not wired yet, but
/// they belong behind this same seam.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        string? ccAddress = null,
        CancellationToken ct = default);
}
