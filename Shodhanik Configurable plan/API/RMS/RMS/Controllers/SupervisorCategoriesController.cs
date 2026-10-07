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
    public class SupervisorCategoriesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorCategoriesController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorCategories
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorCategories>>> GetSupervisorCategories()
        {
            return await _context.SupervisorCategories.ToListAsync();
        }

        // GET: api/SupervisorCategories/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorCategories>> GetSupervisorCategories(int id)
        {
            var supervisorCategories = await _context.SupervisorCategories.FindAsync(id);

            if (supervisorCategories == null)
            {
                return NotFound();
            }

            return supervisorCategories;
        }

        // PUT: api/SupervisorCategories/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorCategories(int id, SupervisorCategories supervisorCategories)
        {
            if (id != supervisorCategories.Id)
            {
                return BadRequest();
            }

            _context.Entry(supervisorCategories).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorCategoriesExists(id))
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

        [HttpGet("BySupervisor")]
        public async Task<ActionResult<SupervisorCategories>> GetSupervisorAllCategories(int supid, int id)
        {
            var supervisorCategories = await _context.SupervisorCategories.Where(a => a.SupId == supid && a.CategoryId==id).ToListAsync();

            if (supervisorCategories == null)
            {
                return NotFound();
            }

            return Ok(supervisorCategories);
        }

        public class SupervisorCategoryCountDto
        {
            public int CategoryId { get; set; }
            public string CategoryName { get; set; }
            public int Count { get; set; }
        }


        [HttpGet("ByCount")]
        public async Task<ActionResult<IEnumerable<SupervisorCategoryCountDto>>>
      GetSupervisorCategoryCounts(int supid)
        {
            // 1️⃣ Get counts per category for supervisor
            var supervisorCounts = await _context.SupervisorCategories
                .Where(sc => sc.SupId == supid)
                .GroupBy(sc => sc.CategoryId)
                .Select(g => new
                {
                    CategoryId = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            // 2️⃣ Get all categories
            var categories = await _context.Categories
                .Select(c => new { c.Id, c.Name })
                .ToListAsync();

            // 3️⃣ Combine in memory (NO EF expression tree)
            var result = categories
                .Select(c => new SupervisorCategoryCountDto
                {
                    CategoryId = c.Id,
                    CategoryName = c.Name,
                    Count = supervisorCounts
                        .Where(sc => sc.CategoryId == c.Id)
                        .Select(sc => sc.Count)
                        .FirstOrDefault()
                })
                .ToList();

            return Ok(result);
        }



        // POST: api/SupervisorCategories
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorCategories>> PostSupervisorCategories(SupervisorCategories supervisorCategories)
        {
            _context.SupervisorCategories.Add(supervisorCategories);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupervisorCategories", new { id = supervisorCategories.Id }, supervisorCategories);
        }

        // DELETE: api/SupervisorCategories/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorCategories(int id)
        {
            var supervisorCategories = await _context.SupervisorCategories.FindAsync(id);
            if (supervisorCategories == null)
            {
                return NotFound();
            }

            _context.SupervisorCategories.Remove(supervisorCategories);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorCategoriesExists(int id)
        {
            return _context.SupervisorCategories.Any(e => e.Id == id);
        }
    }
}
