using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarApplicationStatusController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public ScholarApplicationStatusController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupAppStatus
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarApplicationStatus>>> GetSupAppStatus()
        {
            return await _context.ScholarApplicationStatuses.ToListAsync();
        }

        // GET: api/SupAppStatus/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarApplicationStatus>> GetSupAppStatus(int id)
        {
            var supAppStatus = await _context.ScholarApplicationStatuses.FirstOrDefaultAsync(s=>s.SID == id);

            if (supAppStatus == null)
            {
                return NotFound();
            }

            return supAppStatus;
        }

        // PUT: api/SupAppStatus/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupAppStatus(int id, ScholarApplicationStatus supAppStatus)
        {
            if (id != supAppStatus.SASID)
            {
                return BadRequest();
            }

            _context.Entry(supAppStatus).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupAppStatusExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/SupAppStatus
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ScholarApplicationStatus>> PostSupAppStatus(ScholarApplicationStatus supAppStatus)
        {
            var exisiting = await _context.ScholarApplicationStatuses.FirstOrDefaultAsync(s => s.SID == supAppStatus.SID);
            if (exisiting != null)
            {
                return BadRequest("Application Status Already Exist");
            }
            _context.ScholarApplicationStatuses.Add(supAppStatus);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupAppStatus", new { id = supAppStatus.SASID }, supAppStatus);
        }

        // DELETE: api/SupAppStatus/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupAppStatus(int id)
        {
            var supAppStatus = await _context.ScholarApplicationStatuses.FindAsync(id);
            if (supAppStatus == null)
            {
                return NotFound();
            }

            _context.ScholarApplicationStatuses.Remove(supAppStatus);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupAppStatusExists(int id)
        {
            return _context.ScholarApplicationStatuses.Any(e => e.SASID == id);
        }
    }
}
