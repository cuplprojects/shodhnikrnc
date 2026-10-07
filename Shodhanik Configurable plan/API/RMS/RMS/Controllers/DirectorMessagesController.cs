using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DirectorMessagesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public DirectorMessagesController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DirectorMessage>>> GetDirectorMessages()
        {
            var messages = await _context.DirectorMessages.ToListAsync();
            
            // Convert nullable strings to empty strings for API response
            var result = messages.Select(m => new DirectorMessage
            {
                Id = m.Id,
                Name = m.Name ?? "",
                Designation = m.Designation ?? "",
                Message = m.Message ?? "",
                ContactNo = m.ContactNo ?? "",
                Email = m.Email ?? "",
                Image = m.Image ?? ""
            }).ToList();
            
            return result;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DirectorMessage>> GetDirectorMessage(int id)
        {
            var message = await _context.DirectorMessages.FindAsync(id);
            if (message == null)
            {
                return NotFound();
            }
            return message;
        }

        [HttpPost]
        public async Task<ActionResult<DirectorMessage>> PostDirectorMessage([FromForm] DirectorMessageDto dto, IFormFile? image)
        {
            var message = new DirectorMessage
            {
                Name = dto.Name ?? "",
                Designation = dto.Designation ?? "",
                Message = dto.Message ?? "",
                ContactNo = dto.ContactNo ?? "",
                Email = dto.Email ?? ""
            };

            if (image != null)
            {
                message.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"DIRECTOR_{message.Id}"
                );
            }

            _context.DirectorMessages.Add(message);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetDirectorMessage", new { id = message.Id }, message);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutDirectorMessage(int id, [FromForm] DirectorMessageDto dto, IFormFile? image)
        {
            var existingMessage = await _context.DirectorMessages.FindAsync(id);
            if (existingMessage == null)
            {
                return NotFound();
            }

            existingMessage.Name = dto.Name ?? "";
            existingMessage.Designation = dto.Designation ?? "";
            existingMessage.Message = dto.Message ?? "";
            existingMessage.ContactNo = dto.ContactNo ?? "";
            existingMessage.Email = dto.Email ?? "";

            if (image != null)
            {
                if (!string.IsNullOrWhiteSpace(existingMessage.Image))
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(image, existingMessage.Image);
                }
                else
                {
                    // First-time upload
                    existingMessage.Image = await _fileStorage.SaveAsync(
                        image,
                        subFolder: "aboutus",
                        filePrefix: $"DIRECTOR_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!DirectorMessageExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDirectorMessage(int id)
        {
            var message = await _context.DirectorMessages.FindAsync(id);
            if (message == null)
            {
                return NotFound();
            }

            _context.DirectorMessages.Remove(message);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool DirectorMessageExists(int id)
        {
            return _context.DirectorMessages.Any(e => e.Id == id);
        }
    }

    public class DirectorMessageDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? Message { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}