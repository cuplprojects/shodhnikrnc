using RMS.Models.NonDbModels;

namespace RMS.Services
{
    public interface IEmailService
    {
        string SendEmail(string to, string subject, string body);
        string SendEmailWithAttachments(string to, string subject, string body, List<EmailAttachment> attachments);
    }
}
