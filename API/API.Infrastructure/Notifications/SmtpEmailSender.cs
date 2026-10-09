using API.Application.Notifications;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace API.Infrastructure.Notifications;

/// <summary>
/// Sends mail through the SMTP server named in the "Email" configuration section.
/// </summary>
public class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        string? ccAddress = null,
        CancellationToken ct = default)
    {
        // Fail loudly rather than silently dropping the message. An unconfigured
        // mailer means a registered applicant never receives their verification
        // link and cannot apply -- that must surface as an error, not as a
        // successful-looking registration.
        if (!_options.IsConfigured)
        {
            throw new EmailNotConfiguredException();
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toAddress));
        if (!string.IsNullOrWhiteSpace(ccAddress))
        {
            message.Cc.Add(MailboxAddress.Parse(ccAddress));
        }
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient();

        var socketOptions = _options.UseStartTls
            ? SecureSocketOptions.StartTls
            : SecureSocketOptions.Auto;

        await client.ConnectAsync(_options.Host, _options.Port, socketOptions, ct);

        // Anonymous relays exist; only authenticate when a user is configured.
        if (!string.IsNullOrWhiteSpace(_options.User))
        {
            await client.AuthenticateAsync(_options.User, _options.Password, ct);
        }

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}

public class EmailNotConfiguredException()
    : InvalidOperationException(
        "SMTP is not configured. Set Email:Host and Email:FromAddress (plus " +
        "Email:User and Email:Password if the server requires authentication) in " +
        "appsettings.Development.json or environment variables. The values in " +
        "appsettings.json are empty placeholders by design -- credentials must " +
        "not be committed.");
