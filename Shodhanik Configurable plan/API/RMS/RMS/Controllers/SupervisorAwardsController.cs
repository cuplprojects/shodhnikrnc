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
    public class SupervisorAwardsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorAwardsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorAwards
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorAward>>> GetSupervisorAwards()
        {
            return await _context.SupervisorAwards.ToListAsync();
        }

        // GET: api/SupervisorAwards/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorAward>> GetSupervisorAward(int id)
        {
            var supervisorAward = await _context.SupervisorAwards.FindAsync(id);

            if (supervisorAward == null)
            {
                return NotFound();
            }

            return supervisorAward;
        }

        [HttpGet("BySupervisor")]
        public async Task<ActionResult<SupervisorAward>> GetSupervisorAllAward(int supid)
        {
            var supervisorAward = await _context.SupervisorAwards.Where(a => a.SupId == supid).ToListAsync();

            if (supervisorAward == null)
            {
                return NotFound();
            }

            return Ok(supervisorAward);
        }

        // PUT: api/SupervisorAwards/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorAward(int id, SupervisorAward supervisorAward)
        {
            if (id != supervisorAward.Id)
            {
                return BadRequest();
            }

            _context.Entry(supervisorAward).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorAwardExists(id))
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

        // POST: api/SupervisorAwards
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorAward>> PostSupervisorAward(SupervisorAward supervisorAward)
        {
            _context.SupervisorAwards.Add(supervisorAward);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupervisorAward", new { id = supervisorAward.Id }, supervisorAward);
        }

        // DELETE: api/SupervisorAwards/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorAward(int id)
        {
            var supervisorAward = await _context.SupervisorAwards.FindAsync(id);
            if (supervisorAward == null)
            {
                return NotFound();
            }

            _context.SupervisorAwards.Remove(supervisorAward);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorAwardExists(int id)
        {
            return _context.SupervisorAwards.Any(e => e.Id == id);
        }
    }
}
