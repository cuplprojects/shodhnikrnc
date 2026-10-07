using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System.Globalization;
using RMS.Models.Enums;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SynopsisRDCController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;
        private readonly IWorkflowService _workflowService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;

        public SynopsisRDCController(
            RMSDbContext context,
            IFileStorageService fileStorage,
            IWorkflowService workflowService,
            IEmailService emailService,
            IEmailTemplateService emailTemplateService)
        {
            _context = context;
            _fileStorage = fileStorage;
            _workflowService = workflowService;
            _emailService = emailService;
            _emailTemplateService = emailTemplateService;
        }

        // New workflow-based endpoints
        [HttpGet("GetDistinctSubjectsForRDC")]
        public async Task<IActionResult> GetDistinctSubjectsForRDC()
        {
            try
            {
                // Get all scholars in Synopsis workflow (WorkflowID = 6) at RDC step (StepOrder = 2)
                var subjects = await (
                    from inst in _context.WorkflowInstances
                    join scholar in _context.Scholars on inst.EntityID equals scholar.SID
                    join dept in _context.Departments on scholar.Subject_ID equals dept.DepartmentID
                    where inst.EntityType == "SynopsisRDC" 
                        && inst.WorkflowID == 6 
                        && inst.CurrentStepOrder == 2
                        && inst.Status == "Pending"
                        && !inst.IsLocked
                    select new
                    {
                        DepartmentID = dept.DepartmentID,
                        SubjectName = dept.Subject
                    }
                ).Distinct().ToListAsync();

                return Ok(subjects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error fetching subjects: {ex.Message}");
            }
        }

        [HttpGet("GetScholarsForRDCBySubject/{departmentId}")]
        public async Task<IActionResult> GetScholarsForRDCBySubject(int departmentId)
        {
            try
            {
                // First, get the RDC step ID for WorkflowID 6, StepOrder 2
                var rdcStep = await _context.WorkflowSteps
                    .FirstOrDefaultAsync(s => s.WorkflowID == 6 && s.StepOrder == 2);

                if (rdcStep == null)
                {
                    return NotFound("RDC step not found in workflow");
                }

                // Get scholars with their workflow instances
                var scholarData = await (
                    from inst in _context.WorkflowInstances
                    join scholar in _context.Scholars on inst.EntityID equals scholar.SID
                    join synopsis in _context.SynopsisRDCs on scholar.SID equals synopsis.SID
                    join dept in _context.Departments on scholar.Subject_ID equals dept.DepartmentID
                    where inst.EntityType == "SynopsisRDC"
                        && inst.WorkflowID == 6
                        && inst.CurrentStepOrder == 2
                        && inst.Status == "Pending"
                        && !inst.IsLocked
                        && dept.DepartmentID == departmentId
                    select new
                    {
                        SID = scholar.SID,
                        Name = scholar.Name,
                        ApplicationNo = scholar.ApplicationNo,
                        InstanceID = inst.InstanceID,
                        SynopsisTitle = synopsis.Title,
                        SynopsisFilePath = synopsis.FilePath
                    }
                ).ToListAsync();

                // Get supervisor information separately
                var scholarIds = scholarData.Select(s => s.SID).ToList();
                var supervisorData = await (
                    from sup in _context.ScholarSupervisors
                    join supReg in _context.SupervisorRegistrations on sup.SUPID1 equals supReg.SupId
                    where scholarIds.Contains(sup.SID)
                    select new
                    {
                        ScholarID = sup.SID,
                        SupervisorName = supReg.FullName,
                        SupervisorEmail = supReg.Email,
                        SupervisorMobile = supReg.MobileNo
                    }
                ).ToListAsync();

                // Get RDC dates from workflow logs
                var instanceIds = scholarData.Select(s => s.InstanceID).ToList();
                var rdcDates = await _context.WorkflowLogs
                    .Where(l => instanceIds.Contains(l.InstanceID) && l.StepID == rdcStep.StepID)
                    .GroupBy(l => l.InstanceID)
                    .Select(g => new
                    {
                        InstanceID = g.Key,
                        RDCDate = g.OrderByDescending(l => l.ActionTimestamp).FirstOrDefault().ScheduledMeetingDate
                    })
                    .ToListAsync();

                // Combine all data
                var result = scholarData.Select(s =>
                {
                    var supervisor = supervisorData.FirstOrDefault(sup => sup.ScholarID == s.SID);
                    var rdcDate = rdcDates.FirstOrDefault(d => d.InstanceID == s.InstanceID);

                    return new
                    {
                        s.SID,
                        s.Name,
                        s.ApplicationNo,
                        SupervisorName = supervisor?.SupervisorName ?? "N/A",
                        SupervisorEmail = supervisor?.SupervisorEmail ?? "N/A",
                        SupervisorMobile = supervisor?.SupervisorMobile ?? "N/A",
                        RDCDate = rdcDate?.RDCDate,
                        s.InstanceID,
                        s.SynopsisTitle,
                        s.SynopsisFilePath
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error fetching scholars: {ex.Message}");
            }
        }

        [HttpGet("GetDistinctSubjectsByWorkflowStep/{workflowId}/{stepOrder}")]
        public async Task<IActionResult> GetDistinctSubjectsByWorkflowStep(int workflowId, int stepOrder)
        {
            try
            {
                var subjects = await (
                    from inst in _context.WorkflowInstances
                    join scholar in _context.Scholars on inst.EntityID equals scholar.SID
                    join dept in _context.Departments on scholar.Subject_ID equals dept.DepartmentID
                    where inst.EntityType == "SynopsisRDC"
                        && inst.WorkflowID == workflowId
                        && inst.CurrentStepOrder == stepOrder
                        && inst.Status == "Pending"
                        && !inst.IsLocked
                    select new
                    {
                        DepartmentID = dept.DepartmentID,
                        SubjectName = dept.Subject
                    }
                ).Distinct().ToListAsync();

                return Ok(subjects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error fetching subjects: {ex.Message}");
            }
        }

        [HttpGet("GetScholarsByWorkflowStep/{workflowId}/{stepOrder}/{departmentId}")]
        public async Task<IActionResult> GetScholarsByWorkflowStep(int workflowId, int stepOrder, int departmentId)
        {
            try
            {
                var currentStep = await _context.WorkflowSteps
                    .FirstOrDefaultAsync(s => s.WorkflowID == workflowId && s.StepOrder == stepOrder);

                if (currentStep == null)
                {
                    return NotFound("Workflow step not found");
                }

                // Get scholars with their workflow instances
                var scholarData = await (
                    from inst in _context.WorkflowInstances
                    join scholar in _context.Scholars on inst.EntityID equals scholar.SID
                    join synopsis in _context.SynopsisRDCs on scholar.SID equals synopsis.SID
                    join dept in _context.Departments on scholar.Subject_ID equals dept.DepartmentID
                    where inst.EntityType == "SynopsisRDC"
                        && inst.WorkflowID == workflowId
                        && inst.CurrentStepOrder == stepOrder
                        && inst.Status == "Pending"
                        && !inst.IsLocked
                        && dept.DepartmentID == departmentId
                    select new
                    {
                        SID = scholar.SID,
                        Name = scholar.Name,
                        ApplicationNo = scholar.ApplicationNo,
                        InstanceID = inst.InstanceID,
                        SynopsisTitle = synopsis.Title,
                        SynopsisFilePath = synopsis.FilePath
                    }
                ).ToListAsync();

                var scholarIds = scholarData.Select(s => s.SID).ToList();
                var supervisorData = await (
                    from sup in _context.ScholarSupervisors
                    join supReg in _context.SupervisorRegistrations on sup.SUPID1 equals supReg.SupId
                    where scholarIds.Contains(sup.SID)
                    select new
                    {
                        ScholarID = sup.SID,
                        SupervisorName = supReg.FullName,
                        SupervisorEmail = supReg.Email,
                        SupervisorMobile = supReg.MobileNo
                    }
                ).ToListAsync();

                var instanceIds = scholarData.Select(s => s.InstanceID).ToList();
                var rdcDates = await _context.WorkflowLogs
                    .Where(l => instanceIds.Contains(l.InstanceID))
                    .GroupBy(l => l.InstanceID)
                    .Select(g => new
                    {
                        InstanceID = g.Key,
                        RDCDate = g.OrderByDescending(l => l.ActionTimestamp).FirstOrDefault().ScheduledMeetingDate
                    })
                    .ToListAsync();

                var result = scholarData.Select(s =>
                {
                    var supervisor = supervisorData.FirstOrDefault(sup => sup.ScholarID == s.SID);
                    var rdcDate = rdcDates.FirstOrDefault(d => d.InstanceID == s.InstanceID);

                    return new
                    {
                        s.SID,
                        s.Name,
                        s.ApplicationNo,
                        SupervisorName = supervisor?.SupervisorName ?? "N/A",
                        SupervisorEmail = supervisor?.SupervisorEmail ?? "N/A",
                        SupervisorMobile = supervisor?.SupervisorMobile ?? "N/A",
                        RDCDate = rdcDate?.RDCDate,
                        s.InstanceID,
                        s.SynopsisTitle,
                        s.SynopsisFilePath
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error fetching scholars: {ex.Message}");
            }
        }

        [HttpPost("AssignRDCDate")]
        public async Task<IActionResult> AssignRDCDate(
            [FromQuery] int subjectId,
            [FromQuery] string rdcDate,
            [FromQuery] int scholarId,
            [FromQuery] int? actionByRoleId = null)
        {
            try
            {
                // Get role ID from parameter (frontend should pass user's roleId)
                if (!actionByRoleId.HasValue || actionByRoleId.Value == 0)
                {
                    return BadRequest(new { success = false, message = "Role ID is required" });
                }

                int roleId = actionByRoleId.Value;

                // Parse the date
                if (!DateTime.TryParseExact(rdcDate, "dd-MM-yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsedDate))
                {
                    return BadRequest(new { success = false, message = "Invalid date format. Use DD-MM-YYYY" });
                }

                // Find the workflow instance
                var instance = await _context.WorkflowInstances
                    .FirstOrDefaultAsync(i => i.EntityType == "SynopsisRDC" 
                        && i.EntityID == scholarId 
                        && i.WorkflowID == 6);

                if (instance == null)
                {
                    return NotFound(new { success = false, message = "Workflow instance not found" });
                }

                // Find the RDC step (StepOrder = 2)
                var rdcStep = await _context.WorkflowSteps
                    .FirstOrDefaultAsync(s => s.WorkflowID == 6 && s.StepOrder == 2);

                if (rdcStep == null)
                {
                    return NotFound(new { success = false, message = "RDC step not found" });
                }

                // Check if a log entry already exists for this step
                var existingLog = await _context.WorkflowLogs
                    .FirstOrDefaultAsync(l => l.InstanceID == instance.InstanceID && l.StepID == rdcStep.StepID);

                if (existingLog != null)
                {
                    // Update existing log
                    existingLog.ScheduledMeetingDate = parsedDate;
                    existingLog.ActionTimestamp = DateTime.UtcNow;
                    existingLog.ActionByUserID = roleId;
                    existingLog.Comments = $"RDC meeting date updated to {rdcDate} by role {roleId}";
                    _context.WorkflowLogs.Update(existingLog);
                }
                else
                {
                    // Create new log entry
                    var newLog = new WorkflowLog
                    {
                        InstanceID = instance.InstanceID,
                        StepID = rdcStep.StepID,
                        ActionByUserID = roleId,
                        Action = "ScheduleMeeting",
                        Comments = $"RDC meeting scheduled for {rdcDate} by role {roleId}",
                        ActionTimestamp = DateTime.UtcNow,
                        ScheduledMeetingDate = parsedDate
                    };
                    _context.WorkflowLogs.Add(newLog);
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "RDC date assigned successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Error assigning RDC date: {ex.Message}" });
            }
        }

        [HttpPost("SendSynopsisEmail")]
        public async Task<IActionResult> SendSynopsis([FromBody] SendSynopsisEmailRequest request)
        {
            if (request.MemberEmails == null || !request.MemberEmails.Any())
                return BadRequest("Member email list is empty.");

            if (request.ScholarIds == null || !request.ScholarIds.Any())
                return BadRequest("Scholar ID list is empty.");

            try
            {
                // Get role ID from request (frontend should pass user's roleId)
                if (!request.ActionByRoleId.HasValue || request.ActionByRoleId.Value == 0)
                {
                    return BadRequest("Role ID is required");
                }

                int roleId = request.ActionByRoleId.Value;

                var scholars = await _context.Scholars
                    .Where(s => request.ScholarIds.Contains(s.SID))
                    .ToListAsync();

                var synopsisRecords = await _context.SynopsisRDCs
                    .Where(s => request.ScholarIds.Contains(s.SID))
                    .ToListAsync();

                if (!synopsisRecords.Any())
                    return NotFound("No synopsis records found.");

                // Get the RDC step for workflow logging
                var rdcStep = await _context.WorkflowSteps
                    .FirstOrDefaultAsync(s => s.WorkflowID == 6 && s.StepOrder == 2);

                if (rdcStep == null)
                {
                    return NotFound("RDC step not found in workflow");
                }

                var synopsisTableHtml = @"
<table border='1' cellpadding='5' cellspacing='0' style='border-collapse: collapse; width: 100%;'>
    <thead>
        <tr style='background-color: #f2f2f2;'>
            <th>Scholar Name</th>
            <th>Father Name</th>
            <th>Synopsis Title</th>
            <th>Document</th>
        </tr>
    </thead>
    <tbody>";

                foreach (var synopsis in synopsisRecords)
                {
                    var scholar = scholars.FirstOrDefault(x => x.SID == synopsis.SID);
                    if (scholar == null) continue;

                    string downloadLink = "File not available";
                    if (!string.IsNullOrEmpty(synopsis.FilePath))
                    {
                        downloadLink = $"<a href='https://localhost:7290/api/SynopsisRDC/files/download?path={Uri.EscapeDataString(synopsis.FilePath)}' target='_blank'>Download</a>";
                    }

                    synopsisTableHtml += $@"
<tr>
    <td>{scholar.Name}</td>
    <td>{scholar.FName}</td>
    <td>{synopsis.Title}</td>
    <td>{downloadLink}</td>
</tr>";
                }

                synopsisTableHtml += @"
    </tbody>
</table>";

                // Send emails
                foreach (var email in request.MemberEmails.Where(e => !string.IsNullOrWhiteSpace(e)))
                {
                    var tokens = new Dictionary<string, string>
                    {
                        { "date", DateTime.Now.ToString("dd-MM-yyyy") },
                        { "member_name", email },
                        { "rdc_subject", request.Department },
                        { "synopsis_list", synopsisTableHtml }
                    };

                    var (subject, body) = await _emailTemplateService.RenderAsync(1019, tokens);
                    _emailService.SendEmail(email.Trim(), subject, body);
                }

                // Create workflow logs for each scholar to track synopsis sent to RDC
                foreach (var scholarId in request.ScholarIds)
                {
                    // Find the workflow instance
                    var instance = await _context.WorkflowInstances
                        .FirstOrDefaultAsync(i => i.EntityType == "SynopsisRDC" 
                            && i.EntityID == scholarId 
                            && i.WorkflowID == 6);

                    if (instance != null)
                    {
                        // Check if a "SynopsisSent" log already exists
                        var existingLog = await _context.WorkflowLogs
                            .FirstOrDefaultAsync(l => l.InstanceID == instance.InstanceID 
                                && l.StepID == rdcStep.StepID 
                                && l.Action == "SynopsisSent");

                        if (existingLog == null)
                        {
                            // Create new log entry
                            var newLog = new WorkflowLog
                            {
                                InstanceID = instance.InstanceID,
                                StepID = rdcStep.StepID,
                                ActionByUserID = roleId,
                                Action = "SynopsisSent",
                                Comments = $"Synopsis sent to RDC members for {request.Department}. Recipients: {string.Join(", ", request.MemberEmails.Take(3))}",
                                ActionTimestamp = DateTime.UtcNow
                            };
                            _context.WorkflowLogs.Add(newLog);

                            // Move workflow to next step (Step 3)
                            instance.CurrentStepOrder = 3;
                            instance.CurrentStepRejectionCount = 0; // Reset rejection count for new step
                            _context.WorkflowInstances.Update(instance);
                        }
                        else
                        {
                            // Update existing log (re-send scenario)
                            existingLog.ActionTimestamp = DateTime.UtcNow;
                            existingLog.ActionByUserID = roleId;
                            existingLog.Comments = $"Synopsis re-sent to RDC members for {request.Department}. Recipients: {string.Join(", ", request.MemberEmails.Take(3))}";
                            _context.WorkflowLogs.Update(existingLog);
                            
                            // Don't move workflow forward on re-send, just update the log
                        }
                    }
                }

                await _context.SaveChangesAsync();

                return Ok("Synopsis email sent successfully to all members.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error sending synopsis: {ex.Message}");
            }
        }

        [HttpGet("files/download")]
        public async Task<IActionResult> DownloadFile([FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("File path is required");

            var fileBytes = await _fileStorage.GetFileAsync(path);
            var fileName = Path.GetFileName(path);
            return File(fileBytes, "application/pdf", fileName);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetSynopsisRDC(int id)
        {
            var attempts = await _context.SynopsisRDCs
                .Where(u => u.SID == id)
                .OrderBy(u => u.AttemptNumber)
                .ToListAsync();

            var cw = await _context.CourseWorks
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.SID == id);

            if (cw != null && cw.CourseWorkResult == CourseWorkDecisions.CourseworkApproved)
            {
                var scholar = await _context.Scholars.FindAsync(id);
                if (scholar != null && scholar.DecisionStatus < DecisionStatus.CourseworkApproved)
                {
                    scholar.DecisionStatus = DecisionStatus.CourseworkApproved;
                    scholar.DecisionUpdateTime = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            if (!attempts.Any())
            {
                return Ok(new
                {
                    synid = (int?)null,
                    sid = id,
                    // Attempt 1 fields
                    synopsis1Title = string.Empty,
                    synopsis1FilePath = (string?)null,
                    synopsis1Date = (DateTime?)null,
                    synopsis1Receipt = string.Empty,
                    synopsis1FeeAmt = string.Empty,
                    synopsis1LastDate = cw?.ApprovedAt,
                    synopsis1RDCDate = (DateTime?)null,
                    synopsis1RDCRemark = (string?)null,
                    synopsis1Decision = (int?)0,

                    // Attempt 2 fields
                    synopsis2Title = string.Empty,
                    synopsis2FilePath = (string?)null,
                    synopsis2Date = (DateTime?)null,
                    synopsis2Receipt = string.Empty,
                    synopsis2FeeAmt = string.Empty,
                    synopsis2LastDate = (DateTime?)null,
                    synopsis2RDCDate = (DateTime?)null,
                    synopsis2RDCRemark = (string?)null,
                    synopsis2Decision = (int?)0
                });
            }

            // Map row-based attempts back to legacy column-based structure for scholar UI compatibility
            var firstAttempt = attempts.FirstOrDefault(a => a.AttemptNumber == 1);
            var secondAttempt = attempts.FirstOrDefault(a => a.AttemptNumber == 2);

            var result = new
            {
                synid = firstAttempt?.SYNID,
                sid = id,
                // Attempt 1 fields
                synopsis1Title = firstAttempt?.Title,
                synopsis1FilePath = firstAttempt?.FilePath,
                synopsis1Date = firstAttempt?.SubmissionDate,
                synopsis1Receipt = firstAttempt?.ReceiptNumber,
                synopsis1FeeAmt = firstAttempt?.FeeAmount,
                synopsis1LastDate = firstAttempt?.Synopsis1LastDate ?? cw?.ApprovedAt,
                synopsis1RDCDate = firstAttempt?.RDCDate,
                synopsis1RDCRemark = firstAttempt?.RDCRemark,
                synopsis1Decision = await GetStepDecision(firstAttempt, id, 1),
                
                // Attempt 2 fields
                synopsis2Title = secondAttempt?.Title,
                synopsis2FilePath = secondAttempt?.FilePath,
                synopsis2Date = secondAttempt?.SubmissionDate,
                synopsis2Receipt = secondAttempt?.ReceiptNumber,
                synopsis2FeeAmt = secondAttempt?.FeeAmount,
                synopsis2LastDate = secondAttempt?.Synopsis2LastDate ?? firstAttempt?.Synopsis2LastDate,
                synopsis2RDCDate = secondAttempt?.RDCDate,
                synopsis2RDCRemark = secondAttempt?.RDCRemark,
                synopsis2Decision = await GetStepDecision(secondAttempt, id, 2)
            };

            return result;
        }

        private async Task<int?> GetStepDecision(SynopsisRDC? attempt, int sid, int attemptNumber)
        {
            if (attempt == null) return 0; // Pending

            // 1. Newly uploaded synopsis with no RDC date and no remark is Pending
            if (attempt.RDCDate == null && string.IsNullOrEmpty(attempt.RDCRemark))
            {
                return 0; // Pending
            }

            // 2. Check explicit decision stored on attempt record
            var explicitDecision = attemptNumber == 1 ? attempt.Synopsis1Decision : attempt.Synopsis2Decision;
            if (explicitDecision.HasValue)
            {
                if (explicitDecision.Value == SynopsisDecisions.SynopsisRejected) return 2;
                if (explicitDecision.Value == SynopsisDecisions.SynopsisNeedsRevision) return 3;
                if (explicitDecision.Value == SynopsisDecisions.SynopsisApproved) return 1;
            }

            // 3. Find latest workflow instance for this synopsis/scholar
            var instance = await _context.WorkflowInstances
                .Where(i => i.WorkflowID == 6 
                    && i.EntityType == "SynopsisRDC" 
                    && (i.EntityID == attempt.SYNID || i.EntityID == sid))
                .OrderByDescending(i => i.InstanceID)
                .FirstOrDefaultAsync();

            if (instance != null)
            {
                if (instance.CurrentStepRejectionCount > 0) return 3; // Revision Required
                if (instance.Status == "Rejected") return 2; // Rejected
                if (instance.Status == "Approved") return 1; // Approved

                // Check workflow logs for this instance to see if Accept/Approve was submitted
                var latestLog = await _context.WorkflowLogs
                    .Where(l => l.InstanceID == instance.InstanceID)
                    .OrderByDescending(l => l.LogID)
                    .FirstOrDefaultAsync();

                if (latestLog != null)
                {
                    if (latestLog.Action == "Accept" || latestLog.Action == "Approve")
                    {
                        if (attemptNumber == 1 && attempt.Synopsis1Decision != SynopsisDecisions.SynopsisApproved)
                        {
                            attempt.Synopsis1Decision = SynopsisDecisions.SynopsisApproved;
                            await _context.SaveChangesAsync();
                        }
                        else if (attemptNumber == 2 && attempt.Synopsis2Decision != SynopsisDecisions.SynopsisApproved)
                        {
                            attempt.Synopsis2Decision = SynopsisDecisions.SynopsisApproved;
                            await _context.SaveChangesAsync();
                        }
                        return 1; // Approved / Accepted
                    }
                    if (latestLog.Action == "Reject") return 2; // Rejected
                    if (latestLog.Action == "RequestRevision" || latestLog.Action == "NeedsRevision") return 3; // Revision
                }
            }

            // 4. If RDC Date and Remark indicate acceptance (e.g. "RDC decision accepted")
            if (attempt.RDCDate != null && !string.IsNullOrEmpty(attempt.RDCRemark))
            {
                if (attempt.RDCRemark.IndexOf("accepted", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    attempt.RDCRemark.IndexOf("approved", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (attemptNumber == 1 && attempt.Synopsis1Decision != SynopsisDecisions.SynopsisApproved)
                    {
                        attempt.Synopsis1Decision = SynopsisDecisions.SynopsisApproved;
                        await _context.SaveChangesAsync();
                    }
                    else if (attemptNumber == 2 && attempt.Synopsis2Decision != SynopsisDecisions.SynopsisApproved)
                    {
                        attempt.Synopsis2Decision = SynopsisDecisions.SynopsisApproved;
                        await _context.SaveChangesAsync();
                    }
                    return 1; // Approved
                }
            }

            return 0; // Pending
        }

        [HttpGet("scholar-attempts/{sid}")]
        public async Task<IActionResult> GetScholarAttempts(int sid)
        {
            var attempts = await _context.SynopsisRDCs
                .Where(s => s.SID == sid)
                .OrderByDescending(s => s.AttemptNumber)
                .ToListAsync();

            return Ok(attempts);
        }

        [HttpGet("isSynopsisApproved/{sId}")]
        public async Task<IActionResult> IsSynopsisApproved(int sId)
        {
            try
            {
                // 1. Check Scholar DecisionStatus
                var scholar = await _context.Scholars.FindAsync(sId);
                if (scholar != null && scholar.DecisionStatus == DecisionStatus.SysnopsisApproved)
                {
                    return Ok(new { result = true });
                }

                // 2. Check SynopsisRDC attempts
                var attempts = await _context.SynopsisRDCs
                    .Where(s => s.SID == sId)
                    .OrderByDescending(s => s.AttemptNumber)
                    .ToListAsync();

                if (!attempts.Any())
                {
                    return Ok(new { result = false });
                }

                foreach (var attempt in attempts)
                {
                    var decision = await GetStepDecision(attempt, sId, attempt.AttemptNumber);
                    if (decision == 1) // 1 = Approved
                    {
                        return Ok(new { result = true });
                    }
                }

                // 3. Check Workflow Instances for SynopsisRDC (WorkflowID = 6 or Scholar Synopsis)
                var synIds = attempts.Select(a => a.SYNID).ToList();
                var isWorkflowApproved = await _context.WorkflowInstances
                    .AnyAsync(i => (i.WorkflowID == 6 || (i.Workflow != null && i.Workflow.Name.ToLower().Contains("synopsis")))
                        && i.EntityType == "SynopsisRDC" 
                        && (i.EntityID == sId || synIds.Contains(i.EntityID))
                        && i.Status == "Approved");

                if (isWorkflowApproved)
                {
                    return Ok(new { result = true });
                }

                return Ok(new { result = false });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { result = false, message = ex.Message });
            }
        }

        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateSynopsisRDC([FromForm] CreateSynopsisRDCRequest request)
        {
            if (request.SID <= 0) return BadRequest("Valid SID is required.");

            int attemptCount = await _context.SynopsisRDCs.CountAsync(s => s.SID == request.SID);

            var cw = await _context.CourseWorks
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.SID == request.SID);
            
            var synopsisRDC = new SynopsisRDC
            {
                SID = request.SID,
                AttemptNumber = attemptCount + 1,
                Title = request.Title,
                SubmissionDate = (request.File != null || !string.IsNullOrWhiteSpace(request.Title)) ? DateTime.UtcNow : null,
                ReceiptNumber = request.ReceiptNumber,
                FeeAmount = request.FeeAmount,
                Synopsis1LastDate = request.Synopsis1LastDate ?? cw?.ApprovedAt,
                Synopsis1Decision = SynopsisDecisions.SynopsisPending
            };

            if (request.File != null)
            {
                synopsisRDC.FilePath = await _fileStorage.SaveAsync(
                    request.File,
                    "synopsis",
                    $"Scholar_{request.SID}_Attempt_{synopsisRDC.AttemptNumber}"
                );
            }

            _context.SynopsisRDCs.Add(synopsisRDC);
            await _context.SaveChangesAsync();

            if (request.File != null || !string.IsNullOrWhiteSpace(request.Title))
            {
                await _workflowService.StartWorkflowAsync("Scholar Synopsis", synopsisRDC.SYNID, "SynopsisRDC");

                var scholar = await _context.Scholars.FindAsync(request.SID);
                if (scholar != null)
                {
                    scholar.DecisionStatus = DecisionStatus.SysnopsisSubmitted;
                    await _context.SaveChangesAsync();
                }
            }

            return Ok(new { message = "Synopsis submitted successfully", data = synopsisRDC });
        }

        public class CreateSynopsisRDCRequest
        {
            public int SID { get; set; }
            public string? Title { get; set; }
            public IFormFile? File { get; set; }
            public string? ReceiptNumber { get; set; }
            public string? FeeAmount { get; set; }
            public DateTime? Synopsis1LastDate { get; set; }
        }

        [HttpPatch("{sid}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateSynopsisRDC(int sid, [FromForm] UpdateSynopsisRDCRequest request)
        {
            if (sid <= 0) return BadRequest("Valid SID is required.");

            // Handle Attempt 1 update
            if (!string.IsNullOrEmpty(request.Synopsis1Title) || request.Synopsis1LastDate.HasValue)
            {
                var attempt1 = await _context.SynopsisRDCs.FirstOrDefaultAsync(s => s.SID == sid && s.AttemptNumber == 1);
                if (attempt1 != null)
                {
                    if (!string.IsNullOrEmpty(request.Synopsis1Title))
                        attempt1.Title = request.Synopsis1Title;

                    if (!string.IsNullOrEmpty(request.Synopsis1Receipt))
                        attempt1.ReceiptNumber = request.Synopsis1Receipt;

                    if (!string.IsNullOrEmpty(request.Synopsis1FeeAmt))
                        attempt1.FeeAmount = request.Synopsis1FeeAmt;

                    if (request.Synopsis1LastDate.HasValue)
                        attempt1.Synopsis1LastDate = request.Synopsis1LastDate;

                    if (request.Synopsis1File != null)
                    {
                        attempt1.FilePath = await _fileStorage.SaveAsync(request.Synopsis1File, "synopsis", $"Scholar_{sid}_Attempt_1_Update");
                        attempt1.Synopsis1Decision = SynopsisDecisions.SynopsisPending;
                        attempt1.SubmissionDate = DateTime.UtcNow;
                    }
                    await _context.SaveChangesAsync();
                }
            }

            // Handle Attempt 2 (Create if not exists)
            if (!string.IsNullOrEmpty(request.Synopsis2Title))
            {
                var attempt2 = await _context.SynopsisRDCs.FirstOrDefaultAsync(s => s.SID == sid && s.AttemptNumber == 2);
                if (attempt2 == null)
                {
                    attempt2 = new SynopsisRDC
                    {
                        SID = sid,
                        AttemptNumber = 2,
                        Title = request.Synopsis2Title,
                        ReceiptNumber = request.Synopsis2Receipt,
                        FeeAmount = request.Synopsis2FeeAmt,
                        SubmissionDate = DateTime.UtcNow,
                        Synopsis2LastDate = request.Synopsis2LastDate,
                        Synopsis2Decision = SynopsisDecisions.SynopsisPending
                    };
                    if (request.Synopsis2File != null)
                    {
                        attempt2.FilePath = await _fileStorage.SaveAsync(request.Synopsis2File, "synopsis", $"Scholar_{sid}_Attempt_2");
                    }
                    _context.SynopsisRDCs.Add(attempt2);
                    await _context.SaveChangesAsync();
                    
                    // Start workflow for Attempt 2
                    await _workflowService.StartWorkflowAsync("Scholar Synopsis", attempt2.SYNID, "SynopsisRDC");
                }
                else
                {
                    attempt2.Title = request.Synopsis2Title;
                    attempt2.ReceiptNumber = request.Synopsis2Receipt;
                    attempt2.FeeAmount = request.Synopsis2FeeAmt;
                    if (request.Synopsis2LastDate.HasValue)
                        attempt2.Synopsis2LastDate = request.Synopsis2LastDate;

                    if (request.Synopsis2File != null)
                    {
                        attempt2.FilePath = await _fileStorage.SaveAsync(request.Synopsis2File, "synopsis", $"Scholar_{sid}_Attempt_2_Update");
                    }
                    await _context.SaveChangesAsync();
                }
            }

            var scholarRecord = await _context.Scholars.FindAsync(sid);
            if (scholarRecord != null && scholarRecord.DecisionStatus < DecisionStatus.SysnopsisSubmitted)
            {
                scholarRecord.DecisionStatus = DecisionStatus.SysnopsisSubmitted;
                scholarRecord.DecisionUpdateTime = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Update successful" });
        }

        public class UpdateSynopsisRDCRequest
        {
            public string? Synopsis1Title { get; set; }
            public string? Synopsis1Receipt { get; set; }
            public string? Synopsis1FeeAmt { get; set; }
            public IFormFile? Synopsis1File { get; set; }
            public DateTime? Synopsis1LastDate { get; set; }
            public string? Synopsis2Title { get; set; }
            public string? Synopsis2Receipt { get; set; }
            public string? Synopsis2FeeAmt { get; set; }
            public IFormFile? Synopsis2File { get; set; }
            public DateTime? Synopsis2LastDate { get; set; }
        }

        [HttpPost("process-workflow-step")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ProcessWorkflowStep([FromForm] ProcessWorkflowStepRequest request)
        {
            var instance = await _context.WorkflowInstances
                .Include(i => i.Workflow)
                .ThenInclude(w => w.Steps)
                .FirstOrDefaultAsync(i => i.InstanceID == request.InstanceId);

            if (instance == null) return NotFound("Workflow instance not found.");

            var synopsisRDC = await _context.SynopsisRDCs.FirstOrDefaultAsync(i=>i.SID == instance.EntityID);
            if (synopsisRDC == null) return NotFound("Synopsis record not found.");

            var currentStep = instance.Workflow.Steps.FirstOrDefault(s => s.StepOrder == instance.CurrentStepOrder);
            if (currentStep == null) return BadRequest("Current step not found.");

            var stepData = new Dictionary<string, string>();
            string? attachedFilePath = null;

            if (currentStep.StepOrder == 1 && !string.IsNullOrEmpty(request.RdcDate))
            {
                if (DateTime.TryParse(request.RdcDate, out DateTime parsedDate))
                {
                    synopsisRDC.RDCDate = parsedDate;
                    stepData["RDCDate"] = request.RdcDate;
                }
            }
            
            if (request.File != null)
            {
                string folder = "synopsis";
                string fileName = $"Step{currentStep.StepOrder}_{instance.EntityID}";
                attachedFilePath = await _fileStorage.SaveAsync(request.File, folder, fileName);
                
                if (currentStep.StepOrder == 3) // Upload Proceeding
                {
                    stepData["ProceedingFile"] = attachedFilePath;
                }
                else if (currentStep.StepOrder == 7) // Upload RDC Decision
                {
                    stepData["DecisionFile"] = attachedFilePath;
                }
                else
                {
                    stepData["AttachedFile"] = attachedFilePath;
                }
            }

            if (!string.IsNullOrEmpty(request.Comments))
            {
                stepData["Comments"] = request.Comments;
                synopsisRDC.RDCRemark = request.Comments; // Update for scholar UI visibility
            }

            await _workflowService.ProcessActionWithDataAsync(request.InstanceId, request.RoleId, request.Action, request.Comments ?? "", stepData, attachedFilePath);
            
            // Handle legacy status update for scholar UI compatibility
            if (request.Action == "Reject")
            {
                if (synopsisRDC.AttemptNumber == 1)
                {
                    synopsisRDC.Synopsis1Decision = SynopsisDecisions.SynopsisRejected;
                }
                else if (synopsisRDC.AttemptNumber == 2)
                {
                    synopsisRDC.Synopsis2Decision = SynopsisDecisions.SynopsisRejected;

                    var scholar = await _context.Scholars.FindAsync(synopsisRDC.SID);
                    if (scholar != null)
                    {
                        scholar.DecisionStatus = DecisionStatus.SysnopsisRejected;
                        scholar.DecisionUpdateTime = DateTime.UtcNow;
                    }
                }
            }
            else if (request.Action == "NeedsRevision" || request.Action == "SendBack")
            {
                if (synopsisRDC.AttemptNumber == 1) synopsisRDC.Synopsis1Decision = SynopsisDecisions.SynopsisNeedsRevision;
                else if (synopsisRDC.AttemptNumber == 2) synopsisRDC.Synopsis2Decision = SynopsisDecisions.SynopsisNeedsRevision;
            }
            else if (request.Action == "Approve" || request.Action == "Accept")
            {
                if (currentStep.IsFinalStep)
                {
                    if (synopsisRDC.AttemptNumber == 1) synopsisRDC.Synopsis1Decision = SynopsisDecisions.SynopsisApproved;
                    else if (synopsisRDC.AttemptNumber == 2) synopsisRDC.Synopsis2Decision = SynopsisDecisions.SynopsisApproved;

                    var scholar = await _context.Scholars.FindAsync(synopsisRDC.SID);
                    if (scholar != null)
                    {
                        scholar.DecisionStatus = DecisionStatus.SysnopsisApproved;
                        scholar.DecisionUpdateTime = DateTime.UtcNow;
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Workflow step processed successfully" });
        }

        public class ProcessWorkflowStepRequest
        {
            public int InstanceId { get; set; }
            public string Action { get; set; } = string.Empty;
            public string? Comments { get; set; }
            public IFormFile? File { get; set; }
            public string? RdcDate { get; set; }
            public int RoleId { get; set; }
        }

        [HttpGet("pending-tasks/{roleId}")]
        public async Task<IActionResult> GetPendingTasks(int roleId)
        {
            var pendingInstances = await (
                from inst in _context.WorkflowInstances
                join syn in _context.SynopsisRDCs on inst.EntityID equals syn.SYNID
                join sch in _context.Scholars on syn.SID equals sch.SID
                join step in _context.WorkflowSteps on new { inst.WorkflowID, Order = inst.CurrentStepOrder } equals new { step.WorkflowID, Order = step.StepOrder }
                where inst.WorkflowID == 6 && inst.Status == "Pending" && step.RequiredRoleID == roleId && inst.EntityType == "SynopsisRDC"
                select new
                {
                    inst.InstanceID,
                    inst.CurrentStepOrder,
                    StepName = step.StepName,
                    syn.SYNID,
                    syn.SID,
                    syn.Title,
                    syn.AttemptNumber,
                    syn.SubmissionDate,
                    syn.RDCDate,
                    syn.FilePath,
                    ScholarName = sch.Name,
                    sch.ApplicationNo,
                    Subject = _context.Departments.Where(d => d.DepartmentID == sch.Subject_ID).Select(d => d.Subject).FirstOrDefault()
                }
            ).ToListAsync();

            // Fetch logs for these instances to find proceeding/decision files
            var instanceIds = pendingInstances.Select(p => p.InstanceID).ToList();
            var logs = await _context.WorkflowLogs
                .Where(l => instanceIds.Contains(l.InstanceID))
                .OrderBy(l => l.ActionTimestamp)
                .ToListAsync();

            var result = pendingInstances.Select(p => {
                string? proceedingFilePath = null;
                string? decisionFilePath = null;

                var instanceLogs = logs.Where(l => l.InstanceID == p.InstanceID);
                foreach (var log in instanceLogs)
                {
                    // Check dedicated FilePath column first (new approach)
                    if (!string.IsNullOrEmpty(log.FilePath)) {
                        // We can infer the type of file from the step associated with the log
                        var logStep = _context.WorkflowSteps.FirstOrDefault(s => s.StepID == log.StepID);
                        if (logStep?.StepOrder == 3) proceedingFilePath = log.FilePath;
                        if (logStep?.StepOrder == 7) decisionFilePath = log.FilePath;
                    }

                    if (string.IsNullOrEmpty(log.Comments)) continue;
                    try {
                        if (log.Comments.TrimStart().StartsWith("{")) {
                            var logData = System.Text.Json.JsonDocument.Parse(log.Comments);
                            if (logData.RootElement.TryGetProperty("Data", out var data)) {
                                if (data.TryGetProperty("ProceedingFile", out var pFile) && string.IsNullOrEmpty(proceedingFilePath)) 
                                    proceedingFilePath = pFile.GetString();
                                if (data.TryGetProperty("DecisionFile", out var dFile) && string.IsNullOrEmpty(decisionFilePath)) 
                                    decisionFilePath = dFile.GetString();
                            }
                        }
                    } catch { /* Ignore parse errors */ }
                }

                return new {
                    p.InstanceID,
                    p.CurrentStepOrder,
                    p.StepName,
                    p.SYNID,
                    p.SID,
                    p.Title,
                    p.AttemptNumber,
                    p.SubmissionDate,
                    p.RDCDate,
                    p.FilePath,
                    ProceedingFilePath = proceedingFilePath,
                    DecisionFilePath = decisionFilePath,
                    p.ScholarName,
                    p.ApplicationNo,
                    p.Subject
                };
            }).ToList();

            return Ok(result);
        }

        [HttpGet("scholar-history/{sid}")]
        public async Task<IActionResult> GetScholarWorkflowHistory(int sid)
        {
            var rawHistory = await (
                from syn in _context.SynopsisRDCs
                join inst in _context.WorkflowInstances on syn.SYNID equals inst.EntityID
                join log in _context.WorkflowLogs on inst.InstanceID equals log.InstanceID
                join step in _context.WorkflowSteps on log.StepID equals step.StepID
                join admin in _context.Admins on log.ActionByUserID equals admin.AID
                where syn.SID == sid && inst.EntityType == "SynopsisRDC"
                orderby log.ActionTimestamp descending
                select new
                {
                    syn.AttemptNumber,
                    step.StepName,
                    log.Action,
                    log.Comments,
                    log.FilePath,
                    Timestamp = log.ActionTimestamp,
                    PerformedBy = admin.Name
                }
            ).ToListAsync();

            var history = rawHistory.Select(h => {
                string? displayComments = h.Comments;
                Dictionary<string, string>? metadata = null;

                if (!string.IsNullOrEmpty(h.Comments) && h.Comments.TrimStart().StartsWith("{")) {
                    try {
                        var logData = System.Text.Json.JsonSerializer.Deserialize<WorkflowLogMetadata>(h.Comments);
                        if (logData != null) {
                            displayComments = logData.UserComments;
                            metadata = logData.Data;
                        }
                    } catch { /* Use raw comments if parsing fails */ }
                }

                return new {
                    h.AttemptNumber,
                    h.StepName,
                    h.Action,
                    Comments = displayComments,
                    Metadata = metadata,
                    FilePath = h.FilePath,
                    h.Timestamp,
                    h.PerformedBy
                };
            }).ToList();

            return Ok(history);
        }

        private class WorkflowLogMetadata {
            public string? UserComments { get; set; }
            public Dictionary<string, string>? Data { get; set; }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSynopsisRDC(int id)
        {
            var synopsisRDC = await _context.SynopsisRDCs.FindAsync(id);
            if (synopsisRDC == null) return NotFound();
            _context.SynopsisRDCs.Remove(synopsisRDC);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    public class SendSynopsisEmailRequest
    {
        public List<string> MemberEmails { get; set; }
        public List<int> ScholarIds { get; set; }
        public string Department { get; set; }
        public int? ActionByRoleId { get; set; }
    }
}
