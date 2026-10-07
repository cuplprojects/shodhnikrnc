using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrdinancesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public OrdinancesController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // ===============================
        // GET: api/Ordinances
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Ordinance>>> GetOrdinances()
        {
            try
            {
                var ordinances = await _context.Ordinances
                    .OrderByDescending(o => o.Year)
                    .ThenByDescending(o => o.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = ordinances });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving ordinances", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/Ordinances/5
        // ===============================
        [HttpGet("{id}")]
        public async Task<ActionResult<Ordinance>> GetOrdinance(int id)
        {
            try
            {
                var ordinance = await _context.Ordinances.FindAsync(id);

                if (ordinance == null)
                    return NotFound(new { success = false, message = "Ordinance not found" });

                return Ok(new { success = true, data = ordinance });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving ordinance", error = ex.Message });
            }
        }

        // ===============================
        // PUT: api/Ordinances/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutOrdinance(int id, [FromForm] OrdinanceDto ordinanceDto)
        {
            try
            {
                var existingOrdinance = await _context.Ordinances.FindAsync(id);
                if (existingOrdinance == null)
                    return NotFound(new { success = false, message = "Ordinance not found" });

                // Validate required fields
                if (string.IsNullOrEmpty(ordinanceDto.Title))
                    return BadRequest(new { success = false, message = "Title is required" });

                if (ordinanceDto.Year <= 0)
                    return BadRequest(new { success = false, message = "Valid year is required" });

                existingOrdinance.Title = ordinanceDto.Title;
                existingOrdinance.Year = ordinanceDto.Year;
                existingOrdinance.Status = ordinanceDto.Status ?? "Active";

                // Handle PDF file upload if provided
                if (ordinanceDto.PdfFile != null && ordinanceDto.PdfFile.Length > 0)
                {
                    var uploadResult = await SavePdfFileAsync(ordinanceDto.PdfFile);
                    if (uploadResult.Success)
                    {
                        // Delete old file if exists
                        if (!string.IsNullOrEmpty(existingOrdinance.PdfFilePath))
                        {
                            DeleteFile(existingOrdinance.PdfFilePath);
                        }

                        existingOrdinance.PdfFilePath = uploadResult.FilePath;
                        existingOrdinance.PdfFileName = uploadResult.FileName;
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Ordinance updated successfully", data = existingOrdinance });
            }
            catch (Exception ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error updating ordinance", error = ex.Message, innerError = innerException });
            }
        }

        // ===============================
        // POST: api/Ordinances
        // ===============================
        [HttpPost]
        public async Task<ActionResult<Ordinance>> PostOrdinance([FromForm] OrdinanceDto ordinanceDto)
        {
            try
            {
                // Validate required fields
                if (string.IsNullOrEmpty(ordinanceDto.Title))
                    return BadRequest(new { success = false, message = "Title is required" });

                if (ordinanceDto.Year <= 0)
                    return BadRequest(new { success = false, message = "Valid year is required" });

                if (string.IsNullOrEmpty(ordinanceDto.Status))
                    ordinanceDto.Status = "Active";

                var ordinance = new Ordinance
                {
                    Title = ordinanceDto.Title,
                    Year = ordinanceDto.Year,
                    Status = ordinanceDto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                // Handle PDF file upload if provided
                if (ordinanceDto.PdfFile != null && ordinanceDto.PdfFile.Length > 0)
                {
                    var uploadResult = await SavePdfFileAsync(ordinanceDto.PdfFile);
                    if (uploadResult.Success)
                    {
                        ordinance.PdfFilePath = uploadResult.FilePath;
                        ordinance.PdfFileName = uploadResult.FileName;
                    }
                }

                _context.Ordinances.Add(ordinance);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Ordinance created successfully", data = ordinance });
            }
            catch (Exception ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error creating ordinance", error = ex.Message, innerError = innerException });
            }
        }

        // ===============================
        // DELETE: api/Ordinances/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrdinance(int id)
        {
            try
            {
                var ordinance = await _context.Ordinances.FindAsync(id);
                if (ordinance == null)
                    return NotFound(new { success = false, message = "Ordinance not found" });

                // Delete associated PDF file if exists
                if (!string.IsNullOrEmpty(ordinance.PdfFilePath))
                {
                    DeleteFile(ordinance.PdfFilePath);
                }

                _context.Ordinances.Remove(ordinance);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Ordinance deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting ordinance", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/Ordinances/download/{id}
        // ===============================
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadPdf(int id)
        {
            try
            {
                var ordinance = await _context.Ordinances.FindAsync(id);
                if (ordinance == null || string.IsNullOrEmpty(ordinance.PdfFilePath))
                    return NotFound(new { success = false, message = "PDF file not found" });

                var filePath = Path.Combine(_fileService.GetUploadPath(""), ordinance.PdfFilePath);
                
                if (!System.IO.File.Exists(filePath))
                    return NotFound(new { success = false, message = "Physical file not found" });

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                return File(fileBytes, "application/pdf", ordinance.PdfFileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error downloading file", error = ex.Message });
            }
        }

        // ===============================
        // HELPER METHODS
        // ===============================
        private async Task<(bool Success, string FilePath, string FileName)> SavePdfFileAsync(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return (false, "", "");

                // Validate file type (PDF only)
                if (file.ContentType != "application/pdf" && !file.FileName.ToLower().EndsWith(".pdf"))
                    return (false, "", "");

                // Create uploads directory if it doesn't exist
                var uploadsDir = _fileService.GetUploadPath("ordinances");
                if (!Directory.Exists(uploadsDir))
                    Directory.CreateDirectory(uploadsDir);

                // Generate unique filename
                var fileExtension = Path.GetExtension(file.FileName);
                var uniqueFileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(uploadsDir, uniqueFileName);

                // Save file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Return relative path for database storage
                var relativePath = $"ordinances/{uniqueFileName}";
                return (true, relativePath, file.FileName);
            }
            catch
            {
                return (false, "", "");
            }
        }

        private void DeleteFile(string filePath)
        {
            try
            {
                if (!string.IsNullOrEmpty(filePath))
                {
                    var fullPath = Path.Combine(_fileService.GetUploadPath(""), filePath);
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                    }
                }
            }
            catch
            {
                // Log error but don't throw
            }
        }

        private bool OrdinanceExists(int id)
        {
            return _context.Ordinances.Any(e => e.Id == id);
        }
    }

    // DTO for form data
    public class OrdinanceDto
    {
        public string Title { get; set; }
        public int Year { get; set; }
        public string Status { get; set; }
        public IFormFile? PdfFile { get; set; }
    }
}