using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResearchCompendiumController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public ResearchCompendiumController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // GET: api/ResearchCompendium
        [HttpGet]
        public async Task<ActionResult<object>> GetResearchCompendiums()
        {
            try
            {
                var compendiums = await _context.ResearchCompendiums
                    .OrderByDescending(rc => rc.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = compendiums });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching research compendiums", error = ex.Message });
            }
        }

        // GET: api/ResearchCompendium/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetResearchCompendium(int id)
        {
            try
            {
                var compendium = await _context.ResearchCompendiums.FindAsync(id);

                if (compendium == null)
                {
                    return NotFound(new { success = false, message = "Research compendium not found" });
                }

                return Ok(new { success = true, data = compendium });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching research compendium", error = ex.Message });
            }
        }

        // POST: api/ResearchCompendium
        [HttpPost]
        public async Task<ActionResult<object>> PostResearchCompendium([FromForm] ResearchCompendiumDto dto)
        {
            try
            {
                var compendium = new ResearchCompendium
                {
                    Duration = dto.Duration,
                    PublishingYear = dto.PublishingYear,
                    Status = dto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                // Handle file upload
                if (dto.PdfFile != null && dto.PdfFile.Length > 0)
                {
                    var uploadsFolder = _fileService.GetUploadPath("research-compendiums");
                    Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(dto.PdfFile.FileName);
                    var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using (var fileStream = new FileStream(filePath, FileMode.Create))
                    {
                        await dto.PdfFile.CopyToAsync(fileStream);
                    }

                    compendium.PdfFilePath = $"research-compendiums/{uniqueFileName}";
                    compendium.PdfFileName = dto.PdfFile.FileName;
                }

                _context.ResearchCompendiums.Add(compendium);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research compendium created successfully", data = compendium });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error creating research compendium", error = ex.Message });
            }
        }

        // PUT: api/ResearchCompendium/5
        [HttpPut("{id}")]
        public async Task<ActionResult<object>> PutResearchCompendium(int id, [FromForm] ResearchCompendiumDto dto)
        {
            try
            {
                var compendium = await _context.ResearchCompendiums.FindAsync(id);
                if (compendium == null)
                {
                    return NotFound(new { success = false, message = "Research compendium not found" });
                }

                // Update basic fields
                compendium.Duration = dto.Duration;
                compendium.PublishingYear = dto.PublishingYear;
                compendium.Status = dto.Status;

                // Handle file upload
                if (dto.PdfFile != null && dto.PdfFile.Length > 0)
                {
                    // Delete old file if exists
                    if (!string.IsNullOrEmpty(compendium.PdfFilePath))
                    {
                        var oldFilePath = Path.Combine(_fileService.GetUploadPath(""), compendium.PdfFilePath);
                        if (System.IO.File.Exists(oldFilePath))
                        {
                            System.IO.File.Delete(oldFilePath);
                        }
                    }

                    // Upload new file
                    var uploadsFolder = _fileService.GetUploadPath("research-compendiums");
                    Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(dto.PdfFile.FileName);
                    var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using (var fileStream = new FileStream(filePath, FileMode.Create))
                    {
                        await dto.PdfFile.CopyToAsync(fileStream);
                    }

                    compendium.PdfFilePath = $"research-compendiums/{uniqueFileName}";
                    compendium.PdfFileName = dto.PdfFile.FileName;
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research compendium updated successfully", data = compendium });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error updating research compendium", error = ex.Message });
            }
        }

        // DELETE: api/ResearchCompendium/5
        [HttpDelete("{id}")]
        public async Task<ActionResult<object>> DeleteResearchCompendium(int id)
        {
            try
            {
                var compendium = await _context.ResearchCompendiums.FindAsync(id);
                if (compendium == null)
                {
                    return NotFound(new { success = false, message = "Research compendium not found" });
                }

                // Delete associated file
                if (!string.IsNullOrEmpty(compendium.PdfFilePath))
                {
                    var filePath = Path.Combine(_fileService.GetUploadPath(""), compendium.PdfFilePath);
                    if (System.IO.File.Exists(filePath))
                    {
                        System.IO.File.Delete(filePath);
                    }
                }

                _context.ResearchCompendiums.Remove(compendium);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research compendium deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting research compendium", error = ex.Message });
            }
        }

        // GET: api/ResearchCompendium/download/5
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadFile(int id)
        {
            try
            {
                var compendium = await _context.ResearchCompendiums.FindAsync(id);
                if (compendium == null || string.IsNullOrEmpty(compendium.PdfFilePath))
                {
                    return NotFound(new { success = false, message = "File not found" });
                }

                var filePath = Path.Combine(_fileService.GetUploadPath(""), compendium.PdfFilePath);
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound(new { success = false, message = "Physical file not found" });
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                return File(fileBytes, "application/pdf", compendium.PdfFileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error downloading file", error = ex.Message });
            }
        }
    }

    public class ResearchCompendiumDto
    {
        public string Duration { get; set; }
        public int PublishingYear { get; set; }
        public string Status { get; set; } = "Active";
        public IFormFile? PdfFile { get; set; }
    }
}