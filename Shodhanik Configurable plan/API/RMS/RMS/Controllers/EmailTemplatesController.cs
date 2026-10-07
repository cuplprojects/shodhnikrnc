using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmailTemplatesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public EmailTemplatesController(RMSDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmailTemplate>>> GetEmailTemplates()
        {
            try
            {
                var templates = await _context.EmailTemplates.ToListAsync();
                return Ok(new { success = true, data = templates });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("type/{type}")]
        public async Task<ActionResult<IEnumerable<EmailTemplate>>> GetEmailTemplatesByType(string type)
        {
            return await _context.EmailTemplates
                .Where(t => t.Type.ToLower() == type.ToLower())
                .ToListAsync();
        }

        [HttpGet("template/{templateId}")]
        public async Task<ActionResult<EmailTemplate>> GetEmailTemplateByTemplateId(int templateId)
        {
            var item = await _context.EmailTemplates
                .FirstOrDefaultAsync(t => t.TemplateId == templateId);
            
            if (item == null) 
                return NotFound(new { success = false, message = "Template not found" });
            
            return Ok(new { success = true, data = item });
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<EmailTemplate>> GetEmailTemplate(int id)
        {
            var item = await _context.EmailTemplates.FindAsync(id);
            if (item == null) return NotFound();
            return item;
        }

        [HttpPost]
        public async Task<ActionResult<EmailTemplate>> PostEmailTemplate([FromBody] EmailTemplateDto dto)
        {
            try
            {
                // Auto-generate TemplateId based on the highest existing TemplateId + 1
                var maxTemplateId = await _context.EmailTemplates
                    .MaxAsync(t => (int?)t.TemplateId) ?? 1000; // Start from 1001 if no templates exist
                
                var item = new EmailTemplate
                {
                    TemplateId = maxTemplateId + 1,
                    TemplateName = dto.TemplateName ?? "",
                    Type = dto.Type ?? "",
                    Subject = dto.Subject ?? "",
                    Content = dto.Content ?? ""
                };

                _context.EmailTemplates.Add(item);
                await _context.SaveChangesAsync();
                
                return Ok(new { success = true, data = item });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutEmailTemplate(int id, [FromBody] EmailTemplateDto dto)
        {
            try
            {
                var existing = await _context.EmailTemplates.FindAsync(id);
                if (existing == null) 
                {
                    return NotFound(new { message = "Template not found" });
                }

                // Update properties (TemplateId should not be changed during update)
                existing.TemplateName = dto.TemplateName ?? existing.TemplateName;
                existing.Type = dto.Type ?? existing.Type;
                existing.Subject = dto.Subject ?? existing.Subject;
                existing.Content = dto.Content ?? existing.Content;

                // Mark as modified and save
                _context.Entry(existing).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                
                return Ok(new { success = true, data = existing });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEmailTemplate(int id)
        {
            try
            {
                var item = await _context.EmailTemplates.FindAsync(id);
                if (item == null) 
                {
                    return NotFound(new { success = false, message = "Template not found" });
                }
                
                _context.EmailTemplates.Remove(item);
                await _context.SaveChangesAsync();
                
                return Ok(new { success = true, message = "Template deleted successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }

    public class EmailTemplateDto
    {
        public string? TemplateName { get; set; }
        public string? Type { get; set; } // "SMS" or "Email"
        public string? Subject { get; set; } // Only used for Email templates
        public string? Content { get; set; }
    }
}