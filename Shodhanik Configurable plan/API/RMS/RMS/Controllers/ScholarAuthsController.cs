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
    public class ScholarAuthsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public ScholarAuthsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/ScholarAuths
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarAuth>>> GetScholarAuths()
        {
            return await _context.ScholarAuths.ToListAsync();
        }

        // GET: api/ScholarAuths/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarAuth>> GetScholarAuth(int id)
        {
            var scholarAuth = await _context.ScholarAuths.FindAsync(id);

            if (scholarAuth == null)
            {
                return NotFound();
            }

            return scholarAuth;
        }

        // PUT: api/ScholarAuths/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarAuth(int id, ScholarAuth scholarAuth)
        {
            if (id != scholarAuth.SAID)
            {
                return BadRequest();
            }

            _context.Entry(scholarAuth).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarAuthExists(id))
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

        // POST: api/ScholarAuths
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ScholarAuth>> PostScholarAuth(ScholarAuth scholarAuth)
        {
            _context.ScholarAuths.Add(scholarAuth);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetScholarAuth", new { id = scholarAuth.SAID }, scholarAuth);
        }

        // DELETE: api/ScholarAuths/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarAuth(int id)
        {
            var scholarAuth = await _context.ScholarAuths.FindAsync(id);
            if (scholarAuth == null)
            {
                return NotFound();
            }

            _context.ScholarAuths.Remove(scholarAuth);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ScholarAuthExists(int id)
        {
            return _context.ScholarAuths.Any(e => e.SAID == id);
        }
    }
}
