using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdditionalDirectorsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public AdditionalDirectorsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AdditionalDirector>>> GetAdditionalDirectors()
        {
            return await _context.AdditionalDirectors.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<AdditionalDirector>> GetAdditionalDirector(int id)
        {
            var director = await _context.AdditionalDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }
            return director;
        }
        [Authorize]
        [HttpPost]
        public async Task<ActionResult<AdditionalDirector>> PostAdditionalDirector([FromForm] AdditionalDirectorDto dto, IFormFile? image)
        {
            var director = new AdditionalDirector
            {
                Name = dto.Name ?? "",
                Designation = dto.Designation ?? "",
                ContactNo = dto.ContactNo ?? "",
                Email = dto.Email ?? ""
            };

            if (image != null)
            {
                director.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"ADDITIONAL_{director.Id}"
                );
            }

            _context.AdditionalDirectors.Add(director);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetAdditionalDirector", new { id = director.Id }, director);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutAdditionalDirector(int id, [FromForm] AdditionalDirectorDto dto, IFormFile? image)
        {
            var existingDirector = await _context.AdditionalDirectors.FindAsync(id);
            if (existingDirector == null)
            {
                return NotFound();
            }

            existingDirector.Name = dto.Name ?? "";
            existingDirector.Designation = dto.Designation ?? "";
            existingDirector.ContactNo = dto.ContactNo ?? "";
            existingDirector.Email = dto.Email ?? "";

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
                        filePrefix: $"ADDITIONAL_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AdditionalDirectorExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAdditionalDirector(int id)
        {
            var director = await _context.AdditionalDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }

            _context.AdditionalDirectors.Remove(director);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool AdditionalDirectorExists(int id)
        {
            return _context.AdditionalDirectors.Any(e => e.Id == id);
        }
    }

    public class AdditionalDirectorDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}