using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResearchProjectsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public ResearchProjectsController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // ===============================
        // GET: api/ResearchProjects
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResearchProject>>> GetResearchProjects()
        {
            try
            {
                var projects = await _context.ResearchProjects
                    .OrderByDescending(p => p.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = projects });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving research projects", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/ResearchProjects/5
        // ===============================
        [HttpGet("{id}")]
        public async Task<ActionResult<ResearchProject>> GetResearchProject(int id)
        {
            try
            {
                var project = await _context.ResearchProjects.FindAsync(id);

                if (project == null)
                    return NotFound(new { success = false, message = "Research project not found" });

                return Ok(new { success = true, data = project });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving research project", error = ex.Message });
            }
        }

        // ===============================
        // PUT: api/ResearchProjects/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutResearchProject(int id, [FromForm] ResearchProjectDto projectDto)
        {
            try
            {
                var existingProject = await _context.ResearchProjects.FindAsync(id);
                if (existingProject == null)
                    return NotFound(new { success = false, message = "Research project not found" });

                existingProject.Title = projectDto.Title;
                existingProject.FundingAgency = projectDto.FundingAgency;
                existingProject.PrincipalInvestigator = projectDto.PrincipalInvestigator;
                existingProject.Department = projectDto.Department;
                existingProject.StartDate = projectDto.StartDate;
                existingProject.ExpectedCompletionDate = projectDto.ExpectedCompletionDate;
                existingProject.Amount = projectDto.Amount;
                existingProject.Status = projectDto.Status;

                // Handle file upload if provided
                if (projectDto.Attachment != null && projectDto.Attachment.Length > 0)
                {
                    var uploadResult = await SaveAttachmentAsync(projectDto.Attachment);
                    if (uploadResult.Success)
                    {
                        // Delete old file if exists
                        if (!string.IsNullOrEmpty(existingProject.AttachmentPath))
                        {
                            DeleteFile(existingProject.AttachmentPath);
                        }

                        existingProject.AttachmentPath = uploadResult.FilePath;
                        existingProject.AttachmentFileName = uploadResult.FileName;
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research project updated successfully", data = existingProject });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error updating research project", error = ex.Message });
            }
        }

        // ===============================
        // POST: api/ResearchProjects
        // ===============================
        [HttpPost]
        public async Task<ActionResult<ResearchProject>> PostResearchProject([FromForm] ResearchProjectDto projectDto)
        {
            try
            {
                // Validate required fields
                if (string.IsNullOrEmpty(projectDto.Title))
                    return BadRequest(new { success = false, message = "Title is required" });
                
                if (string.IsNullOrEmpty(projectDto.FundingAgency))
                    return BadRequest(new { success = false, message = "Funding Agency is required" });
                
                if (string.IsNullOrEmpty(projectDto.PrincipalInvestigator))
                    return BadRequest(new { success = false, message = "Principal Investigator is required" });
                
                if (string.IsNullOrEmpty(projectDto.Department))
                    return BadRequest(new { success = false, message = "Department is required" });
                
                if (string.IsNullOrEmpty(projectDto.Status))
                    projectDto.Status = "Active";

                var project = new ResearchProject
                {
                    Title = projectDto.Title,
                    FundingAgency = projectDto.FundingAgency,
                    PrincipalInvestigator = projectDto.PrincipalInvestigator,
                    Department = projectDto.Department,
                    StartDate = projectDto.StartDate,
                    ExpectedCompletionDate = projectDto.ExpectedCompletionDate,
                    Amount = projectDto.Amount,
                    Status = projectDto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                // Handle file upload if provided
                if (projectDto.Attachment != null && projectDto.Attachment.Length > 0)
                {
                    var uploadResult = await SaveAttachmentAsync(projectDto.Attachment);
                    if (uploadResult.Success)
                    {
                        project.AttachmentPath = uploadResult.FilePath;
                        project.AttachmentFileName = uploadResult.FileName;
                    }
                }

                _context.ResearchProjects.Add(project);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research project created successfully", data = project });
            }
            catch (Exception ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, new { success = false, message = "Error creating research project", error = ex.Message, innerError = innerException, stackTrace = ex.StackTrace });
            }
        }

        // ===============================
        // DELETE: api/ResearchProjects/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteResearchProject(int id)
        {
            try
            {
                var project = await _context.ResearchProjects.FindAsync(id);
                if (project == null)
                    return NotFound(new { success = false, message = "Research project not found" });

                // Delete associated file if exists
                if (!string.IsNullOrEmpty(project.AttachmentPath))
                {
                    DeleteFile(project.AttachmentPath);
                }

                _context.ResearchProjects.Remove(project);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Research project deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting research project", error = ex.Message });
            }
        }

        // ===============================
        // GET: api/ResearchProjects/download/{id}
        // ===============================
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadAttachment(int id)
        {
            try
            {
                var project = await _context.ResearchProjects.FindAsync(id);
                if (project == null || string.IsNullOrEmpty(project.AttachmentPath))
                    return NotFound(new { success = false, message = "File not found" });

                var filePath = Path.Combine(_fileService.GetUploadPath(""), project.AttachmentPath);
                
                if (!System.IO.File.Exists(filePath))
                    return NotFound(new { success = false, message = "Physical file not found" });

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                var contentType = GetContentType(project.AttachmentFileName);

                return File(fileBytes, contentType, project.AttachmentFileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error downloading file", error = ex.Message });
            }
        }

        // ===============================
        // HELPER METHODS
        // ===============================
        private async Task<(bool Success, string FilePath, string FileName)> SaveAttachmentAsync(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return (false, "", "");

                // Create uploads directory if it doesn't exist
                var uploadsDir = _fileService.GetUploadPath("research-projects");
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
                var relativePath = $"research-projects/{uniqueFileName}";
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

        private string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                _ => "application/octet-stream"
            };
        }

        private bool ResearchProjectExists(int id)
        {
            return _context.ResearchProjects.Any(e => e.Id == id);
        }
    }

    // DTO for form data
    public class ResearchProjectDto
    {
        public string Title { get; set; }
        public string FundingAgency { get; set; }
        public string PrincipalInvestigator { get; set; }
        public string Department { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime ExpectedCompletionDate { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; }
        public IFormFile? Attachment { get; set; }
    }
}