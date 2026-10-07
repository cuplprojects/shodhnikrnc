using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VisionMissionsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public VisionMissionsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VisionMission>>> GetVisionMissions()
        {
            return await _context.VisionMissions.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<VisionMission>> GetVisionMission(int id)
        {
            var item = await _context.VisionMissions.FindAsync(id);
            if (item == null) return NotFound();
            return item;
        }

        [HttpPost]
        public async Task<ActionResult<VisionMission>> PostVisionMission([FromForm] VisionMissionDto dto, IFormFile? image)
        {
            var item = new VisionMission
            {
                Type = dto.Type ?? "",
                Title = dto.Title ?? "",
                Content = dto.Content ?? ""
            };

            if (image != null)
            {
                item.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"VISION_{item.Id}"
                );
            }

            _context.VisionMissions.Add(item);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetVisionMission", new { id = item.Id }, item);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutVisionMission(int id, [FromForm] VisionMissionDto dto, IFormFile? image)
        {
            var existing = await _context.VisionMissions.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Type = dto.Type ?? "";
            existing.Title = dto.Title ?? "";
            existing.Content = dto.Content ?? "";

            if (image != null)
            {
                if (!string.IsNullOrWhiteSpace(existing.Image))
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(image, existing.Image);
                }
                else
                {
                    // First-time upload
                    existing.Image = await _fileStorage.SaveAsync(
                        image,
                        subFolder: "aboutus",
                        filePrefix: $"VISION_{id}"
                    );
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVisionMission(int id)
        {
            var item = await _context.VisionMissions.FindAsync(id);
            if (item == null) return NotFound();
            _context.VisionMissions.Remove(item);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    public class VisionMissionDto
    {
        public string? Type { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
    }
}