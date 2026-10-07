using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AssociateDirectorsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public AssociateDirectorsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssociateDirector>>> GetAssociateDirectors()
        {
            return await _context.AssociateDirectors.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<AssociateDirector>> GetAssociateDirector(int id)
        {
            var director = await _context.AssociateDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }
            return director;
        }

        [HttpPost]
        public async Task<ActionResult<AssociateDirector>> PostAssociateDirector([FromForm] AssociateDirectorDto dto, IFormFile? image)
        {
            var director = new AssociateDirector
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
                    filePrefix: $"ASSOCIATE_{director.Id}"
                );
            }

            _context.AssociateDirectors.Add(director);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetAssociateDirector", new { id = director.Id }, director);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutAssociateDirector(int id, [FromForm] AssociateDirectorDto dto, IFormFile? image)
        {
            var existingDirector = await _context.AssociateDirectors.FindAsync(id);
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
                        filePrefix: $"ASSOCIATE_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AssociateDirectorExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAssociateDirector(int id)
        {
            var director = await _context.AssociateDirectors.FindAsync(id);
            if (director == null)
            {
                return NotFound();
            }

            _context.AssociateDirectors.Remove(director);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool AssociateDirectorExists(int id)
        {
            return _context.AssociateDirectors.Any(e => e.Id == id);
        }
    }

    public class AssociateDirectorDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}