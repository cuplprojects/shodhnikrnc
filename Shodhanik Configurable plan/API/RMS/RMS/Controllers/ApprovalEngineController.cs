using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Services;
using RMS.Models;
using RMS.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ApprovalEngineController : ControllerBase
    {
        private readonly IWorkflowService _workflowService;
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public ApprovalEngineController(IWorkflowService workflowService, RMSDbContext context, IFileStorageService fileStorage)
        {
            _workflowService = workflowService;
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet("pending/{roleId}")]
        public async Task<ActionResult<IEnumerable<WorkflowInstance>>> GetPendingApprovals(int roleId)
        {
            var pending = await _workflowService.GetPendingApprovalsAsync(roleId);
            return Ok(pending);
        }

        [HttpGet("debug/workflow-check/{name}")]
        public async Task<IActionResult> CheckWorkflowStatus(string name)
        {
            var workflow = await _context.WorkflowDefinitions
                .Include(w => w.Steps)
                .FirstOrDefaultAsync(w => w.Name.ToLower() == name.ToLower());

            if (workflow == null) return NotFound(new { message = "Workflow not found by name" });

            return Ok(new {
                workflow.WorkflowID,
                workflow.Name,
                workflow.IsActive,
                StepCount = workflow.Steps?.Count ?? 0,
                Steps = workflow.Steps?.Select(s => new { s.StepOrder, s.StepName, s.RequiredRoleID })
            });
        }

        [HttpGet("history/{entityType}/{entityId}")]
        public async Task<IActionResult> GetEntityHistory(string entityType, int entityId)
        {
            var candidateIds = new List<int> { entityId };
            if (entityType == "SynopsisRDC")
            {
                var syns = await _context.SynopsisRDCs
                    .Where(s => s.SID == entityId || s.SYNID == entityId)
                    .Select(s => new { s.SYNID, s.SID })
                    .ToListAsync();

                foreach (var s in syns)
                {
                    if (!candidateIds.Contains(s.SYNID)) candidateIds.Add(s.SYNID);
                    if (!candidateIds.Contains(s.SID)) candidateIds.Add(s.SID);
                }
            }

            // Get the workflow instance to include rejection counts
            var instance = await _context.WorkflowInstances
                .Where(i => i.EntityType == entityType && candidateIds.Contains(i.EntityID))
                .OrderByDescending(i => i.StartedAt)
                .FirstOrDefaultAsync();

            var logs = await _context.WorkflowLogs
                .Include(l => l.Step)
                .Include(l => l.Instance)
                .ThenInclude(i => i.Workflow)
                .Where(l => l.Instance.EntityType == entityType && candidateIds.Contains(l.Instance.EntityID))
                .OrderBy(l => l.ActionTimestamp)
                .Select(l => new {
                    l.LogID,
                    l.Action,
                    l.Comments,
                    l.FilePath,
                    l.ActionTimestamp,
                    l.StepID,
                    StepName = l.Step.StepName,
                    StepOrder = l.Step.StepOrder,
                    ActionByUserID = l.ActionByUserID,
                    WorkflowName = l.Instance.Workflow.Name
                })
                .ToListAsync();

            return Ok(new {
                logs = logs,
                instance = instance != null ? new {
                    instance.InstanceID,
                    instance.Status,
                    instance.CurrentStepOrder,
                    instance.RejectionCount,
                    instance.CurrentStepRejectionCount,
                    instance.IsLocked
                } : null
            });
        }

        [HttpPost("history-bulk")]
        public async Task<IActionResult> GetBulkHistory([FromBody] BulkHistoryRequest request)
        {
            var candidateIds = new List<int>(request.EntityIds);
            if (request.EntityType == "SynopsisRDC")
            {
                var syns = await _context.SynopsisRDCs
                    .Where(s => request.EntityIds.Contains(s.SID) || request.EntityIds.Contains(s.SYNID))
                    .Select(s => new { s.SYNID, s.SID })
                    .ToListAsync();

                foreach (var s in syns)
                {
                    if (!candidateIds.Contains(s.SYNID)) candidateIds.Add(s.SYNID);
                    if (!candidateIds.Contains(s.SID)) candidateIds.Add(s.SID);
                }
            }

            var logs = await _context.WorkflowLogs
                .Include(l => l.Step)
                .Include(l => l.Instance)
                .ThenInclude(i => i.Workflow)
                .Where(l => l.Instance.EntityType == request.EntityType && candidateIds.Contains(l.Instance.EntityID))
                .OrderBy(l => l.ActionTimestamp)
                .Select(l => new {
                    l.Instance.EntityID,
                    l.Action,
                    l.Comments,
                    l.FilePath,
                    l.ActionTimestamp,
                    l.StepID,
                    StepName = l.Step.StepName,
                    StepOrder = l.Step.StepOrder,
                    ActionByUserID = l.ActionByUserID
                })
                .ToListAsync();

            var grouped = logs.GroupBy(l => l.EntityID)
                .ToDictionary(g => g.Key, g => g.ToList());

            return Ok(grouped);
        }

        [HttpGet("supervisor-list")]
        public async Task<IActionResult> GetSupervisorWorkflowList(
            [FromQuery] int? workflowId,
            [FromQuery] int? currentStepOrder,
            [FromQuery] int? minStepOrder,
            [FromQuery] int? maxStepOrder,
            [FromQuery] string? status, // Pending, Approved, Rejected
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string search = "",
            [FromQuery] string? sortField = null,
            [FromQuery] string? sortOrder = null)
        {
            var query = (
                from reg in _context.SupervisorRegistrations
                join p in _context.SupervisorPersonal on reg.SupId equals p.SupId into personalGroup
                from personal in personalGroup.DefaultIfEmpty()
                join e in _context.SupervisorEducations on reg.SupId equals e.SupId into eduGroup
                from edu in eduGroup.DefaultIfEmpty()
                join d in _context.Designations on personal.Designation equals d.DesignationID into desigGroup
                from desig in desigGroup.DefaultIfEmpty()
                join s in _context.Departments on personal.PrimarySuperviseSubject equals s.DepartmentID into subGroup
                from sub in subGroup.DefaultIfEmpty()
                join t in _context.SupervisorTransactions on reg.SupId equals t.SupId into transGroup
                from trans in transGroup.DefaultIfEmpty()
                join inst in _context.WorkflowInstances on new { ID = reg.SupId, Type = "Supervisor" } equals new { ID = inst.EntityID, Type = inst.EntityType } into instances
                from instance in instances.DefaultIfEmpty()
                select new
                {
                    SupId = reg.SupId,
                    Name = reg.Title + " " + reg.FullName,
                    ApplicationNumber = reg.ApplicationNumber,
                    MobileNo = reg.MobileNo,
                    Designation = desig != null ? desig.DesignationName : "--",
                    DeptEst = edu != null ? edu.DeptEst : "--",
                    Subject = sub != null ? sub.Subject : "--",
                    // Workflow Info
                    WorkflowID = (int?)instance.WorkflowID ?? 5, // Default to 5 for Supervisor Registration context
                    CurrentStepOrder = (int?)instance.CurrentStepOrder ?? 0,
                    WorkflowStatus = instance.Status ?? "Uninitiated",
                    InstanceID = (int?)instance.InstanceID ?? 0,
                    RejectionCount = (int?)instance.RejectionCount ?? 0,
                    CurrentStepRejectionCount = (int?)instance.CurrentStepRejectionCount ?? 0,
                    IsLocked = (bool?)instance.IsLocked ?? false,
                    StartedAt = (DateTime?)(instance != null ? instance.StartedAt : (trans != null ? trans.TxnDate : DateTime.MinValue)) ?? DateTime.MinValue
                }
            );

            // Apply Filters
            if (workflowId.HasValue)
                query = query.Where(x => x.WorkflowID == workflowId.Value);
            
            if (currentStepOrder.HasValue)
                query = query.Where(x => x.CurrentStepOrder == currentStepOrder.Value);

            if (minStepOrder.HasValue)
                query = query.Where(x => x.CurrentStepOrder >= minStepOrder.Value || x.WorkflowStatus == "Approved");

            if (maxStepOrder.HasValue)
                query = query.Where(x => x.CurrentStepOrder <= maxStepOrder.Value);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(x => x.WorkflowStatus == status);

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(x =>
                    x.ApplicationNumber.ToLower().Contains(searchLower) ||
                    x.Name.ToLower().Contains(searchLower) ||
                    x.Designation.ToLower().Contains(searchLower) ||
                    x.Subject.ToLower().Contains(searchLower)
                );
            }

            var totalCount = await query.CountAsync();

            // Sorting
            if (!string.IsNullOrEmpty(sortField))
            {
                bool isAsc = sortOrder?.ToLower() == "ascend" || sortOrder?.ToLower() == "asc";
                switch (sortField.ToLower())
                {
                    case "applicationno":
                    case "applicationnumber":
                        query = isAsc ? query.OrderBy(x => x.ApplicationNumber) : query.OrderByDescending(x => x.ApplicationNumber);
                        break;
                    case "name":
                        query = isAsc ? query.OrderBy(x => x.Name) : query.OrderByDescending(x => x.Name);
                        break;
                    case "designation":
                        query = isAsc ? query.OrderBy(x => x.Designation) : query.OrderByDescending(x => x.Designation);
                        break;
                    default:
                        query = isAsc ? query.OrderBy(x => x.StartedAt) : query.OrderByDescending(x => x.StartedAt);
                        break;
                }
            }
            else
            {
                query = query.OrderByDescending(x => x.StartedAt);
            }

            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                data = data,
                total = totalCount,
                page = page,
                pageSize = pageSize
            });
        }

        [HttpGet("supervisor-stats")]
        public async Task<IActionResult> GetSupervisorWorkflowStats(
            [FromQuery] int workflowId = 5,
            [FromQuery] int? stepOrder = null)
        {
            var query = (
                from reg in _context.SupervisorRegistrations
                join inst in _context.WorkflowInstances on new { ID = reg.SupId, Type = "Supervisor" } equals new { ID = inst.EntityID, Type = inst.EntityType } into instances
                from instance in instances.DefaultIfEmpty()
                select new
                {
                    SupId = reg.SupId,
                    WorkflowID = (int?)instance.WorkflowID ?? 5,
                    CurrentStepOrder = (int?)instance.CurrentStepOrder ?? 0,
                    WorkflowStatus = instance.Status ?? "Uninitiated",
                }
            ).Where(x => x.WorkflowID == workflowId);

            int total;
            int pending;
            int approved;
            int rejected;

            if (stepOrder.HasValue)
            {
                var maxStep = await _context.WorkflowSteps
                    .Where(s => s.WorkflowID == workflowId)
                    .MaxAsync(s => (int?)s.StepOrder) ?? 6;

                if (stepOrder.Value >= maxStep)
                {
                    // Final step (e.g. VC Office, step 6)
                    pending = await query.CountAsync(x => x.CurrentStepOrder == stepOrder.Value && x.WorkflowStatus == "Pending");
                    approved = await query.CountAsync(x => x.WorkflowStatus == "Approved");
                    rejected = await query.CountAsync(x => x.CurrentStepOrder == stepOrder.Value && x.WorkflowStatus == "Rejected");
                    total = pending + approved + rejected;
                }
                else
                {
                    // Intermediate steps (e.g. DOR, Dean, Registrar, Deputy Registrar, Supervisor Cell)
                    if (stepOrder.Value <= 1)
                    {
                        pending = await query.CountAsync(x => (x.CurrentStepOrder <= 1) && (x.WorkflowStatus == "Pending" || x.WorkflowStatus == "Uninitiated"));
                        approved = await query.CountAsync(x => (x.CurrentStepOrder > 1 && x.WorkflowStatus != "Rejected") || x.WorkflowStatus == "Approved");
                        rejected = await query.CountAsync(x => x.CurrentStepOrder <= 1 && x.WorkflowStatus == "Rejected");
                    }
                    else
                    {
                        pending = await query.CountAsync(x => x.CurrentStepOrder == stepOrder.Value && x.WorkflowStatus == "Pending");
                        approved = await query.CountAsync(x => (x.CurrentStepOrder > stepOrder.Value && x.WorkflowStatus != "Rejected") || x.WorkflowStatus == "Approved");
                        rejected = await query.CountAsync(x => x.CurrentStepOrder == stepOrder.Value && x.WorkflowStatus == "Rejected");
                    }
                    total = pending + approved + rejected;
                }
            }
            else
            {
                pending = await query.CountAsync(x => x.WorkflowStatus == "Pending");
                approved = await query.CountAsync(x => x.WorkflowStatus == "Approved");
                rejected = await query.CountAsync(x => x.WorkflowStatus == "Rejected");
                total = await query.CountAsync();
            }

            return Ok(new
            {
                total,
                pending,
                approved,
                rejected
            });
        }

        [HttpPost("action")]
        public async Task<IActionResult> SubmitAction([FromBody] ApprovalActionRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                int userId = userIdClaim != null ? int.Parse(userIdClaim.Value) : 0;

                if (userId == 0 && request.UserId > 0) userId = request.UserId;

                WorkflowInstance result;
                if (request.InstanceId > 0)
                {
                    result = await _workflowService.ProcessActionAsync(
                        request.InstanceId, 
                        userId, 
                        request.Action, 
                        request.Comments
                    );
                }
                else if (request.EntityID.HasValue && !string.IsNullOrEmpty(request.EntityType))
                {
                    result = await _workflowService.ProcessActionByEntityAsync(
                        request.EntityID.Value,
                        request.EntityType,
                        userId,
                        request.Action,
                        request.Comments,
                        request.WorkflowName
                    );
                }
                else
                {
                    return BadRequest(new { message = "Either InstanceId or EntityID/EntityType must be provided." });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("action-with-file")]
        public async Task<IActionResult> SubmitActionWithFile([FromForm] ApprovalActionWithFileRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                int userId = userIdClaim != null ? int.Parse(userIdClaim.Value) : 0;

                if (userId == 0 && request.UserId > 0) userId = request.UserId;

                string? filePath = null;
                if (request.File != null)
                {
                    filePath = await _fileStorage.SaveAsync(request.File, "WorkflowFiles","Approval");
                }

                WorkflowInstance result;
                if (request.InstanceId > 0)
                {
                    result = await _workflowService.ProcessActionAsync(
                        request.InstanceId, 
                        userId, 
                        request.Action, 
                        request.Comments,
                        filePath
                    );
                }
                else if (request.EntityID.HasValue && !string.IsNullOrEmpty(request.EntityType))
                {
                    result = await _workflowService.ProcessActionByEntityAsync(
                        request.EntityID.Value,
                        request.EntityType,
                        userId,
                        request.Action,
                        request.Comments,
                        request.WorkflowName,
                        filePath
                    );
                }
                else
                {
                    return BadRequest(new { message = "Either InstanceId or EntityID/EntityType must be provided." });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }

    public class ApprovalActionRequest
    {
        public int InstanceId { get; set; }
        public int? EntityID { get; set; }
        public string? EntityType { get; set; }
        public string? WorkflowName { get; set; }
        public string Action { get; set; } // Approve, Reject
        public string? Comments { get; set; }
        public int UserId { get; set; } 
    }

    public class ApprovalActionWithFileRequest : ApprovalActionRequest
    {
        public IFormFile? File { get; set; }
    }

    public class BulkHistoryRequest
    {
        public string EntityType { get; set; }
        public List<int> EntityIds { get; set; }
    }
}
