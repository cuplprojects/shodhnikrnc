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
    public class FeeCategoryController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public FeeCategoryController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/FeeCategory
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeeCategory>>> GetFeeCategories()
        {
            return await _context.FeeCategories.ToListAsync();
        }

        // GET: api/FeeCategory/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FeeCategory>> GetFeeCategory(int id)
        {
            var feeCategory = await _context.FeeCategories.FindAsync(id);

            if (feeCategory == null)
            {
                return NotFound();
            }

            return feeCategory;
        }

        // PUT: api/FeeCategory/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFeeCategory(int id, FeeCategory feeCategory)
        {
            if (id != feeCategory.FCID)
            {
                return BadRequest();
            }

            _context.Entry(feeCategory).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FeeCategoryExists(id))
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

        // POST: api/FeeCategory
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<FeeCategory>> PostFeeCategory(FeeCategory feeCategory)
        {
            _context.FeeCategories.Add(feeCategory);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetFeeCategory", new { id = feeCategory.FCID }, feeCategory);
        }

        // DELETE: api/FeeCategory/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFeeCategory(int id)
        {
            var feeCategory = await _context.FeeCategories.FindAsync(id);
            if (feeCategory == null)
            {
                return NotFound();
            }

            _context.FeeCategories.Remove(feeCategory);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool FeeCategoryExists(int id)
        {
            return _context.FeeCategories.Any(e => e.FCID == id);
        }
    }
}
