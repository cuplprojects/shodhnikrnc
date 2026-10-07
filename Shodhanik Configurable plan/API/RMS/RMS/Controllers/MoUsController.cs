using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MoUsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public MoUsController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // ===============================
        // GET: api/MoUs
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MoU>>> GetMoUs()
        {
            try
            {
                var mous = await _context.MoUs
                    .OrderByDescending(m => m.Year)
                    .ThenByDescending(m => m.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = mous });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving MoUs", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/MoUs/5
        // ===============================
        [HttpGet("{id}")]
        public async Task<ActionResult<MoU>> GetMoU(int id)
        {
            try
            {
                var mou = await _context.MoUs.FindAsync(id);

                if (mou == null)
                    return NotFound(new { success = false, message = "MoU not found" });

                return Ok(new { success = true, data = mou });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving MoU", error = ex.Message });
            }
        }

        // ===============================
        // PUT: api/MoUs/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutMoU(int id, [FromForm] MoUDto mouDto)
        {
            try
            {
                var existingMoU = await _context.MoUs.FindAsync(id);
                if (existingMoU == null)
                    return NotFound(new { success = false, message = "MoU not found" });

                // Validate required fields
                if (string.IsNullOrEmpty(mouDto.InstitutionName))
                    return BadRequest(new { success = false, message = "Institution name is required" });

                if (string.IsNullOrEmpty(mouDto.CountryOfInstitution))
                    return BadRequest(new { success = false, message = "Country of institution is required" });

                if (mouDto.Year <= 0)
                    return BadRequest(new { success = false, message = "Valid year is required" });

                existingMoU.InstitutionName = mouDto.InstitutionName;
                existingMoU.CountryOfInstitution = mouDto.CountryOfInstitution;
                existingMoU.Department = mouDto.Department ?? "";
                existingMoU.NatureOfMoU = mouDto.NatureOfMoU ?? "";
                existingMoU.Year = mouDto.Year;
                existingMoU.Status = mouDto.Status ?? "Active";

                // Handle PDF file upload if provided
                if (mouDto.PdfFile != null && mouDto.PdfFile.Length > 0)
                {
                    var uploadResult = await SavePdfFileAsync(mouDto.PdfFile);
                    if (uploadResult.Success)
                    {
                        // Delete old file if exists
                        if (!string.IsNullOrEmpty(existingMoU.PdfFilePath))
                        {
                            DeleteFile(existingMoU.PdfFilePath);
                        }

                        existingMoU.PdfFilePath = uploadResult.FilePath;
                        existingMoU.PdfFileName = uploadResult.FileName;
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "MoU updated successfully", data = existingMoU });
            }
            catch (Exception ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error updating MoU", error = ex.Message, innerError = innerException });
            }
        }

        // ===============================
        // POST: api/MoUs
        // ===============================
        [HttpPost]
        public async Task<ActionResult<MoU>> PostMoU([FromForm] MoUDto mouDto)
        {
            try
            {
                // Validate required fields
                if (string.IsNullOrEmpty(mouDto.InstitutionName))
                    return BadRequest(new { success = false, message = "Institution name is required" });

                if (string.IsNullOrEmpty(mouDto.CountryOfInstitution))
                    return BadRequest(new { success = false, message = "Country of institution is required" });

                if (mouDto.Year <= 0)
                    return BadRequest(new { success = false, message = "Valid year is required" });

                if (string.IsNullOrEmpty(mouDto.Status))
                    mouDto.Status = "Active";

                var mou = new MoU
                {
                    InstitutionName = mouDto.InstitutionName,
                    CountryOfInstitution = mouDto.CountryOfInstitution,
                    Department = mouDto.Department ?? "",
                    NatureOfMoU = mouDto.NatureOfMoU ?? "",
                    Year = mouDto.Year,
                    Status = mouDto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                // Handle PDF file upload if provided
                if (mouDto.PdfFile != null && mouDto.PdfFile.Length > 0)
                {
                    var uploadResult = await SavePdfFileAsync(mouDto.PdfFile);
                    if (uploadResult.Success)
                    {
                        mou.PdfFilePath = uploadResult.FilePath;
                        mou.PdfFileName = uploadResult.FileName;
                    }
                }

                _context.MoUs.Add(mou);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "MoU created successfully", data = mou });
            }
            catch (Exception ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error creating MoU", error = ex.Message, innerError = innerException });
            }
        }

        // ===============================
        // DELETE: api/MoUs/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMoU(int id)
        {
            try
            {
                var mou = await _context.MoUs.FindAsync(id);
                if (mou == null)
                    return NotFound(new { success = false, message = "MoU not found" });

                // Delete associated PDF file if exists
                if (!string.IsNullOrEmpty(mou.PdfFilePath))
                {
                    DeleteFile(mou.PdfFilePath);
                }

                _context.MoUs.Remove(mou);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "MoU deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting MoU", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/MoUs/download/{id}
        // ===============================
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadPdf(int id)
        {
            try
            {
                var mou = await _context.MoUs.FindAsync(id);
                if (mou == null)
                {
                    return NotFound(new { success = false, message = $"MoU with ID {id} not found in database" });
                }
                
                if (string.IsNullOrEmpty(mou.PdfFilePath))
                {
                    return NotFound(new { success = false, message = $"MoU {id} exists but has no PDF file attached" });
                }

                var basePath = _fileService.GetUploadPath("");
                var filePath = Path.Combine(basePath, mou.PdfFilePath);
                
                // Normalize path separators
                filePath = filePath.Replace('/', Path.DirectorySeparatorChar);
                
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound(new { 
                        success = false, 
                        message = "PDF file not found on server", 
                        details = new {
                            mouId = id,
                            institutionName = mou.InstitutionName,
                            expectedPath = filePath,
                            relativePath = mou.PdfFilePath,
                            fileName = mou.PdfFileName
                        }
                    });
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                var fileName = !string.IsNullOrEmpty(mou.PdfFileName) ? mou.PdfFileName : $"MoU_{id}.pdf";
                
                return File(fileBytes, "application/pdf", fileName);
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
                var uploadsDir = _fileService.GetUploadPath("mous");
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
                var relativePath = $"mous/{uniqueFileName}";
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

        private bool MoUExists(int id)
        {
            return _context.MoUs.Any(e => e.Id == id);
        }
    }

    // DTO for form data
    public class MoUDto
    {
        public string InstitutionName { get; set; }
        public string CountryOfInstitution { get; set; }
        public string Department { get; set; }
        public string NatureOfMoU { get; set; }
        public int Year { get; set; }
        public string Status { get; set; }
        public IFormFile? PdfFile { get; set; }
    }
}