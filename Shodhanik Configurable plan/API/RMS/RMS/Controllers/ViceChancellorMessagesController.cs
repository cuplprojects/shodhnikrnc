using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ViceChancellorMessagesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public ViceChancellorMessagesController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ViceChancellorMessage>>> GetViceChancellorMessages()
        {
            return await _context.ViceChancellorMessages.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ViceChancellorMessage>> GetViceChancellorMessage(int id)
        {
            var message = await _context.ViceChancellorMessages.FindAsync(id);
            if (message == null)
            {
                return NotFound();
            }
            return message;
        }

        [HttpPost]
        public async Task<ActionResult<ViceChancellorMessage>> PostViceChancellorMessage([FromForm] ViceChancellorMessageDto dto, IFormFile? image)
        {
            var message = new ViceChancellorMessage
            {
                Name = dto.Name ?? "",
                Designation = dto.Designation ?? "",
                Message = dto.Message ?? ""
            };

            if (image != null)
            {
                message.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"VC_{message.Id}"
                );
            }

            _context.ViceChancellorMessages.Add(message);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetViceChancellorMessage", new { id = message.Id }, message);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutViceChancellorMessage(int id, [FromForm] ViceChancellorMessageDto dto, IFormFile? image)
        {
            var existingMessage = await _context.ViceChancellorMessages.FindAsync(id);
            if (existingMessage == null)
            {
                return NotFound();
            }

            existingMessage.Name = dto.Name ?? "";
            existingMessage.Designation = dto.Designation ?? "";
            existingMessage.Message = dto.Message ?? "";

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
                        filePrefix: $"VC_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ViceChancellorMessageExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteViceChancellorMessage(int id)
        {
            var message = await _context.ViceChancellorMessages.FindAsync(id);
            if (message == null)
            {
                return NotFound();
            }

            _context.ViceChancellorMessages.Remove(message);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool ViceChancellorMessageExists(int id)
        {
            return _context.ViceChancellorMessages.Any(e => e.Id == id);
        }
    }

    public class ViceChancellorMessageDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? Message { get; set; }
    }
}