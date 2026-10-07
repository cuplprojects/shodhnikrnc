using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BannerAnnouncementsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public BannerAnnouncementsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/BannerAnnouncements
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BannerAnnouncement>>> GetBannerAnnouncements()
        {
            var announcements = await _context.BannerAnnouncements
                .OrderBy(a => a.DisplayOrder)
                .ThenByDescending(a => a.Date)
                .ToListAsync();

            return Ok(new { success = true, data = announcements });
        }

        // GET: api/BannerAnnouncements/5
        [HttpGet("{id}")]
        public async Task<ActionResult<BannerAnnouncement>> GetBannerAnnouncement(int id)
        {
            var announcement = await _context.BannerAnnouncements.FindAsync(id);

            if (announcement == null)
            {
                return NotFound(new { success = false, message = "Banner announcement not found" });
            }

            return Ok(new { success = true, data = announcement });
        }

        // POST: api/BannerAnnouncements
        [HttpPost]
        public async Task<ActionResult<BannerAnnouncement>> PostBannerAnnouncement(BannerAnnouncement announcement)
        {
            announcement.IsActive = true;

            _context.BannerAnnouncements.Add(announcement);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetBannerAnnouncement", new { id = announcement.Id }, new { success = true, data = announcement });
        }

        // PUT: api/BannerAnnouncements/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutBannerAnnouncement(int id, BannerAnnouncement announcement)
        {
            if (id != announcement.Id)
            {
                return BadRequest(new { success = false, message = "ID mismatch" });
            }

            var existingAnnouncement = await _context.BannerAnnouncements.FindAsync(id);
            if (existingAnnouncement == null)
            {
                return NotFound(new { success = false, message = "Banner announcement not found" });
            }

            existingAnnouncement.Title = announcement.Title;
            existingAnnouncement.Category = announcement.Category;
            existingAnnouncement.Language = announcement.Language;
            existingAnnouncement.Status = announcement.Status;
            existingAnnouncement.Date = announcement.Date;
            existingAnnouncement.DisplayOrder = announcement.DisplayOrder;


            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!BannerAnnouncementExists(id))
                {
                    return NotFound(new { success = false, message = "Banner announcement not found" });
                }
                else
                {
                    throw;
                }
            }

            return Ok(new { success = true, data = existingAnnouncement });
        }

        // PUT: api/BannerAnnouncements/5/archive
        [HttpPut("{id}/archive")]
        public async Task<IActionResult> ArchiveBannerAnnouncement(int id)
        {
            var announcement = await _context.BannerAnnouncements.FindAsync(id);
            if (announcement == null)
            {
                return NotFound(new { success = false, message = "Banner announcement not found" });
            }

            announcement.IsActive = false;
            announcement.Status = "Archived";

            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = announcement, message = "Banner announcement archived successfully" });
        }

        // PUT: api/BannerAnnouncements/5/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateBannerAnnouncementStatus(int id, [FromBody] BannerStatusRequest request)
        {
            var announcement = await _context.BannerAnnouncements.FindAsync(id);
            if (announcement == null)
            {
                return NotFound(new { success = false, message = "Banner announcement not found" });
            }

            announcement.Status = request.Status;
            announcement.IsActive = request.Status != "Archived";

            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = announcement, message = "Status updated successfully" });
        }

        // DELETE: api/BannerAnnouncements/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBannerAnnouncement(int id)
        {
            var announcement = await _context.BannerAnnouncements.FindAsync(id);
            if (announcement == null)
            {
                return NotFound(new { success = false, message = "Banner announcement not found" });
            }

            _context.BannerAnnouncements.Remove(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Banner announcement deleted successfully" });
        }

        private bool BannerAnnouncementExists(int id)
        {
            return _context.BannerAnnouncements.Any(e => e.Id == id);
        }
    }

    public class BannerStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }
}