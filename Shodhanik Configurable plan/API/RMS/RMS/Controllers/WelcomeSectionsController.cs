using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WelcomeSectionsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<WelcomeSectionsController> _logger;

        public WelcomeSectionsController(RMSDbContext context, ILogger<WelcomeSectionsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/WelcomeSections
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WelcomeSection>>> GetWelcomeSections()
        {
            try
            {
                var sections = await _context.WelcomeSections
                    .Where(w => w.IsActive)
                    .OrderByDescending(w => w.Id)
                    .ToListAsync();

                return Ok(new { success = true, data = sections });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving welcome sections");
                return StatusCode(500, new { success = false, message = "Error retrieving welcome sections", error = ex.Message });
            }
        }

        // GET: api/WelcomeSections/5
        [HttpGet("{id}")]
        public async Task<ActionResult<WelcomeSection>> GetWelcomeSection(int id)
        {
            try
            {
                var section = await _context.WelcomeSections.FindAsync(id);

                if (section == null)
                {
                    return NotFound(new { success = false, message = "Welcome section not found" });
                }

                return Ok(new { success = true, data = section });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving welcome section");
                return StatusCode(500, new { success = false, message = "Error retrieving welcome section", error = ex.Message });
            }
        }

        // GET: api/WelcomeSections/active
        [HttpGet("active")]
        public async Task<ActionResult<WelcomeSection>> GetActiveWelcomeSection()
        {
            try
            {
                var section = await _context.WelcomeSections
                    .Where(w => w.IsActive)
                    .OrderByDescending(w => w.Id)
                    .FirstOrDefaultAsync();

                if (section == null)
                {
                    return NotFound(new { success = false, message = "No active welcome section found" });
                }

                return Ok(new { success = true, data = section });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active welcome section");
                return StatusCode(500, new { success = false, message = "Error retrieving active welcome section", error = ex.Message });
            }
        }

        // POST: api/WelcomeSections
        [HttpPost]
        public async Task<ActionResult<WelcomeSection>> PostWelcomeSection(WelcomeSection section)
        {
            try
            {
                var currentUser = GetCurrentUser();

                section.IsActive = true;

                _context.WelcomeSections.Add(section);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetWelcomeSection", new { id = section.Id }, new { success = true, data = section });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating welcome section");
                return StatusCode(500, new { success = false, message = "Error creating welcome section", error = ex.Message });
            }
        }

        // PUT: api/WelcomeSections/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutWelcomeSection(int id, WelcomeSection section)
        {
            try
            {
                if (id != section.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingSection = await _context.WelcomeSections.FindAsync(id);
                if (existingSection == null)
                {
                    return NotFound(new { success = false, message = "Welcome section not found" });
                }

                var currentUser = GetCurrentUser();

                existingSection.WelcomeTitle = section.WelcomeTitle;
                existingSection.WelcomeText = section.WelcomeText;


                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingSection });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!WelcomeSectionExists(id))
                {
                    return NotFound(new { success = false, message = "Welcome section not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating welcome section");
                return StatusCode(500, new { success = false, message = "Error updating welcome section", error = ex.Message });
            }
        }

        // DELETE: api/WelcomeSections/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWelcomeSection(int id)
        {
            try
            {
                var section = await _context.WelcomeSections.FindAsync(id);
                if (section == null)
                {
                    return NotFound(new { success = false, message = "Welcome section not found" });
                }

                _context.WelcomeSections.Remove(section);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Welcome section deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting welcome section");
                return StatusCode(500, new { success = false, message = "Error deleting welcome section", error = ex.Message });
            }
        }

        private bool WelcomeSectionExists(int id)
        {
            return _context.WelcomeSections.Any(e => e.Id == id);
        }
    }
}