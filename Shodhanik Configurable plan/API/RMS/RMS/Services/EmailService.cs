using Microsoft.Extensions.Configuration;
using RMS.Data;
using RMS.Models.NonDbModels;
using RMS.Services;
using System;
using System.Net;
using System.Net.Mail;

namespace RMS.Services
{
    public class EmailService : IEmailService
    {
        private readonly RMSDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly string _smtpServer;
        private readonly int _smtpPort;
        private readonly string _senderEmail;
        private readonly string _senderPassword;
        private readonly string _recipientEmail;

        public EmailService(RMSDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;

            _smtpServer = _configuration["EmailSettings:Host"];
            _smtpPort = int.Parse(_configuration["EmailSettings:Port"]);
            _senderEmail = _configuration["EmailSettings:Email"];
            _senderPassword = _configuration["EmailSettings:Password"];
            _recipientEmail = _configuration["ErrorEmailRecipient:RecipientEmail"];
        }

       

        private string SanitizeSubject(string? subject)
        {
            if (string.IsNullOrWhiteSpace(subject))
                return "Notification";

            // Remove any \r and \n characters which cause System.Net.Mail ArgumentException
            string clean = subject.Replace("\r", " ").Replace("\n", " ").Trim();

            // Collapse multiple consecutive spaces
            while (clean.Contains("  "))
            {
                clean = clean.Replace("  ", " ");
            }

            // Truncate to maximum 200 characters if too long
            if (clean.Length > 200)
            {
                clean = clean.Substring(0, 197) + "...";
            }

            return clean;
        }

        public string SendEmail(string to, string subject, string body)
        {
            var smtpClient = new SmtpClient(_smtpServer)
            {
                Port = _smtpPort,
                Credentials = new NetworkCredential(_senderEmail, _senderPassword),
                EnableSsl = true,
            };

            string displayName = _configuration["EmailSettings:Displayname"] ?? "Shodhanik";
            var mailMessage = new MailMessage
            {
                From = new MailAddress(_senderEmail, displayName),
                Subject = SanitizeSubject(subject),
                Body = body,
                IsBodyHtml = true,
            };

            mailMessage.To.Add(to);
            try
            {
                smtpClient.Send(mailMessage);
                return "Email sent";
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        public string SendEmailWithAttachments(string to, string subject, string body, List<EmailAttachment> attachments)
        {
            var smtpClient = new SmtpClient(_smtpServer)
            {
                Port = _smtpPort,
                Credentials = new NetworkCredential(_senderEmail, _senderPassword),
                EnableSsl = true,
            };

            string displayName = _configuration["EmailSettings:Displayname"] ?? "Shodhanik";
            var mailMessage = new MailMessage
            {
                From = new MailAddress(_senderEmail, displayName),
                Subject = SanitizeSubject(subject),
                Body = body,
                IsBodyHtml = true,
            };

            mailMessage.To.Add(to);

            // Attach files
            if (attachments != null)
            {
                foreach (var file in attachments)
                {
                    var stream = new MemoryStream(file.Content);
                    mailMessage.Attachments.Add(new Attachment(stream, file.FileName));
                }
            }

            try
            {
                smtpClient.Send(mailMessage);
                return "Email sent";
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

    }
}
