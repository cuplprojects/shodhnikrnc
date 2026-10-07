using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UniversityStatisticsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<UniversityStatisticsController> _logger;

        public UniversityStatisticsController(RMSDbContext context, ILogger<UniversityStatisticsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/UniversityStatistics
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UniversityStatistic>>> GetUniversityStatistics()
        {
            try
            {
                var statistics = await _context.UniversityStatistics
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.DisplayOrder)
                    .ToListAsync();

                return Ok(new { success = true, data = statistics });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving university statistics");
                return StatusCode(500, new { success = false, message = "Error retrieving university statistics", error = ex.Message });
            }
        }

        // GET: api/UniversityStatistics/5
        [HttpGet("{id}")]
        public async Task<ActionResult<UniversityStatistic>> GetUniversityStatistic(int id)
        {
            try
            {
                var statistic = await _context.UniversityStatistics.FindAsync(id);

                if (statistic == null)
                {
                    return NotFound(new { success = false, message = "University statistic not found" });
                }

                return Ok(new { success = true, data = statistic });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving university statistic");
                return StatusCode(500, new { success = false, message = "Error retrieving university statistic", error = ex.Message });
            }
        }

        // POST: api/UniversityStatistics
        [HttpPost]
        public async Task<ActionResult<UniversityStatistic>> PostUniversityStatistic(UniversityStatistic statistic)
        {
            try
            {
                var currentUser = GetCurrentUser();

                statistic.IsActive = true;

                _context.UniversityStatistics.Add(statistic);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetUniversityStatistic", new { id = statistic.Id }, new { success = true, data = statistic });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating university statistic");
                return StatusCode(500, new { success = false, message = "Error creating university statistic", error = ex.Message });
            }
        }

        // PUT: api/UniversityStatistics/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUniversityStatistic(int id, UniversityStatistic statistic)
        {
            try
            {
                if (id != statistic.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingStatistic = await _context.UniversityStatistics.FindAsync(id);
                if (existingStatistic == null)
                {
                    return NotFound(new { success = false, message = "University statistic not found" });
                }

                var currentUser = GetCurrentUser();

                existingStatistic.Count = statistic.Count;
                existingStatistic.Label = statistic.Label;
                existingStatistic.DisplayOrder = statistic.DisplayOrder;


                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingStatistic });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UniversityStatisticExists(id))
                {
                    return NotFound(new { success = false, message = "University statistic not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating university statistic");
                return StatusCode(500, new { success = false, message = "Error updating university statistic", error = ex.Message });
            }
        }

        // DELETE: api/UniversityStatistics/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUniversityStatistic(int id)
        {
            try
            {
                var statistic = await _context.UniversityStatistics.FindAsync(id);
                if (statistic == null)
                {
                    return NotFound(new { success = false, message = "University statistic not found" });
                }

                _context.UniversityStatistics.Remove(statistic);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "University statistic deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting university statistic");
                return StatusCode(500, new { success = false, message = "Error deleting university statistic", error = ex.Message });
            }
        }

        private bool UniversityStatisticExists(int id)
        {
            return _context.UniversityStatistics.Any(e => e.Id == id);
        }
    }
}