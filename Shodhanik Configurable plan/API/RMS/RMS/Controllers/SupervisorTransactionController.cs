using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorTransactionController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IWorkflowService _workflowService;

        public SupervisorTransactionController(RMSDbContext context, IWorkflowService workflowService)
        {
            _context = context;
            _workflowService = workflowService;
        }

        // GET: api/SupTrans
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorTransaction>>> GetSupTraxs()
        {
            return await _context.SupervisorTransactions.ToListAsync();
        }

        // GET: api/SupTrans/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorTransaction>> GetSupTrans(int id)
        {
            var supTrans = await _context.SupervisorTransactions.FindAsync(id);

            if (supTrans == null)
            {
                return NotFound();
            }

            return supTrans;
        }

        // PUT: api/SupTrans/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupTrans(int id, SupervisorTransaction supTrans)
        {
            if (id != supTrans.Id)
            {
                return BadRequest();
            }

            _context.Entry(supTrans).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupTransExists(id))
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

        // POST: api/SupTrans
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorTransaction>> PostSupTrans(SupervisorTransaction supTrans)
        {
            _context.SupervisorTransactions.Add(supTrans);
            await _context.SaveChangesAsync();

            var existingStatus = await _context.SupervisorApplicationStatuses
                              .FirstOrDefaultAsync(s => s.SupId == supTrans.SupId);

            if (existingStatus != null)
            {
                existingStatus.Step_6 = true;
                existingStatus.Step_6At = DateTime.UtcNow;
                _context.SupervisorApplicationStatuses.Update(existingStatus);
                await _context.SaveChangesAsync();
            }

            try
            {
                await _workflowService.StartWorkflowAsync("Supervisor Registration", supTrans.SupId, "Supervisor");
            }
            catch (Exception)
            {
                // Silently proceed if workflow was already initiated or unavailable
            }

            return CreatedAtAction("GetSupTrans", new { id = supTrans.Id }, supTrans);
        }

        // DELETE: api/SupTrans/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupTrans(int id)
        {
            var supTrans = await _context.SupervisorTransactions.FindAsync(id);
            if (supTrans == null)
            {
                return NotFound();
            }

            _context.SupervisorTransactions.Remove(supTrans);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupTransExists(int id)
        {
            return _context.SupervisorTransactions.Any(e => e.Id == id);
        }
    }
}
