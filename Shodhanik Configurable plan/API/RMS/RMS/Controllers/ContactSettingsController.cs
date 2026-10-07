using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ContactSettingsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<ContactSettingsController> _logger;

        public ContactSettingsController(RMSDbContext context, ILogger<ContactSettingsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<ContactSettings>> GetContactSettings()
        {
            try
            {
                var settings = await _context.ContactSettings
                    .Where(c => c.IsActive)
                    .FirstOrDefaultAsync();

                if (settings == null)
                {
                    return NotFound(new { success = false, message = "Contact settings not found" });
                }

                return Ok(new { success = true, data = settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving contact settings");
                return StatusCode(500, new { success = false, message = "Error retrieving contact settings", error = ex.Message });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ContactSettings>> CreateContactSettings([FromBody] ContactSettings contactSettings)
        {
            try
            {
                // Check if settings already exist
                var existingSettings = await _context.ContactSettings.AnyAsync(c => c.IsActive);
                if (existingSettings)
                {
                    return Conflict(new { success = false, message = "Contact settings already exist. Use PUT to update." });
                }

                contactSettings.IsActive = true;
                contactSettings.CreatedAt = DateTime.UtcNow;
                contactSettings.UpdatedAt = DateTime.UtcNow;

                _context.ContactSettings.Add(contactSettings);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetContactSettings), new { success = true, data = contactSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating contact settings");
                return StatusCode(500, new { success = false, message = "Error creating contact settings", error = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ContactSettings>> UpdateContactSettings(int id, [FromBody] ContactSettings contactSettings)
        {
            try
            {
                if (id != contactSettings.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingSettings = await _context.ContactSettings.FindAsync(id);
                if (existingSettings == null)
                {
                    return NotFound(new { success = false, message = "Contact settings not found" });
                }

                // Update properties
                existingSettings.UniversityName = contactSettings.UniversityName;
                existingSettings.StreetAddress = contactSettings.StreetAddress;
                existingSettings.City = contactSettings.City;
                existingSettings.Phone = contactSettings.Phone;
                existingSettings.Email = contactSettings.Email;
                existingSettings.Helpline = contactSettings.Helpline;
                existingSettings.HelpdeskEmail = contactSettings.HelpdeskEmail;
                existingSettings.WorkingHours = contactSettings.WorkingHours;
                existingSettings.MapUrl = contactSettings.MapUrl;
                existingSettings.RailwayDistance = contactSettings.RailwayDistance;
                existingSettings.OldBusStandDistance = contactSettings.OldBusStandDistance;
                existingSettings.NewBusStandDistance = contactSettings.NewBusStandDistance;
                existingSettings.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating contact settings");
                return StatusCode(500, new { success = false, message = "Error updating contact settings", error = ex.Message });
            }
        }

        [HttpPost("reset")]
        public async Task<ActionResult> ResetContactSettings()
        {
            try
            {
                var existingSettings = await _context.ContactSettings.Where(c => c.IsActive).ToListAsync();
                
                foreach (var setting in existingSettings)
                {
                    setting.IsActive = false;
                }

                // Create default settings
                var defaultSettings = new ContactSettings
                {
                    UniversityName = "Chaudhary Charan Singh University",
                    StreetAddress = " Meerut, Uttar Pradesh",
                    City = ", Meerut, UP 250004",
                    Phone = "+91 0121 2604570",
                    Email = "registrar@ccsuniversity.ac.in",
                    Helpline = "+91 1212763539",
                    WorkingHours = "Monday to Friday: 9:00 AM - 5:00 PM",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.ContactSettings.Add(defaultSettings);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Contact settings reset to default successfully", data = defaultSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting contact settings");
                return StatusCode(500, new { success = false, message = "Error resetting contact settings", error = ex.Message });
            }
        }
    }
}