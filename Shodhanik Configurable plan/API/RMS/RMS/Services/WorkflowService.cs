using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using System.Text.Json;

namespace RMS.Services
{
    public class WorkflowService : IWorkflowService
    {
        private readonly RMSDbContext _context;
        private readonly ILoggerService _logger;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;

        public WorkflowService(RMSDbContext context, ILoggerService logger, IEmailService emailService, IEmailTemplateService emailTemplateService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _emailTemplateService = emailTemplateService;
        }

        private async Task<List<int>> GetCandidateEntityIdsAsync(int entityId, string entityType)
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
            return candidateIds;
        }

        private async Task<WorkflowDefinition?> ResolveWorkflowDefinitionAsync(string? workflowName, string? entityType = null)
        {
            if (string.IsNullOrWhiteSpace(workflowName))
            {
                if (entityType == "SynopsisRDC")
                {
                    return await _context.WorkflowDefinitions
                        .Include(w => w.Steps)
                        .FirstOrDefaultAsync(w => (w.WorkflowID == 6 || w.Name.ToLower().Contains("synopsis")) && w.IsActive);
                }
                if (entityType == "Supervisor")
                {
                    return await _context.WorkflowDefinitions
                        .Include(w => w.Steps)
                        .FirstOrDefaultAsync(w => w.Name.ToLower().Contains("supervisor") && w.IsActive);
                }
                if (entityType == "Scholar")
                {
                    return await _context.WorkflowDefinitions
                        .Include(w => w.Steps)
                        .FirstOrDefaultAsync(w => w.Name.ToLower().Contains("scholar") && w.IsActive);
                }
                return null;
            }

            var cleanName = workflowName.Trim().ToLower();

            // 1. Exact match
            var wf = await _context.WorkflowDefinitions
                .Include(w => w.Steps)
                .FirstOrDefaultAsync(w => w.Name.ToLower() == cleanName && w.IsActive);

            if (wf != null) return wf;

            // 2. Common aliases
            if (cleanName == "synopsis" || cleanName.Contains("synopsis"))
            {
                wf = await _context.WorkflowDefinitions
                    .Include(w => w.Steps)
                    .FirstOrDefaultAsync(w => (w.WorkflowID == 6 || w.Name.ToLower() == "scholar synopsis" || w.Name.ToLower().Contains("synopsis")) && w.IsActive);
                if (wf != null) return wf;
            }
            else if (cleanName == "scholarregistration" || cleanName == "scholar" || cleanName.Contains("scholar"))
            {
                wf = await _context.WorkflowDefinitions
                    .Include(w => w.Steps)
                    .FirstOrDefaultAsync(w => (w.Name.ToLower() == "scholar registration" || w.Name.ToLower().Contains("scholar")) && w.IsActive);
                if (wf != null) return wf;
            }
            else if (cleanName == "supervisorregistration" || cleanName == "supervisor" || cleanName.Contains("supervisor"))
            {
                wf = await _context.WorkflowDefinitions
                    .Include(w => w.Steps)
                    .FirstOrDefaultAsync(w => (w.Name.ToLower() == "supervisor registration" || w.Name.ToLower().Contains("supervisor")) && w.IsActive);
                if (wf != null) return wf;
            }

            // 3. Fallback by entity type
            if (entityType == "SynopsisRDC")
            {
                wf = await _context.WorkflowDefinitions
                    .Include(w => w.Steps)
                    .FirstOrDefaultAsync(w => (w.WorkflowID == 6 || w.Name.ToLower().Contains("synopsis")) && w.IsActive);
            }

            return wf;
        }

        public async Task<WorkflowInstance> StartWorkflowAsync(string workflowName, int entityId, string entityType)
        {
            try
            {
                var workflow = await ResolveWorkflowDefinitionAsync(workflowName, entityType);

                if (workflow == null)
                {
                    _logger.LogError("WorkflowStartError", $"Workflow '{workflowName}' not found or inactive.", "WorkflowService");
                    throw new Exception($"Workflow {workflowName} not found or inactive.");
                }

                var candidateIds = await GetCandidateEntityIdsAsync(entityId, entityType);

                // Check if a pending instance already exists for this entity and workflow
                var existingInstance = await _context.WorkflowInstances
                    .FirstOrDefaultAsync(i => i.WorkflowID == workflow.WorkflowID && candidateIds.Contains(i.EntityID) && i.EntityType == entityType && i.Status == "Pending");

                if (existingInstance != null)
                {
                    _logger.LogEvent("WorkflowStartSkipped", "Workflow", 0, null, $"Workflow {workflow.Name} already pending for {entityType} #{entityId}");
                    return existingInstance;
                }

                var firstStep = workflow.Steps.OrderBy(s => s.StepOrder).FirstOrDefault();
                if (firstStep == null)
                {
                    _logger.LogError("WorkflowStepError", $"Workflow {workflow.Name} has no steps.", "WorkflowService");
                    throw new Exception($"Workflow {workflow.Name} has no steps.");
                }

                var instance = new WorkflowInstance
                {
                    WorkflowID = workflow.WorkflowID,
                    EntityID = entityId,
                    EntityType = entityType,
                    CurrentStepOrder = firstStep.StepOrder,
                    Status = "Pending",
                    StartedAt = DateTime.UtcNow
                };

                _context.WorkflowInstances.Add(instance);
                await _context.SaveChangesAsync();

                _logger.LogEvent("WorkflowStarted", "Workflow", 0, null, $"Started {workflow.Name} for {entityType} #{entityId}");

                return instance;
            }
            catch (Exception ex)
            {
                _logger.LogError("WorkflowServiceException", ex.Message, "WorkflowService");
                throw;
            }
        }

        public async Task<WorkflowInstance> ProcessActionAsync(int instanceId, int actionByUserId, string action, string comments, string? filePath = null)
        {
            var instance = await _context.WorkflowInstances
                .Include(i => i.Workflow)
                .ThenInclude(w => w.Steps)
                .FirstOrDefaultAsync(i => i.InstanceID == instanceId);

            if (instance == null) throw new Exception("Workflow instance not found.");
            if (instance.Status != "Pending") throw new Exception("Workflow is already completed.");

            var currentStep = instance.Workflow.Steps
                .FirstOrDefault(s => s.StepOrder == instance.CurrentStepOrder);

            if (currentStep == null) throw new Exception("Current step not found.");

            // Create Log
            var log = new WorkflowLog
            {
                InstanceID = instanceId,
                StepID = currentStep.StepID,
                ActionByUserID = actionByUserId,
                Action = action,
                Comments = comments,
                FilePath = filePath,
                ActionTimestamp = DateTime.UtcNow
            };
            _context.WorkflowLogs.Add(log);

            var normalizedAction = action?.Trim() ?? "";

            if (normalizedAction.Equals("Approve", StringComparison.OrdinalIgnoreCase) || normalizedAction.Equals("Accept", StringComparison.OrdinalIgnoreCase))
            {
                // Reset current step rejection count on approval
                instance.CurrentStepRejectionCount = 0;
                
                // Trigger action if defined for this step (regardless of whether it's final or not)
                if (!string.IsNullOrEmpty(currentStep.ActionToTrigger))
                {
                    await TriggerAction(currentStep.ActionToTrigger, instance.EntityID, instance.EntityType);
                }

                if (currentStep.IsFinalStep)
                {
                    instance.Status = "Approved";
                    instance.CompletedAt = DateTime.UtcNow;
                }
                else
                {
                    var nextStep = instance.Workflow.Steps
                        .Where(s => s.StepOrder > instance.CurrentStepOrder)
                        .OrderBy(s => s.StepOrder)
                        .FirstOrDefault();

                    if (nextStep != null)
                    {
                        instance.CurrentStepOrder = nextStep.StepOrder;
                    }
                    else
                    {
                        // Should not happen if IsFinalStep is correctly set
                        instance.Status = "Approved";
                        instance.CompletedAt = DateTime.UtcNow;
                    }
                }

                // If SynopsisRDC entity, sync synopsis record
                if (instance.EntityType == "SynopsisRDC")
                {
                    var synopsis = await _context.SynopsisRDCs
                        .Where(s => s.SYNID == instance.EntityID || s.SID == instance.EntityID)
                        .OrderByDescending(s => s.AttemptNumber)
                        .FirstOrDefaultAsync();

                    if (synopsis != null)
                    {
                        if (!string.IsNullOrEmpty(filePath)) synopsis.DecisionFilePath = filePath;
                        if (!string.IsNullOrEmpty(comments))
                        {
                            synopsis.RDCRemark = comments;
                            if (synopsis.AttemptNumber == 1) synopsis.Synopsis1RDCRemark = comments;
                            else if (synopsis.AttemptNumber == 2) synopsis.Synopsis2RDCRemark = comments;
                        }

                        // If at final step or completed
                        if (instance.Status == "Approved")
                        {
                            if (synopsis.AttemptNumber == 1)
                            {
                                synopsis.Synopsis1Decision = SynopsisDecisions.SynopsisApproved;
                                synopsis.Syn1RDC1ProceedingStatus = RDCProceedingDecisions.RDCProceedingApproved;
                                synopsis.Synopsis1ApprovedDate = DateTime.UtcNow;
                                synopsis.Synopsis1ApprovedBy = actionByUserId;
                            }
                            else if (synopsis.AttemptNumber == 2)
                            {
                                synopsis.Synopsis2Decision = SynopsisDecisions.SynopsisApproved;
                                synopsis.Syn2RDC1ProceedingStatus = RDCProceedingDecisions.RDCProceedingApproved;
                                synopsis.Synopsis2ApprovedDate = DateTime.UtcNow;
                                synopsis.Synopsis2ApprovedBy = actionByUserId;
                            }

                            var scholar = await _context.Scholars.FindAsync(synopsis.SID);
                            if (scholar != null)
                            {
                                scholar.DecisionStatus = DecisionStatus.SysnopsisApproved;
                                scholar.DecisionUpdateTime = DateTime.UtcNow;
                            }
                        }
                    }
                }
            }
            else if (normalizedAction.Equals("Reject", StringComparison.OrdinalIgnoreCase))
            {
                // Increment rejection counts
                instance.RejectionCount++;
                instance.CurrentStepRejectionCount++;
                
                // Check if this is the second rejection at current step
                if (instance.CurrentStepRejectionCount >= 2)
                {
                    // Lock the application - final rejection
                    instance.Status = "Rejected";
                    instance.IsLocked = true;
                    instance.CompletedAt = DateTime.UtcNow;

                    if (instance.EntityType == "SynopsisRDC")
                    {
                        var syn = await _context.SynopsisRDCs
                            .Where(s => s.SYNID == instance.EntityID || s.SID == instance.EntityID)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();
                        if (syn != null)
                        {
                            if (!string.IsNullOrEmpty(filePath)) syn.DecisionFilePath = filePath;
                            if (!string.IsNullOrEmpty(comments))
                            {
                                syn.RDCRemark = comments;
                                if (syn.AttemptNumber == 1) syn.Synopsis1RDCRemark = comments;
                                else if (syn.AttemptNumber == 2) syn.Synopsis2RDCRemark = comments;
                            }

                            if (syn.AttemptNumber == 1) syn.Synopsis1Decision = SynopsisDecisions.SynopsisRejected;
                            else if (syn.AttemptNumber == 2) syn.Synopsis2Decision = SynopsisDecisions.SynopsisRejected;

                            var sch = await _context.Scholars.FindAsync(syn.SID);
                            if (sch != null)
                            {
                                sch.DecisionStatus = DecisionStatus.SysnopsisRejected;
                                sch.DecisionUpdateTime = DateTime.UtcNow;
                            }
                        }
                    }
                    
                    _logger.LogEvent("WorkflowLockedAfterRejection", "Workflow", actionByUserId, null, 
                        $"Workflow instance {instanceId} locked after {instance.CurrentStepRejectionCount} rejections at step {instance.CurrentStepOrder}");
                }
                else
                {
                    // First rejection - allow resubmission
                    // Move back to the first step for resubmission
                    var firstStep = instance.Workflow.Steps
                        .OrderBy(s => s.StepOrder)
                        .FirstOrDefault();
                    
                    if (firstStep != null)
                    {
                        instance.CurrentStepOrder = firstStep.StepOrder;
                    }
                    
                    instance.Status = "Pending"; // Keep as pending to allow resubmission
                    
                    if (instance.EntityType == "SynopsisRDC")
                    {
                        var syn = await _context.SynopsisRDCs
                            .Where(s => s.SYNID == instance.EntityID || s.SID == instance.EntityID)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();
                        if (syn != null)
                        {
                            if (!string.IsNullOrEmpty(filePath)) syn.DecisionFilePath = filePath;
                            if (!string.IsNullOrEmpty(comments))
                            {
                                syn.RDCRemark = comments;
                                if (syn.AttemptNumber == 1) syn.Synopsis1RDCRemark = comments;
                                else if (syn.AttemptNumber == 2) syn.Synopsis2RDCRemark = comments;
                            }
                            if (syn.AttemptNumber == 1) syn.Synopsis1Decision = SynopsisDecisions.SynopsisNeedsRevision;
                            else if (syn.AttemptNumber == 2) syn.Synopsis2Decision = SynopsisDecisions.SynopsisNeedsRevision;
                        }
                    }

                    _logger.LogEvent("WorkflowRejectedForResubmission", "Workflow", actionByUserId, null, 
                        $"Workflow instance {instanceId} rejected at step {currentStep.StepOrder}. Resubmission allowed (rejection count: {instance.CurrentStepRejectionCount})");
                }
            }
            else if (normalizedAction.Equals("Revision", StringComparison.OrdinalIgnoreCase))
            {
                instance.RejectionCount++;
                instance.CurrentStepRejectionCount++;
                
                var firstStep = instance.Workflow.Steps.OrderBy(s => s.StepOrder).FirstOrDefault();
                if (firstStep != null)
                {
                    instance.CurrentStepOrder = firstStep.StepOrder;
                }
                instance.Status = "Pending";

                if (instance.EntityType == "SynopsisRDC")
                {
                    var syn = await _context.SynopsisRDCs
                        .Where(s => s.SYNID == instance.EntityID || s.SID == instance.EntityID)
                        .OrderByDescending(s => s.AttemptNumber)
                        .FirstOrDefaultAsync();
                    if (syn != null)
                    {
                        if (!string.IsNullOrEmpty(filePath)) syn.DecisionFilePath = filePath;
                        if (!string.IsNullOrEmpty(comments))
                        {
                            syn.RDCRemark = comments;
                            if (syn.AttemptNumber == 1) syn.Synopsis1RDCRemark = comments;
                            else if (syn.AttemptNumber == 2) syn.Synopsis2RDCRemark = comments;
                        }
                        if (syn.AttemptNumber == 1) syn.Synopsis1Decision = SynopsisDecisions.SynopsisNeedsRevision;
                        else if (syn.AttemptNumber == 2) syn.Synopsis2Decision = SynopsisDecisions.SynopsisNeedsRevision;
                    }
                }
            }
            else
            {
                // Update / Absent or other informative actions
                if (instance.EntityType == "SynopsisRDC")
                {
                    var syn = await _context.SynopsisRDCs
                        .Where(s => s.SYNID == instance.EntityID || s.SID == instance.EntityID)
                        .OrderByDescending(s => s.AttemptNumber)
                        .FirstOrDefaultAsync();
                    if (syn != null)
                    {
                        if (!string.IsNullOrEmpty(filePath)) syn.DecisionFilePath = filePath;
                        if (!string.IsNullOrEmpty(comments))
                        {
                            syn.RDCRemark = comments;
                            if (syn.AttemptNumber == 1) syn.Synopsis1RDCRemark = comments;
                            else if (syn.AttemptNumber == 2) syn.Synopsis2RDCRemark = comments;
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
            return instance;
        }

        public async Task<WorkflowInstance> ProcessActionWithDataAsync(int instanceId, int actionByUserId, string action, string comments, Dictionary<string, string> stepData, string? filePath = null)
        {
            var instance = await _context.WorkflowInstances
                .Include(i => i.Workflow)
                .ThenInclude(w => w.Steps)
                .FirstOrDefaultAsync(i => i.InstanceID == instanceId);

            if (instance == null) throw new Exception("Workflow instance not found.");
            
            // Merge stepData into comments as JSON if data exists
            string finalComments = comments;
            if (stepData != null && stepData.Count > 0)
            {
                var dataObj = new { 
                    UserComments = comments,
                    Data = stepData
                };
                finalComments = JsonSerializer.Serialize(dataObj);
            }

            return await ProcessActionAsync(instanceId, actionByUserId, action, finalComments, filePath);
        }

        public async Task<WorkflowInstance> ProcessActionByEntityAsync(int entityId, string entityType, int actionByUserId, string action, string comments, string? workflowName = null, string? filePath = null)
        {
            var workflow = await ResolveWorkflowDefinitionAsync(workflowName, entityType);
            var candidateIds = await GetCandidateEntityIdsAsync(entityId, entityType);

            var query = _context.WorkflowInstances
                .Include(i => i.Workflow)
                .Where(i => candidateIds.Contains(i.EntityID) && i.EntityType == entityType && i.Status == "Pending");

            if (workflow != null)
            {
                query = query.Where(i => i.WorkflowID == workflow.WorkflowID);
            }

            var instance = await query
                .OrderByDescending(i => i.StartedAt)
                .FirstOrDefaultAsync();

            if (instance == null)
            {
                var existingQuery = _context.WorkflowInstances
                    .Include(i => i.Workflow)
                    .Where(i => candidateIds.Contains(i.EntityID) && i.EntityType == entityType);

                if (workflow != null)
                {
                    existingQuery = existingQuery.Where(i => i.WorkflowID == workflow.WorkflowID);
                }

                var existingInstance = await existingQuery
                    .OrderByDescending(i => i.StartedAt)
                    .FirstOrDefaultAsync();

                if (existingInstance != null && (existingInstance.Status == "Approved" || existingInstance.Status == "Rejected"))
                {
                    throw new Exception($"Workflow instance for {entityType} #{entityId} in workflow '{existingInstance.Workflow?.Name ?? workflowName}' is already {existingInstance.Status}.");
                }

                // Check legacy screening status to resume at the correct step if applicable
                int? targetStepOrder = null;
                if (entityType == "Supervisor")
                {
                    var legacyScreening = await _context.SupervisorScreenings
                        .FirstOrDefaultAsync(s => s.SupId == entityId);

                    if (legacyScreening != null)
                    {
                        if (legacyScreening.Screening5Status == 1) targetStepOrder = 6;
                        else if (legacyScreening.Screening4Status == 1) targetStepOrder = 5;
                        else if (legacyScreening.Screening3Status == 1) targetStepOrder = 4;
                        else if (legacyScreening.Screening2Status == 1) targetStepOrder = 3;
                        else if (legacyScreening.Screening1Status == 1) targetStepOrder = 2;
                    }
                }

                string effectiveWfName = workflow?.Name ?? workflowName ?? (entityType == "SynopsisRDC" ? "Scholar Synopsis" : "");
                if (string.IsNullOrEmpty(effectiveWfName))
                {
                    throw new Exception($"No pending workflow instance found for {entityType} #{entityId}");
                }

                // Auto-initialize the workflow instance for this entity
                instance = await GetOrCreateWorkflowInstanceAsync(effectiveWfName, entityId, entityType, targetStepOrder);
            }

            return await ProcessActionAsync(instance.InstanceID, actionByUserId, action, comments, filePath);
        }

        public async Task<WorkflowInstance> GetOrCreateWorkflowInstanceAsync(string workflowName, int entityId, string entityType, int? targetStepOrder = null)
        {
            var workflow = await ResolveWorkflowDefinitionAsync(workflowName, entityType);

            if (workflow == null) throw new Exception($"Workflow {workflowName} not found.");

            var candidateIds = await GetCandidateEntityIdsAsync(entityId, entityType);

            var instance = await _context.WorkflowInstances
                .Where(i => i.WorkflowID == workflow.WorkflowID && candidateIds.Contains(i.EntityID) && i.EntityType == entityType)
                .OrderByDescending(i => i.StartedAt)
                .FirstOrDefaultAsync();

            if (instance == null)
            {
                instance = await StartWorkflowAsync(workflow.Name, entityId, entityType);
            }

            // For legacy records, we might need to "jump" to the current screening stage
            if (targetStepOrder.HasValue && instance.Status == "Pending" && instance.CurrentStepOrder < targetStepOrder.Value)
            {
                instance.CurrentStepOrder = targetStepOrder.Value;
                await _context.SaveChangesAsync();
            }

            return instance;
        }

        public async Task<IEnumerable<WorkflowInstance>> GetPendingApprovalsAsync(int roleId)
        {
            return await _context.WorkflowInstances
                .Include(i => i.Workflow)
                .ThenInclude(w => w.Steps)
                .Where(i => i.Status == "Pending" && 
                            i.Workflow.Steps.Any(s => s.StepOrder == i.CurrentStepOrder && s.RequiredRoleID == roleId))
                .ToListAsync();
        }

        private async Task TriggerAction(string? actionName, int entityId, string entityType)
        {
            if (string.IsNullOrEmpty(actionName)) return;

            switch (actionName)
            {
                case "ActivateScholar":
                    if (entityType == "Scholar")
                    {
                        var scholar = await _context.Scholars.FindAsync(entityId);
                        if (scholar != null)
                        {
                            scholar.DecisionStatus = DecisionStatus.CounsellingApprovedFinal;
                            var sa = await _context.ScholarAuths.FirstOrDefaultAsync(s => s.SID == scholar.SID);
                            if (sa != null)
                            {
                                sa.PermUserName = "SH" + scholar.ApplicationNo;
                                sa.PermPassword = Passwordgen.GeneratePassword();
                                sa.isPermAutoGen = true;
                            }
                        }
                    }
                    break;

                case "ActivateSupervisor":
                    if (entityType == "Supervisor")
                    {
                        var supervisor = await _context.SupervisorRegistrations.FindAsync(entityId);
                        if (supervisor != null)
                        {
                            supervisor.IsAccepted = 1;

                            // Sync legacy screening table as well
                            var legacyScreening = await _context.SupervisorScreenings.FirstOrDefaultAsync(s => s.SupId == entityId);
                            if (legacyScreening != null)
                            {
                                legacyScreening.Screening6Status = 1;
                                legacyScreening.Screening6Time = DateTime.UtcNow;
                            }

                            var supervisorAuth = await _context.SupervisorAuths.FirstOrDefaultAsync(sa => sa.SupId == entityId);
                            if (supervisorAuth == null)
                            {
                                supervisorAuth = new SupervisorAuth
                                {
                                    SupId = entityId
                                };
                                _context.SupervisorAuths.Add(supervisorAuth);
                            }

                            supervisorAuth.PermUserName = "SUP" + supervisor.ApplicationNumber;
                            supervisorAuth.PermPassword = Passwordgen.GeneratePassword();
                            supervisorAuth.isPermAutoGen = true;

                            // Fetch Department Name
                            string departmentName = "";
                            var pers = await _context.SupervisorPersonal.FirstOrDefaultAsync(p => p.SupId == entityId);
                            if (pers?.PrimarySuperviseSubject > 0)
                            {
                                departmentName = await _context.Departments
                                    .Where(d => d.DepartmentID == pers.PrimarySuperviseSubject)
                                    .Select(d => d.Subject)
                                    .FirstOrDefaultAsync() ?? "";
                            }

                            // Fetch College Name
                            string collegeName = "";
                            var edu = await _context.SupervisorEducations.FirstOrDefaultAsync(e => e.SupId == entityId);
                            if (edu != null)
                            {
                                if (edu.CollegeId > 0)
                                {
                                    collegeName = await _context.CollegeLists
                                        .Where(c => c.Id == edu.CollegeId)
                                        .Select(c => c.CollegeName)
                                        .FirstOrDefaultAsync() ?? "";
                                }
                                if (string.IsNullOrEmpty(collegeName))
                                {
                                    collegeName = edu.CollegeName ?? "";
                                }
                            }

                            // Save credentials and status changes to database
                            await _context.SaveChangesAsync();

                            // Send approval credentials email to supervisor
                            if (!string.IsNullOrEmpty(supervisor.Email))
                            {
                                try
                                {
                                    var tokens = new Dictionary<string, string>
                                    {
                                        { "name", supervisor.FullName ?? "" },
                                        { "dept", departmentName },
                                        { "college", collegeName },
                                        { "uname", supervisorAuth.PermUserName },
                                        { "pwd", supervisorAuth.PermPassword }
                                    };

                                    var (subject, body) = await _emailTemplateService.RenderAsync(
                                        templateID: 1010,
                                        tokens: tokens
                                    );

                                    string emailSubject = string.IsNullOrWhiteSpace(subject) || subject.Length > 150 || subject.Contains('\n') || subject.Contains('\r')
                                        ? "Research Supervisor Appointment - Approval and Login Details"
                                        : subject.Replace("\r", " ").Replace("\n", " ").Trim();

                                    var sendResult = _emailService.SendEmail(
                                        supervisor.Email,
                                        emailSubject,
                                        body
                                    );

                                    if (sendResult == "Email sent")
                                    {
                                        _logger.LogEvent("SupervisorApprovalEmailSent", "Workflow", 0, null,
                                            $"Approval email with login credentials sent to {supervisor.Email} for supervisor #{entityId}");
                                    }
                                    else
                                    {
                                        _logger.LogError("WorkflowEmailFailed", 
                                            $"Failed to send approval email to {supervisor.Email} for supervisor #{entityId}: {sendResult}", "WorkflowService");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError("WorkflowActionError", $"Error sending approval email for supervisor #{entityId}: {ex.Message}", "WorkflowService");
                                }
                            }
                        }
                    }
                    break;

                case "NotifiesCommittee/Scholar":
                    if (entityType == "SynopsisRDC")
                    {
                        var synopsis = await _context.SynopsisRDCs
                            .Where(s => s.SYNID == entityId || s.SID == entityId)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();
                        if (synopsis != null)
                        {
                            var scholar = await _context.Scholars.FindAsync(synopsis.SID);
                            var dept = scholar != null ? await _context.Departments.FindAsync(scholar.Subject_ID) : null;
                            if (scholar != null && dept != null)
                            {
                                var committee = await _context.RmsDors.Where(m => m.DepartmentId == scholar.Subject_ID).ToListAsync();
                                var tokens = new Dictionary<string, string>
                                {
                                    { "date", DateTime.Now.ToString("dd-MM-yyyy") },
                                    { "scholar_name", scholar.Name },
                                    { "rdc_subject", dept.Subject },
                                    { "rdc_date", synopsis.RDCDate?.ToString("dd-MM-yyyy") ?? "TBD" }
                                };

                                try
                                {
                                    var (sSub, sBody) = await _emailTemplateService.RenderAsync(1019, tokens);
                                    _emailService.SendEmail(scholar.Email, sSub, sBody);

                                    foreach (var member in committee)
                                    {
                                        _emailService.SendEmail(member.Email, sSub, sBody);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError("WorkflowActionError", $"Error sending emails for {actionName}: {ex.Message}", "WorkflowService");
                                }
                            }
                        }
                    }
                    break;

                case "CommencePHD":
                    if (entityType == "SynopsisRDC")
                    {
                        var synopsis = await _context.SynopsisRDCs
                            .Where(s => s.SYNID == entityId || s.SID == entityId)
                            .OrderByDescending(s => s.AttemptNumber)
                            .FirstOrDefaultAsync();
                        if (synopsis != null)
                        {
                            var scholar = await _context.Scholars.FindAsync(synopsis.SID);
                            if (scholar != null)
                            {
                                scholar.DecisionStatus = DecisionStatus.SysnopsisApproved;
                                scholar.DecisionUpdateTime = DateTime.UtcNow;
                            }
                            
                            // Update legacy decision fields for UI compatibility
                            if (synopsis.AttemptNumber == 1)
                            {
                                synopsis.Synopsis1Decision = SynopsisDecisions.SynopsisApproved;
                                synopsis.Synopsis1ApprovedDate = DateTime.UtcNow;
                            }
                            else if (synopsis.AttemptNumber == 2)
                            {
                                synopsis.Synopsis2Decision = SynopsisDecisions.SynopsisApproved;
                                synopsis.Synopsis2ApprovedDate = DateTime.UtcNow;
                            }
                        }
                    }
                    break;
            }
        }
    }
}
