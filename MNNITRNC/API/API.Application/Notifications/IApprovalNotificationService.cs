using API.Domain.Entities;

namespace API.Application.Notifications;

/// <summary>
/// Renders an EmailTemplate with the given variables, sends it via
/// IEmailSender, and always writes one EmailLog row -- success or failure.
/// Never throws: a failed send must not block the approval action that
/// triggered it, so every failure is caught, logged, and swallowed here.
/// </summary>
public interface IApprovalNotificationService
{
    Task NotifyAsync(
        string templateKey,
        ApplicationUser recipient,
        IReadOnlyDictionary<string, string> variables,
        string relatedEntityType,
        Guid relatedEntityId,
        CancellationToken ct = default);
}

/// <summary>Thrown when templateKey has no seeded EmailTemplate row -- a deployment bug, not a user-facing error.</summary>
public class EmailTemplateNotFoundException(string key)
    : Exception($"No EmailTemplate found for key '{key}'. Has EmailTemplateSeeder run?");

/// <summary>Thrown (in dev/test only -- see ApprovalNotificationService) when a caller passes a variable name EmailTemplateCatalogue does not list for this template.</summary>
public class UnknownEmailPlaceholderException(string templateKey, string placeholderName)
    : Exception($"'{placeholderName}' is not a known placeholder for email template '{templateKey}'.");
