using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QueryComplaintController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public QueryComplaintController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/QueryComplaint
        [HttpGet]
        public async Task<ActionResult<IEnumerable<QueryComplaint>>> GetQueryComplaints()
        {
            var queryComplaints = await _context.QueryComplaints
                .OrderByDescending(q => q.SubmittedAt)
                .ToListAsync();

            return Ok(queryComplaints);
        }

        // GET: api/QueryComplaint/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<QueryComplaint>> GetQueryComplaint(int id)
        {
            var queryComplaint = await _context.QueryComplaints.FindAsync(id);

            if (queryComplaint == null)
            {
                return NotFound();
            }

            return Ok(queryComplaint);
        }

        // POST: api/QueryComplaint
        [HttpPost]
        public async Task<ActionResult<QueryComplaint>> CreateQueryComplaint([FromBody] QueryComplaint queryComplaint)
        {
            // Set current IST time (UTC + 5:30)
            var istTimeZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            queryComplaint.SubmittedAt = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTimeZone);
            queryComplaint.Status = "Pending";

            _context.QueryComplaints.Add(queryComplaint);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetQueryComplaint), new { id = queryComplaint.Id }, queryComplaint);
        }

        // PUT: api/QueryComplaint/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateQueryComplaint(int id, [FromBody] QueryComplaint queryComplaint)
        {
            if (id != queryComplaint.Id)
            {
                return BadRequest();
            }

            _context.Entry(queryComplaint).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!QueryComplaintExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        // DELETE: api/QueryComplaint/{id}
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteQueryComplaint(int id)
        {
            var queryComplaint = await _context.QueryComplaints.FindAsync(id);
            if (queryComplaint == null)
            {
                return NotFound();
            }

            _context.QueryComplaints.Remove(queryComplaint);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool QueryComplaintExists(int id)
        {
            return _context.QueryComplaints.Any(e => e.Id == id);
        }
    }
}