using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowManagementController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public WorkflowManagementController(RMSDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkflowDefinition>>> GetWorkflows()
        {
            return await _context.WorkflowDefinitions.Include(w => w.Steps).ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<WorkflowDefinition>> GetWorkflow(int id)
        {
            var workflow = await _context.WorkflowDefinitions
                .Include(w => w.Steps)
                .ThenInclude(s => s.RequiredRole)
                .FirstOrDefaultAsync(w => w.WorkflowID == id);

            if (workflow == null)
            {
                return NotFound();
            }

            return workflow;
        }

        [HttpPost]
        public async Task<ActionResult<WorkflowDefinition>> CreateWorkflow(WorkflowDefinition workflow)
        {
            _context.WorkflowDefinitions.Add(workflow);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetWorkflow), new { id = workflow.WorkflowID }, workflow);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWorkflow(int id, WorkflowDefinition workflow)
        {
            if (id != workflow.WorkflowID)
            {
                return BadRequest();
            }

            _context.Entry(workflow).State = EntityState.Modified;

            // Handle steps separately if needed, but for simplicity:
            foreach (var step in workflow.Steps)
            {
                if (step.StepID == 0)
                {
                    _context.WorkflowSteps.Add(step);
                }
                else
                {
                    _context.Entry(step).State = EntityState.Modified;
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!WorkflowExists(id))
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkflow(int id)
        {
            var workflow = await _context.WorkflowDefinitions.FindAsync(id);
            if (workflow == null)
            {
                return NotFound();
            }

            _context.WorkflowDefinitions.Remove(workflow);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool WorkflowExists(int id)
        {
            return _context.WorkflowDefinitions.Any(e => e.WorkflowID == id);
        }

        [HttpGet("roles")]
        public async Task<ActionResult<IEnumerable<Role>>> GetRoles()
        {
            return await _context.Roles.ToListAsync();
        }

        [HttpGet("workflow-steps/{workflowId}")]
        public async Task<ActionResult<IEnumerable<WorkflowStep>>> GetWorkflowSteps(int workflowId)
        {
            var steps = await _context.WorkflowSteps
                .Where(s => s.WorkflowID == workflowId)
                .Include(s => s.RequiredRole)
                .OrderBy(s => s.StepOrder)
                .ToListAsync();

            if (!steps.Any())
            {
                return NotFound($"No steps found for workflow {workflowId}");
            }

            return steps;
        }

        [HttpPost("log-action")]
        public async Task<ActionResult<WorkflowLog>> LogWorkflowAction([FromBody] WorkflowLogRequest request)
        {
            if (request == null)
            {
                Console.WriteLine("[WorkflowLog] ERROR: Request body is null");
                return BadRequest("Request body cannot be null");
            }

            Console.WriteLine($"[WorkflowLog] Received request: WorkflowID={request.WorkflowId}, EntityID={request.InstanceId}, StepOrder={request.StepOrder}, Action={request.Action}, UserID={request.ActionByUserID}");

            try
            {
                // Find the workflow instance by EntityID and WorkflowID, or by InstanceID
                var instance = await _context.WorkflowInstances
                    .Where(i => (i.InstanceID == request.InstanceId || i.EntityID == request.InstanceId) && i.WorkflowID == request.WorkflowId)
                    .OrderByDescending(i => i.InstanceID)
                    .FirstOrDefaultAsync();

                if (instance == null)
                {
                    Console.WriteLine($"[WorkflowLog] ERROR: Workflow instance not found for EntityID={request.InstanceId}, WorkflowID={request.WorkflowId}");
                    return BadRequest($"Workflow instance not found for EntityID {request.InstanceId} and WorkflowID {request.WorkflowId}");
                }

                Console.WriteLine($"[WorkflowLog] Found WorkflowInstance: InstanceID={instance.InstanceID}, CurrentStepOrder={instance.CurrentStepOrder}, Status={instance.Status}");

                // Find the workflow step
                var step = await _context.WorkflowSteps
                    .FirstOrDefaultAsync(s => s.WorkflowID == request.WorkflowId && s.StepOrder == request.StepOrder);

                if (step == null)
                {
                    Console.WriteLine($"[WorkflowLog] ERROR: Workflow step not found for WorkflowID={request.WorkflowId}, StepOrder={request.StepOrder}");
                    return BadRequest($"Workflow step not found for WorkflowID {request.WorkflowId} and StepOrder {request.StepOrder}");
                }

                Console.WriteLine($"[WorkflowLog] Found WorkflowStep: StepID={step.StepID}, StepName={step.StepName}");

                // Get the user ID from request or use default
                int actionByUserID = 1;
                if (!string.IsNullOrEmpty(request.ActionByUserID))
                {
                    if (int.TryParse(request.ActionByUserID, out int userId))
                    {
                        actionByUserID = userId;
                    }
                }

                Console.WriteLine($"[WorkflowLog] Using ActionByUserID={actionByUserID}");

                // Parse scheduled meeting date if provided
                DateTime? scheduledMeetingDate = null;
                if (!string.IsNullOrEmpty(request.ScheduledMeetingDate))
                {
                    if (DateTime.TryParse(request.ScheduledMeetingDate, out DateTime parsedDate))
                    {
                        scheduledMeetingDate = parsedDate;
                        Console.WriteLine($"[WorkflowLog] Scheduled meeting date: {scheduledMeetingDate}");
                    }
                }

                // Create workflow log entry
                var workflowLog = new WorkflowLog
                {
                    InstanceID = instance.InstanceID,
                    StepID = step.StepID,
                    ActionByUserID = actionByUserID,
                    Action = request.Action,
                    Comments = request.Remarks,
                    ActionTimestamp = DateTime.UtcNow,
                    ScheduledMeetingDate = scheduledMeetingDate
                };

                _context.WorkflowLogs.Add(workflowLog);
                Console.WriteLine($"[WorkflowLog] Created WorkflowLog entry: InstanceID={workflowLog.InstanceID}, StepID={workflowLog.StepID}, Action={workflowLog.Action}");

                // Update workflow instance based on action
                if (request.Action == "Accept")
                {
                    // Move to next step
                    instance.CurrentStepOrder += 1;
                    instance.CurrentStepRejectionCount = 0; // Reset rejection count for new step
                    
                    Console.WriteLine($"[WorkflowLog] Action=Accept: Moving to next step. New CurrentStepOrder={instance.CurrentStepOrder}");
                    
                    // Check if the step just completed was the final step or if no further step exists
                    var stepJustCompleted = await _context.WorkflowSteps
                        .FirstOrDefaultAsync(s => s.WorkflowID == request.WorkflowId && s.StepOrder == request.StepOrder);

                    var nextStep = await _context.WorkflowSteps
                        .FirstOrDefaultAsync(s => s.WorkflowID == request.WorkflowId && s.StepOrder == instance.CurrentStepOrder);
                    
                    if ((stepJustCompleted != null && stepJustCompleted.IsFinalStep) || nextStep == null)
                    {
                        instance.Status = "Approved";
                        instance.CompletedAt = DateTime.UtcNow;
                        Console.WriteLine($"[WorkflowLog] Workflow completed. Status=Approved");
                    }

                    // If WorkflowID == 6 (Synopsis), sync meeting date and remarks to SynopsisRDC
                    if (request.WorkflowId == 6)
                    {
                        var synRecord = await _context.SynopsisRDCs
                            .Where(s => s.SID == instance.EntityID || s.SYNID == instance.EntityID)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();

                        if (synRecord != null)
                        {
                            if (scheduledMeetingDate.HasValue)
                            {
                                synRecord.RDCDate = scheduledMeetingDate.Value;
                            }
                            if (!string.IsNullOrEmpty(request.Remarks))
                            {
                                synRecord.RDCRemark = request.Remarks;
                            }
                            if (synRecord.AttemptNumber == 1)
                            {
                                synRecord.Synopsis1Decision = Models.Enums.SynopsisDecisions.SynopsisApproved;
                                synRecord.Syn1RDC1ProceedingStatus = Models.Enums.RDCProceedingDecisions.RDCProceedingApproved;
                            }
                            else if (synRecord.AttemptNumber == 2)
                            {
                                synRecord.Synopsis2Decision = Models.Enums.SynopsisDecisions.SynopsisApproved;
                                synRecord.Syn2RDC1ProceedingStatus = Models.Enums.RDCProceedingDecisions.RDCProceedingApproved;
                            }
                        }
                    }
                }
                else if (request.Action == "Reject")
                {
                    instance.RejectionCount += 1;
                    instance.CurrentStepRejectionCount += 1;

                    Console.WriteLine($"[WorkflowLog] Action=Reject: RejectionCount={instance.RejectionCount}, CurrentStepRejectionCount={instance.CurrentStepRejectionCount}");

                    // Lock if rejected twice at same step
                    if (instance.CurrentStepRejectionCount >= 2)
                    {
                        instance.IsLocked = true;
                        instance.Status = "Rejected";
                        instance.CompletedAt = DateTime.UtcNow;
                        Console.WriteLine($"[WorkflowLog] Workflow locked after 2 rejections. Status=Rejected, IsLocked=true");

                        if (request.WorkflowId == 6)
                        {
                            var synRecord = await _context.SynopsisRDCs
                                .Where(s => s.SID == instance.EntityID || s.SYNID == instance.EntityID)
                                .OrderByDescending(s => s.AttemptNumber)
                                .FirstOrDefaultAsync();

                            if (synRecord != null)
                            {
                                if (synRecord.AttemptNumber == 1) synRecord.Synopsis1Decision = Models.Enums.SynopsisDecisions.SynopsisRejected;
                                else if (synRecord.AttemptNumber == 2) synRecord.Synopsis2Decision = Models.Enums.SynopsisDecisions.SynopsisRejected;
                                if (!string.IsNullOrEmpty(request.Remarks)) synRecord.RDCRemark = request.Remarks;
                            }
                        }
                    }
                }
                else if (request.Action == "RequestRevision")
                {
                    instance.Status = "Pending";
                    Console.WriteLine($"[WorkflowLog] Action=RequestRevision: Status=Pending");

                    if (request.WorkflowId == 6)
                    {
                        var synRecord = await _context.SynopsisRDCs
                            .Where(s => s.SID == instance.EntityID || s.SYNID == instance.EntityID)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();

                        if (synRecord != null)
                        {
                            if (synRecord.AttemptNumber == 1) synRecord.Synopsis1Decision = Models.Enums.SynopsisDecisions.SynopsisNeedsRevision;
                            else if (synRecord.AttemptNumber == 2) synRecord.Synopsis2Decision = Models.Enums.SynopsisDecisions.SynopsisNeedsRevision;
                            if (!string.IsNullOrEmpty(request.Remarks)) synRecord.RDCRemark = request.Remarks;
                        }
                    }
                }

                _context.WorkflowInstances.Update(instance);
                
                var saveResult = await _context.SaveChangesAsync();
                Console.WriteLine($"[WorkflowLog] SaveChanges completed. Rows affected: {saveResult}");

                return CreatedAtAction(nameof(GetWorkflowSteps), new { workflowId = request.WorkflowId }, workflowLog);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WorkflowLog] EXCEPTION: {ex.Message}");
                Console.WriteLine($"[WorkflowLog] Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"[WorkflowLog] Inner exception: {ex.InnerException.Message}");
                }
                return StatusCode(500, $"Error logging workflow action: {ex.Message}");
            }
        }
    }

    // Request model for logging workflow actions
    public class WorkflowLogRequest
    {
        public int WorkflowId { get; set; }
        public int InstanceId { get; set; } // EntityID (e.g., ScholarID)
        public int StepOrder { get; set; }
        public string Action { get; set; } // Accept, Reject, RequestRevision
        public string? Remarks { get; set; }
        public string? ActionByUserID { get; set; } // User ID of the person performing the action
        public string? ScheduledMeetingDate { get; set; } // For RDC meeting scheduling
    }
}
