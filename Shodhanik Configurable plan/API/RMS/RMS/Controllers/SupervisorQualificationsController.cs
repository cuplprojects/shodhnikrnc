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
    public class SupervisorQualificationsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorQualificationsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorQualifications
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorQualifications>>> GetSupervisorQualifications()
        {
            return await _context.SupervisorQualifications.ToListAsync();
        }

        // GET: api/SupervisorQualifications/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorQualifications>> GetSupervisorQualifications(int id)
        {
            var supervisorQualifications = await _context.SupervisorQualifications.FindAsync(id);

            if (supervisorQualifications == null)
            {
                return NotFound();
            }

            return supervisorQualifications;
        }

        [HttpGet("BySupervisor")]
        public async Task<ActionResult> GetSupervisorAllQualifications(int supid)
        {
            var supervisorQualifications = await _context.SupervisorQualifications
                .AsNoTracking()
                .Where(a => a.SupId == supid)
                .ToListAsync();

            var edu = await _context.SupervisorEducations
                .AsNoTracking()
                .Where(a => a.SupId == supid)
                .ToListAsync();

            // ✅ Proper empty check
            if (!supervisorQualifications.Any() && !edu.Any())
            {
                return NotFound("No qualification or education data found for this supervisor.");
            }

            return Ok(new
            {
                SupervisorQualifications = supervisorQualifications,
                Education = edu
            });
        }


        // PUT: api/SupervisorQualifications/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorQualifications(int id, SupervisorQualifications supervisorQualifications)
        {
            if (id != supervisorQualifications.Id)
            {
                return BadRequest();
            }

            _context.Entry(supervisorQualifications).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorQualificationsExists(id))
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

        // POST: api/SupervisorQualifications
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorQualifications>> PostSupervisorQualifications(SupervisorQualifications supervisorQualifications)
        {
            _context.SupervisorQualifications.Add(supervisorQualifications);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupervisorQualifications", new { id = supervisorQualifications.Id }, supervisorQualifications);
        }

        // DELETE: api/SupervisorQualifications/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorQualifications(int id)
        {
            var supervisorQualifications = await _context.SupervisorQualifications.FirstOrDefaultAsync(a=>a.Id==id);
            if (supervisorQualifications == null)
            {
                return NotFound();
            }

            _context.SupervisorQualifications.Remove(supervisorQualifications);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorQualificationsExists(int id)
        {
            return _context.SupervisorQualifications.Any(e => e.Id == id);
        }
    }
}
