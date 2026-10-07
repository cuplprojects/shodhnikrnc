using Microsoft.EntityFrameworkCore;
using RMS.Data;

namespace RMS.Services
{
    public class EmailTemplateService : IEmailTemplateService
    {
        private readonly RMSDbContext _context;
        public EmailTemplateService(RMSDbContext context)
        {
            _context = context;
        }

        public async Task<(string Subject, string Body)> RenderAsync(
        int templateID,
        Dictionary<string, string> tokens)
        {
            var template = await _context.EmailTemplates
                .FirstOrDefaultAsync(t => t.TemplateId == templateID
                                       && t.Type == "Email");

            if (template == null)
                throw new Exception("Email template not found");

            string body = template.Content;
            string subject = template.Subject;

            foreach (var token in tokens)
            {
                string val = token.Value ?? string.Empty;
                body = body.Replace($"$${token.Key}$$", val, StringComparison.OrdinalIgnoreCase);
                subject = subject.Replace($"$${token.Key}$$", val, StringComparison.OrdinalIgnoreCase);
            }

            return (subject, body);
        }
    }
}
