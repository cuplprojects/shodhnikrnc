using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NoticeboardNoticesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<NoticeboardNoticesController> _logger;

        public NoticeboardNoticesController(RMSDbContext context, ILogger<NoticeboardNoticesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/NoticeboardNotices
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NoticeboardNotice>>> GetNoticeboardNotices()
        {
            try
            {
                var notices = await _context.NoticeboardNotices
                    .Where(n => n.IsActive)
                    .OrderByDescending(n => n.Id)
                    .ToListAsync();

                return Ok(new { success = true, data = notices });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving noticeboard notices");
                return StatusCode(500, new { success = false, message = "Error retrieving noticeboard notices", error = ex.Message });
            }
        }

        // GET: api/NoticeboardNotices/5
        [HttpGet("{id}")]
        public async Task<ActionResult<NoticeboardNotice>> GetNoticeboardNotice(int id)
        {
            try
            {
                var notice = await _context.NoticeboardNotices.FindAsync(id);

                if (notice == null)
                {
                    return NotFound(new { success = false, message = "Noticeboard notice not found" });
                }

                return Ok(new { success = true, data = notice });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving noticeboard notice");
                return StatusCode(500, new { success = false, message = "Error retrieving noticeboard notice", error = ex.Message });
            }
        }

        // POST: api/NoticeboardNotices
        [HttpPost]
        public async Task<ActionResult<NoticeboardNotice>> PostNoticeboardNotice(NoticeboardNotice notice)
        {
            try
            {
                var currentUser = GetCurrentUser();

                notice.IsActive = true;

                _context.NoticeboardNotices.Add(notice);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetNoticeboardNotice", new { id = notice.Id }, new { success = true, data = notice });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating noticeboard notice");
                return StatusCode(500, new { success = false, message = "Error creating noticeboard notice", error = ex.Message });
            }
        }

        // PUT: api/NoticeboardNotices/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutNoticeboardNotice(int id, NoticeboardNotice notice)
        {
            try
            {
                if (id != notice.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingNotice = await _context.NoticeboardNotices.FindAsync(id);
                if (existingNotice == null)
                {
                    return NotFound(new { success = false, message = "Noticeboard notice not found" });
                }

                var currentUser = GetCurrentUser();

                existingNotice.Type = notice.Type;
                existingNotice.Title = notice.Title;
                existingNotice.Content = notice.Content;
                existingNotice.BgColor = notice.BgColor;
                existingNotice.Priority = notice.Priority;
                existingNotice.SendPushNotification = notice.SendPushNotification;


                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingNotice });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!NoticeboardNoticeExists(id))
                {
                    return NotFound(new { success = false, message = "Noticeboard notice not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating noticeboard notice");
                return StatusCode(500, new { success = false, message = "Error updating noticeboard notice", error = ex.Message });
            }
        }

        // DELETE: api/NoticeboardNotices/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNoticeboardNotice(int id)
        {
            try
            {
                var notice = await _context.NoticeboardNotices.FindAsync(id);
                if (notice == null)
                {
                    return NotFound(new { success = false, message = "Noticeboard notice not found" });
                }

                _context.NoticeboardNotices.Remove(notice);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Noticeboard notice deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting noticeboard notice");
                return StatusCode(500, new { success = false, message = "Error deleting noticeboard notice", error = ex.Message });
            }
        }

        private bool NoticeboardNoticeExists(int id)
        {
            return _context.NoticeboardNotices.Any(e => e.Id == id);
        }
    }
}