using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhdSyllabusController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;
        private readonly IConfiguration _configuration;

        public PhdSyllabusController(RMSDbContext context, IFileStorageService fileStorage, IConfiguration configuration)
        {
            _context = context;
            _fileStorage = fileStorage;
            _configuration = configuration;
        }

        // GET: api/PhdSyllabus
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PhdSyllabus>>> GetPhdSyllabuses()
        {
            try
            {
                var syllabuses = await _context.PhdSyllabuses
                    .Where(s => s.Status != "Deleted")
                    .OrderBy(s => s.Department)
                    .ThenBy(s => s.Subject)
                    .ToListAsync();

                return Ok(new { success = true, data = syllabuses });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching syllabuses", error = ex.Message });
            }
        }

        // GET: api/PhdSyllabus/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PhdSyllabus>> GetPhdSyllabus(int id)
        {
            try
            {
                var syllabus = await _context.PhdSyllabuses.FindAsync(id);

                if (syllabus == null || syllabus.Status == "Deleted")
                {
                    return NotFound(new { success = false, message = "Syllabus not found" });
                }

                return Ok(new { success = true, data = syllabus });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error fetching syllabus", error = ex.Message });
            }
        }

        // POST: api/PhdSyllabus
        [HttpPost]
        public async Task<ActionResult<PhdSyllabus>> CreatePhdSyllabus([FromForm] PhdSyllabusDto syllabusDto)
        {
            try
            {
                // Check if syllabus already exists for this department
                var existingSyllabus = await _context.PhdSyllabuses
                    .FirstOrDefaultAsync(s => s.Department == syllabusDto.Department && s.Status != "Deleted");

                if (existingSyllabus != null)
                {
                    return BadRequest(new { success = false, message = "Syllabus already exists for this department" });
                }

                var syllabus = new PhdSyllabus
                {
                    Department = syllabusDto.Department,
                    Subject = syllabusDto.Subject ?? syllabusDto.Department,
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow
                };

                // Handle file upload
                if (syllabusDto.SyllabusFile != null)
                {
                    var filePath = await _fileStorage.SaveAsync(
                        syllabusDto.SyllabusFile,
                        subFolder: "phd-syllabus",
                        filePrefix: $"syllabus_{syllabusDto.Department.Replace(" ", "_")}"
                    );
                    syllabus.SyllabusFilePath = filePath;
                }

                _context.PhdSyllabuses.Add(syllabus);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetPhdSyllabus), new { id = syllabus.Id }, 
                    new { success = true, data = syllabus, message = "Syllabus created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error creating syllabus", error = ex.Message });
            }
        }

        // PUT: api/PhdSyllabus/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePhdSyllabus(int id, [FromForm] PhdSyllabusDto syllabusDto)
        {
            try
            {
                var syllabus = await _context.PhdSyllabuses.FindAsync(id);
                if (syllabus == null || syllabus.Status == "Deleted")
                {
                    return NotFound(new { success = false, message = "Syllabus not found" });
                }

                // Update properties
                syllabus.Department = syllabusDto.Department;
                syllabus.Subject = syllabusDto.Subject ?? syllabusDto.Department;
                syllabus.UpdatedAt = DateTime.UtcNow;

                // Handle file upload
                if (syllabusDto.SyllabusFile != null)
                {
                    // If there's an existing file, we'll overwrite it, otherwise create new
                    if (!string.IsNullOrEmpty(syllabus.SyllabusFilePath))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(syllabusDto.SyllabusFile, syllabus.SyllabusFilePath);
                    }
                    else
                    {
                        // Save new file
                        var filePath = await _fileStorage.SaveAsync(
                            syllabusDto.SyllabusFile,
                            subFolder: "phd-syllabus",
                            filePrefix: $"syllabus_{syllabusDto.Department.Replace(" ", "_")}"
                        );
                        syllabus.SyllabusFilePath = filePath;
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = syllabus, message = "Syllabus updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error updating syllabus", error = ex.Message });
            }
        }

        // DELETE: api/PhdSyllabus/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePhdSyllabus(int id)
        {
            try
            {
                var syllabus = await _context.PhdSyllabuses.FindAsync(id);
                if (syllabus == null || syllabus.Status == "Deleted")
                {
                    return NotFound(new { success = false, message = "Syllabus not found" });
                }

                // Soft delete
                syllabus.Status = "Deleted";
                syllabus.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Syllabus deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting syllabus", error = ex.Message });
            }
        }

        // GET: api/PhdSyllabus/download/5
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadSyllabus(int id)
        {
            try
            {
                var syllabus = await _context.PhdSyllabuses.FindAsync(id);
                if (syllabus == null || syllabus.Status == "Deleted" || string.IsNullOrEmpty(syllabus.SyllabusFilePath))
                {
                    return NotFound(new { success = false, message = "Syllabus file not found" });
                }

                // Get the full file path
                var rootFolder = _configuration["FilePath"] ?? "wwwroot";
                var fullPath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    rootFolder,
                    syllabus.SyllabusFilePath.Replace("/", Path.DirectorySeparatorChar.ToString())
                );

                if (!System.IO.File.Exists(fullPath))
                {
                    return NotFound(new { success = false, message = "File not found on server" });
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(fullPath);
                var fileName = Path.GetFileName(syllabus.SyllabusFilePath);
                var contentType = "application/pdf"; // Default to PDF, you can enhance this based on file extension

                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error downloading file", error = ex.Message });
            }
        }
    }

    // DTO for form data
    public class PhdSyllabusDto
    {
        public string Department { get; set; }
        public string? Subject { get; set; }
        public IFormFile? SyllabusFile { get; set; }
    }
}