using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowActionController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public WorkflowActionController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/WorkflowAction
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkflowAction>>> GetWorkflowActions()
        {
            return await _context.WorkflowActions.ToListAsync();
        }

        // GET: api/WorkflowAction/5
        [HttpGet("{id}")]
        public async Task<ActionResult<WorkflowAction>> GetWorkflowAction(int id)
        {
            var workflowAction = await _context.WorkflowActions.FindAsync(id);

            if (workflowAction == null)
            {
                return NotFound();
            }

            return workflowAction;
        }

        // POST: api/WorkflowAction
        [HttpPost]
        public async Task<ActionResult<WorkflowAction>> PostWorkflowAction(WorkflowAction workflowAction)
        {
            _context.WorkflowActions.Add(workflowAction);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetWorkflowAction), new { id = workflowAction.ActionID }, workflowAction);
        }

        // PUT: api/WorkflowAction/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutWorkflowAction(int id, WorkflowAction workflowAction)
        {
            if (id != workflowAction.ActionID)
            {
                return BadRequest();
            }

            _context.Entry(workflowAction).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!WorkflowActionExists(id))
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

        // DELETE: api/WorkflowAction/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkflowAction(int id)
        {
            var workflowAction = await _context.WorkflowActions.FindAsync(id);
            if (workflowAction == null)
            {
                return NotFound();
            }

            _context.WorkflowActions.Remove(workflowAction);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool WorkflowActionExists(int id)
        {
            return _context.WorkflowActions.Any(e => e.ActionID == id);
        }
    }
}
