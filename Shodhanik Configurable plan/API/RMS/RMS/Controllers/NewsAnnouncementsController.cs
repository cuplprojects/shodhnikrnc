using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NewsAnnouncementsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;
        private readonly ILogger<NewsAnnouncementsController> _logger;

        public NewsAnnouncementsController(RMSDbContext context, IFileStorageService fileStorage, ILogger<NewsAnnouncementsController> logger)
        {
            _context = context;
            _fileStorage = fileStorage;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/NewsAnnouncements
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NewsAnnouncement>>> GetNewsAnnouncements()
        {
            try
            {
                var announcements = await _context.NewsAnnouncements
                    .OrderByDescending(a => a.Date)
                    .ToListAsync();

                return Ok(new { success = true, data = announcements });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving news announcements");
                return StatusCode(500, new { success = false, message = "Error retrieving news announcements", error = ex.Message });
            }
        }

        // GET: api/NewsAnnouncements/5
        [HttpGet("{id}")]
        public async Task<ActionResult<NewsAnnouncement>> GetNewsAnnouncement(int id)
        {
            try
            {
                var announcement = await _context.NewsAnnouncements.FindAsync(id);

                if (announcement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                return Ok(new { success = true, data = announcement });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving news announcement");
                return StatusCode(500, new { success = false, message = "Error retrieving news announcement", error = ex.Message });
            }
        }

        // POST: api/NewsAnnouncements/json (for JSON creation without files)
        [HttpPost("json")]
        public async Task<ActionResult<NewsAnnouncement>> PostNewsAnnouncementJson([FromBody] NewsAnnouncement announcement)
        {
            try
            {
                announcement.IsActive = true;

                _context.NewsAnnouncements.Add(announcement);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetNewsAnnouncement", new { id = announcement.Id }, new { success = true, data = announcement });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating news announcement");
                return StatusCode(500, new { success = false, message = "Error creating news announcement", error = ex.Message });
            }
        }

        // POST: api/NewsAnnouncements
        [HttpPost]
        public async Task<ActionResult<NewsAnnouncement>> PostNewsAnnouncement([FromForm] NewsAnnouncement announcement, IFormFile? file = null)
        {
            try
            {
                var currentUser = GetCurrentUser();

                // Handle file upload using FileStorageService
                if (file != null)
                {
                    var filePath = await _fileStorage.SaveAsync(
                        file,
                        subFolder: "announcements",
                        filePrefix: $"NEWS_{announcement.Id}"
                    );
                    announcement.FilePath = filePath;
                    announcement.Size = FormatFileSize(file.Length);
                    announcement.Format = Path.GetExtension(file.FileName).ToUpperInvariant().TrimStart('.');
                }

                announcement.IsActive = true;

                _context.NewsAnnouncements.Add(announcement);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetNewsAnnouncement", new { id = announcement.Id }, new { success = true, data = announcement });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating news announcement");
                return StatusCode(500, new { success = false, message = "Error creating news announcement", error = ex.Message });
            }
        }

        // PUT: api/NewsAnnouncements/5/json (for JSON updates without files)
        [HttpPut("{id}/json")]
        public async Task<IActionResult> PutNewsAnnouncementJson(int id, [FromBody] NewsAnnouncement announcement)
        {
            try
            {
                if (id != announcement.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingAnnouncement = await _context.NewsAnnouncements.FindAsync(id);
                if (existingAnnouncement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                // Update only the provided fields
                existingAnnouncement.Title = announcement.Title;
                existingAnnouncement.Category = announcement.Category;
                existingAnnouncement.Language = announcement.Language;
                existingAnnouncement.Date = announcement.Date;
                existingAnnouncement.Status = announcement.Status;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingAnnouncement });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!NewsAnnouncementExists(id))
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating news announcement");
                return StatusCode(500, new { success = false, message = "Error updating news announcement", error = ex.Message });
            }
        }

        // PUT: api/NewsAnnouncements/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutNewsAnnouncement(int id, [FromForm] NewsAnnouncement announcement, IFormFile? file = null)
        {
            try
            {
                if (id != announcement.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingAnnouncement = await _context.NewsAnnouncements.FindAsync(id);
                if (existingAnnouncement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                var currentUser = GetCurrentUser();

                // Handle file upload using FileStorageService
                if (file != null)
                {
                    if (!string.IsNullOrWhiteSpace(existingAnnouncement.FilePath))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(file, existingAnnouncement.FilePath);
                    }
                    else
                    {
                        // First-time upload
                        existingAnnouncement.FilePath = await _fileStorage.SaveAsync(
                            file,
                            subFolder: "announcements",
                            filePrefix: $"NEWS_{id}"
                        );
                    }
                    
                    existingAnnouncement.Size = FormatFileSize(file.Length);
                    existingAnnouncement.Format = Path.GetExtension(file.FileName).ToUpperInvariant().TrimStart('.');
                }

                existingAnnouncement.Title = announcement.Title;
                existingAnnouncement.Category = announcement.Category;
                existingAnnouncement.Language = announcement.Language;
                existingAnnouncement.Date = announcement.Date;
                existingAnnouncement.Status = announcement.Status;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingAnnouncement });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!NewsAnnouncementExists(id))
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating news announcement");
                return StatusCode(500, new { success = false, message = "Error updating news announcement", error = ex.Message });
            }
        }

        // PUT: api/NewsAnnouncements/5/archive
        [HttpPut("{id}/archive")]
        public async Task<IActionResult> ArchiveNewsAnnouncement(int id)
        {
            try
            {
                var announcement = await _context.NewsAnnouncements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                announcement.IsActive = false;
                announcement.Status = "Archived";

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = announcement, message = "News announcement archived successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving news announcement");
                return StatusCode(500, new { success = false, message = "Error archiving news announcement", error = ex.Message });
            }
        }

        // PUT: api/NewsAnnouncements/5/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateNewsAnnouncementStatus(int id, [FromBody] NewsStatusRequest request)
        {
            try
            {
                var announcement = await _context.NewsAnnouncements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                announcement.Status = request.Status;
                announcement.IsActive = request.Status != "Archived";

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = announcement, message = "Status updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating news announcement status");
                return StatusCode(500, new { success = false, message = "Error updating news announcement status", error = ex.Message });
            }
        }

        // DELETE: api/NewsAnnouncements/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNewsAnnouncement(int id)
        {
            try
            {
                var announcement = await _context.NewsAnnouncements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound(new { success = false, message = "News announcement not found" });
                }

                // Note: FileStorageService handles file deletion internally when needed
                // No manual file deletion required

                _context.NewsAnnouncements.Remove(announcement);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "News announcement deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting news announcement");
                return StatusCode(500, new { success = false, message = "Error deleting news announcement", error = ex.Message });
            }
        }

        private bool NewsAnnouncementExists(int id)
        {
            return _context.NewsAnnouncements.Any(e => e.Id == id);
        }

        private string FormatFileSize(long bytes)
        {
            if (bytes < 1024) return $"{bytes} B";
            if (bytes < 1024 * 1024) return $"{bytes / 1024:F1} KB";
            return $"{bytes / (1024 * 1024):F1} MB";
        }
    }

    public class NewsStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }
}