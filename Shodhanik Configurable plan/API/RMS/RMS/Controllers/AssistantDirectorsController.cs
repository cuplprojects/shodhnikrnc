using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AssistantDirectorsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public AssistantDirectorsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssistantDirector>>> GetAssistantDirectors()
        {
            return await _context.AssistantDirectors.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<AssistantDirector>> GetAssistantDirector(int id)
        {
            var director = await _context.AssistantDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }
            return director;
        }

        [HttpPost]
        public async Task<ActionResult<AssistantDirector>> PostAssistantDirector([FromForm] AssistantDirectorDto dto, IFormFile? image)
        {
            var director = new AssistantDirector
            {
                Name = dto.Name,
                Designation = dto.Designation,
                ContactNo = dto.ContactNo,
                Email = dto.Email
            };

            if (image != null)
            {
                director.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"ASSISTANT_{director.Id}"
                );
            }

            _context.AssistantDirectors.Add(director);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetAssistantDirector", new { id = director.Id }, director);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutAssistantDirector(int id, [FromForm] AssistantDirectorDto dto, IFormFile? image)
        {
            var existingDirector = await _context.AssistantDirectors.FindAsync(id);
            if (existingDirector == null)
            {
                return NotFound();
            }

            existingDirector.Name = dto.Name;
            existingDirector.Designation = dto.Designation;
            existingDirector.ContactNo = dto.ContactNo;
            existingDirector.Email = dto.Email;

            if (image != null)
            {
                if (!string.IsNullOrWhiteSpace(existingDirector.Image))
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(image, existingDirector.Image);
                }
                else
                {
                    // First-time upload
                    existingDirector.Image = await _fileStorage.SaveAsync(
                        image,
                        subFolder: "aboutus",
                        filePrefix: $"ASSISTANT_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AssistantDirectorExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAssistantDirector(int id)
        {
            var director = await _context.AssistantDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }

            _context.AssistantDirectors.Remove(director);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool AssistantDirectorExists(int id)
        {
            return _context.AssistantDirectors.Any(e => e.Id == id);
        }
    }

    public class AssistantDirectorDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}