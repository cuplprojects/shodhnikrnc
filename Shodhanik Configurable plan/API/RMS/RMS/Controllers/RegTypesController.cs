using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NPOI.SS.Formula.Functions;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RegTypesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public RegTypesController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/RegTypes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RegType>>> GetRegTypes()
        {
            return await _context.RegTypes.ToListAsync();
        }

        [HttpGet("Distinct")]
        public async Task<ActionResult<IEnumerable<RegType>>> GetDistinctRegTypes()
        {
            var distinctRegTypes = await _context.RegTypes
                .GroupBy(rt => rt.RegTypeName)
                .Select(g => g.First())
                .ToListAsync();
            return distinctRegTypes;
        }

        [HttpGet("GetExemptCategories/{id}")]
        public async Task<ActionResult<IEnumerable<RegType>>> GetExemptCategories(int id)
        {
            var regtype = await _context.RegTypes.FindAsync(id);
            var exemptCategories = await _context.RegTypes
                .Where(rt => rt.RegTypeName == regtype.RegTypeName && rt.ExemptCategory != null)
                .ToListAsync();
            return exemptCategories;
        }

        // GET: api/RegTypes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<RegType>> GetRegType(int id)
        {
            var regType = await _context.RegTypes.FindAsync(id);

            if (regType == null)
            {
                return NotFound();
            }

            return regType;
        }

        // PUT: api/RegTypes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutRegType(int id, RegType regType)
        {
            if (id != regType.RegTypeID)
            {
                return BadRequest();
            }

            _context.Entry(regType).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RegTypeExists(id))
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

        // POST: api/RegTypes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<RegType>> PostRegType(RegType regType)
        {
            _context.RegTypes.Add(regType);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetRegType", new { id = regType.RegTypeID }, regType);
        }

        // DELETE: api/RegTypes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRegType(int id)
        {
            var regType = await _context.RegTypes.FindAsync(id);
            if (regType == null)
            {
                return NotFound();
            }

            _context.RegTypes.Remove(regType);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool RegTypeExists(int id)
        {
            return _context.RegTypes.Any(e => e.RegTypeID == id);
        }
    }
}
