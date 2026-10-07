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
    public class SupervisorResearchesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorResearchesController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorResearches
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorResearches>>> GetSupervisorResearch()
        {
            return await _context.SupervisorResearch.ToListAsync();
        }

        // GET: api/SupervisorResearches/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorResearches>> GetSupervisorResearches(int id)
        {
            var supervisorResearches = await _context.SupervisorResearch.FindAsync(id);

            if (supervisorResearches == null)
            {
                return NotFound();
            }

            return supervisorResearches;
        }

        [HttpGet("BySupervisor")]
        public async Task<ActionResult<SupervisorResearches>> GetSupervisorAllResearches(int supid)
        {
            var supervisorResearches = await _context.SupervisorResearch.Where(a => a.SupId == supid).ToListAsync();

            if (supervisorResearches == null)
            {
                return NotFound();
            }

            return Ok(supervisorResearches);
        }
        // PUT: api/SupervisorResearches/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorResearches(int id, SupervisorResearches supervisorResearches)
        {
            if (id != supervisorResearches.Id)
            {
                return BadRequest();
            }

            _context.Entry(supervisorResearches).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorResearchesExists(id))
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

        // POST: api/SupervisorResearches
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorResearches>> PostSupervisorResearches(SupervisorResearches supervisorResearches)
        {
            _context.SupervisorResearch.Add(supervisorResearches);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupervisorResearches", new { id = supervisorResearches.Id }, supervisorResearches);
        }

        // DELETE: api/SupervisorResearches/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorResearches(int id)
        {
            var supervisorResearches = await _context.SupervisorResearch.FindAsync(id);
            if (supervisorResearches == null)
            {
                return NotFound();
            }

            _context.SupervisorResearch.Remove(supervisorResearches);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorResearchesExists(int id)
        {
            return _context.SupervisorResearch.Any(e => e.Id == id);
        }
    }
}
