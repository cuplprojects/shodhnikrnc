using API.Application.Access;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Contracts.Workflow;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using API.Contracts.Proposals;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace API.Controllers;

/// <summary>
/// Transition endpoints for a workflow instance.
/// </summary>
/// <remarks>
/// The class-level [Authorize] requires authentication and nothing more: which
/// roles may act is decided by the engine, from the stage's AllowedRoles in the
/// stored route.
///
/// Do not reintroduce [Authorize(Roles = ...)] here. A compile-time role list
/// silently overrides the configured one -- a SuperAdmin granting a stage to a
/// new role would be refused by the attribute before the engine ever ran, and
/// the configurator would appear to do nothing. It also returns an empty-bodied
/// 403, losing the message naming who may act.
///
/// The engine check is the stronger place for it regardless: a service calling
/// the engine directly never passes through this controller, so an attribute
/// here was never the whole story.
/// </remarks>
[ApiController]
[Route("api/workflow")]
[Authorize]
public class WorkflowController(
    IWorkflowEngineService workflowEngine,
    IResearchProposalService proposalService,
    IUserDepartmentProvider userDepartment,
    IRecruitmentService recruitmentService,
    IProjectService projectService,
    UserManager<ApplicationUser> userManager) : ControllerBase
{
    /// <summary>
    /// Office roles whose remarks are redacted from a restricted viewer (the
    /// requester/PI, or their department HOD) -- "internal office
    /// communication" the requester should never see the wording of. A step
    /// taken by anyone else (the PI, the HOD, or any role not in this set)
    /// keeps its remarks visible to every viewer, restricted or not.
    /// </summary>
    private static readonly string[] OfficeRoles = ["Dean", "DeputyRegistrar", "Superintendent", "RegularStaff"];

    [HttpGet("{instanceId:guid}")]
    public async Task<ActionResult<WorkflowInstanceResponse>> Get(Guid instanceId)
    {
        var instance = await workflowEngine.GetAsync(instanceId);
        if (instance is null)
        {
            return NotFound();
        }

        var steps = instance.Steps.OrderBy(s => s.Timestamp).ToList();
        var isRestrictedViewer = false;

        if (instance.RequestType == RequestType.ResearchProposal)
        {
            var userId = User.GetUserId();
            var ownership = await proposalService.GetOwnershipAsync(instance.RequestId);

            if (userId is not null && ownership is { } owned)
            {
                var isOwner = owned.OwnerUserId == userId.Value;
                var isDepartmentHod = false;
                if (!isOwner && User.GetRoles().Contains("HOD", StringComparer.OrdinalIgnoreCase))
                {
                    var callerDepartmentId = await userDepartment.GetDepartmentIdAsync(userId.Value);
                    isDepartmentHod = callerDepartmentId == owned.DepartmentId;
                }

                isRestrictedViewer = isOwner || isDepartmentHod;
            }
        }
        else if (instance.RequestType == RequestType.Advertisement)
        {
            // A recruitment has no department-HOD analogue to a proposal's
            // department, so only ownership is checked here.
            var userId = User.GetUserId();
            var ownerUserId = await recruitmentService.GetOwnershipAsync(instance.RequestId);

            isRestrictedViewer = userId is not null && ownerUserId == userId.Value;
        }
        else if (instance.RequestType == RequestType.GrantReceipt)
        {
            var userId = User.GetUserId();
            var ownerUserId = await projectService.GetGrantReceiptOwnershipAsync(instance.RequestId);

            isRestrictedViewer = userId is not null && ownerUserId == userId.Value;
        }

        // Every step is always shown -- the PI/HOD should see the request's
        // full progress (who acted, what action, when), not just Reject/
        // Return. Only the *remarks* of an office-role actor's step are
        // hidden from a restricted viewer; the PI's or HOD's own remarks
        // stay visible to everyone, same as the step itself.
        var redactedActorIds = isRestrictedViewer
            ? await GetOfficeRoleActorIdsAsync(steps)
            : [];
        var actorNames = await GetActorNamesAsync(steps);

        return Ok(new WorkflowInstanceResponse(
            instance.Id,
            instance.RequestType,
            instance.RequestId,
            instance.Phase,
            instance.CurrentStage,
            instance.AssignedToUserId,
            steps
                .Select((s, index) => new WorkflowStepResponse(
                    s.Stage, s.Action, s.ActorUserId,
                    actorNames.GetValueOrDefault(s.ActorUserId)?.Name,
                    actorNames.GetValueOrDefault(s.ActorUserId)?.EmployeeId,
                    redactedActorIds.Contains(s.ActorUserId) ? null : s.Remarks,
                    s.Timestamp, BuildStepName(s.Stage, s.Action), index + 1))
                .ToList()));
    }

    private sealed record ActorInfo(string Name, string? EmployeeId);

    /// <summary>
    /// Name and EmployeeId per distinct actor on this timeline, looked up
    /// once per actor rather than per step -- mirrors
    /// <see cref="GetOfficeRoleActorIdsAsync"/>'s own dedup-first approach.
    /// Missing entirely (rather than a fallback string) for an actor whose
    /// account no longer exists, so the frontend can decide how to render
    /// that case.
    /// </summary>
    private async Task<Dictionary<Guid, ActorInfo>> GetActorNamesAsync(IReadOnlyList<WorkflowStep> steps)
    {
        var result = new Dictionary<Guid, ActorInfo>();
        foreach (var actorId in steps.Select(s => s.ActorUserId).Distinct())
        {
            var user = await userManager.FindByIdAsync(actorId.ToString());
            if (user is not null)
            {
                result[actorId] = new ActorInfo(user.FullName, user.EmployeeId);
            }
        }

        return result;
    }

    /// <summary>
    /// Which of these steps' actors currently hold an office role
    /// (<see cref="OfficeRoles"/>) -- looked up by current role membership
    /// rather than a role recorded on the step itself, since WorkflowStep
    /// does not carry one. Deduplicates actor ids first so a long timeline
    /// with a handful of repeat actors does one lookup per actor, not per
    /// step.
    /// </summary>
    private async Task<HashSet<Guid>> GetOfficeRoleActorIdsAsync(IReadOnlyList<WorkflowStep> steps)
    {
        var result = new HashSet<Guid>();
        foreach (var actorId in steps.Select(s => s.ActorUserId).Distinct())
        {
            var user = await userManager.FindByIdAsync(actorId.ToString());
            if (user is null)
            {
                continue;
            }

            var roles = await userManager.GetRolesAsync(user);
            if (roles.Any(r => OfficeRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
            {
                result.Add(actorId);
            }
        }

        return result;
    }

    [HttpGet("by-request/{requestType}/{requestId}/{phase}")]
    public async Task<ActionResult<WorkflowInstanceResponse>> GetByRequest(
        RequestType requestType, Guid requestId, WorkflowPhase phase)
    {
        var instance = await workflowEngine.GetByRequestAsync(requestType, requestId, phase);
        if (instance is null)
        {
            return NotFound();
        }

        var steps = instance.Steps.OrderBy(s => s.Timestamp).ToList();
        var actorNames = await GetActorNamesAsync(steps);

        return Ok(new WorkflowInstanceResponse(
            instance.Id,
            instance.RequestType,
            instance.RequestId,
            instance.Phase,
            instance.CurrentStage,
            instance.AssignedToUserId,
            steps
                .Select((s, index) => new WorkflowStepResponse(
                    s.Stage, s.Action, s.ActorUserId,
                    actorNames.GetValueOrDefault(s.ActorUserId)?.Name,
                    actorNames.GetValueOrDefault(s.ActorUserId)?.EmployeeId,
                    s.Remarks, s.Timestamp,
                    BuildStepName(s.Stage, s.Action), index + 1))
                .ToList()));
    }

    /// <summary>Display label for a step in the timeline UI.</summary>
    private static string BuildStepName(WorkflowStage stage, WorkflowAction action) => action switch
    {
        WorkflowAction.Raise => "Raised",
        WorkflowAction.UploadSignedCopy => "Indent Raised Uploaded",
        WorkflowAction.Assign => "Assigned to Staff",
        // The stage is worth naming when it says where the request went
        // (ForwardedOSRC, ForwardedDR); for a plain Forwarded it just reads
        // "Forwarded (Forwarded)".
        WorkflowAction.Forward => stage switch
        {
            WorkflowStage.ForwardedOSRC => "Forwarded to Superintendent",
            WorkflowStage.ForwardedDR => "Forwarded to Deputy Registrar",
            _ => "Forwarded",
        },
        WorkflowAction.Approve => "Approved",
        WorkflowAction.Reject => "Rejected",
        WorkflowAction.ForwardToDirector => "Forwarded to Director",
        WorkflowAction.Cancel => "Cancelled",
        _ => action.ToString(),
    };

    /// <summary>
    /// Records that the raiser has uploaded the signed copy, moving the instance
    /// from Raised to SignedCopyUploaded.
    /// </summary>
    /// <remarks>
    /// Every other transition had an endpoint but this one did not, so nothing
    /// could progress past Raised through the API: Assign requires
    /// SignedCopyUploaded, and the whole approval chain hangs off it. The engine
    /// method already existed and was covered by tests that called it directly,
    /// which is why the gap did not surface until the UI drove the real route.
    /// </remarks>
    [HttpPost("{instanceId:guid}/upload-signed-copy")]
    public async Task<IActionResult> UploadSignedCopy(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.UploadSignedCopyAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/assign")]
    public async Task<IActionResult> Assign(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var assigneeId = request.AssigneeUserId ?? userId.Value;
        var instance = await workflowEngine.GetAsync(instanceId);
        if (instance != null && (instance.CurrentStage == API.Domain.Enums.WorkflowStage.AssignedToDealingAssistant || instance.CurrentStage == API.Domain.Enums.WorkflowStage.WithRnCOffice))
        {
            await workflowEngine.AssignAndForwardAsync(instanceId, assigneeId, userId.Value, User.GetRoles(), request.Remarks);
        }
        else
        {
            await workflowEngine.AssignAsync(instanceId, assigneeId, userId.Value, User.GetRoles(), request.Remarks);
        }
        return NoContent();
    }

    // This action has twice been silently reverted to a self-assign-if-
    // omitted fallback by unrelated merges from branches that started before
    // this stricter version existed (the same duplicate-method collision as
    // before, resolved the same way by picking whichever side a 3-way merge
    // happened to keep). Kept the stricter one: the sole real caller
    // (IndentChainActions.jsx's "Assign & Forward" button) already disables
    // itself until an assignee is chosen, so requiring AssigneeUserId
    // explicitly here just turns that existing frontend guarantee into an
    // enforced API contract, rather than silently self-assigning if it were
    // ever omitted. If this reverts again, check for another stale branch.
    [HttpPost("{instanceId:guid}/assign-and-forward")]
    public async Task<IActionResult> AssignAndForward(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        if (request.AssigneeUserId is null)
        {
            return BadRequest("AssigneeUserId is required for assign-and-forward.");
        }

        await workflowEngine.AssignAndForwardAsync(instanceId, request.AssigneeUserId.Value, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpGet("dealing-assistant-options")]
    public async Task<ActionResult<IReadOnlyList<DealingAssistantOptionResponse>>> GetDealingAssistantOptions()
    {
        var staff = await userManager.GetUsersInRoleAsync("RegularStaff");
        return Ok(staff
            .Where(u => u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new DealingAssistantOptionResponse(u.Id, u.FullName, u.UserName ?? u.Id.ToString()))
            .ToList());
    }

    [HttpPost("{instanceId:guid}/forward")]
    public async Task<IActionResult> Forward(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.ForwardAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.ApproveAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.RejectAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/return")]
    public async Task<IActionResult> Return(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.ReturnAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/forward-to-director")]
    public async Task<IActionResult> ForwardToDirector(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.ForwardToDirectorAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid instanceId, WorkflowActionRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.CancelAsync(instanceId, userId.Value, User.GetRoles(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/undo")]
    public async Task<IActionResult> Undo(Guid instanceId)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.UndoLastActionAsync(instanceId, userId.Value);
        return NoContent();
    }

    [HttpGet("{instanceId:guid}/queries")]
    public async Task<ActionResult<IReadOnlyList<WorkflowQueryResponse>>> ListQueries(Guid instanceId)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // Always internal: an office/RnC caller sees every query on this
        // instance; a PI/HOD caller (the same population WorkflowController.Get
        // already filters WorkflowSteps for) sees none at all -- queries never
        // surface to them, mirroring WorkflowStep.IsInternal's default.
        var instance = await workflowEngine.GetAsync(instanceId);
        if (instance is null)
        {
            return NotFound();
        }

        if (instance.RequestType == RequestType.ResearchProposal)
        {
            var ownership = await proposalService.GetOwnershipAsync(instance.RequestId);
            if (ownership is { } owned)
            {
                var isOwner = owned.OwnerUserId == userId.Value;
                var isDepartmentHod = false;
                if (!isOwner && User.GetRoles().Contains("HOD", StringComparer.OrdinalIgnoreCase))
                {
                    var callerDepartmentId = await userDepartment.GetDepartmentIdAsync(userId.Value);
                    isDepartmentHod = callerDepartmentId == owned.DepartmentId;
                }

                if (isOwner || isDepartmentHod)
                {
                    return Ok(Array.Empty<WorkflowQueryResponse>());
                }
            }
        }

        var queries = await workflowEngine.ListQueriesAsync(instanceId);
        return Ok(queries.Select(q => new WorkflowQueryResponse(
            q.Id, q.AskedByUserId, q.AskedOfUserId, q.Question, q.AskedAt, q.Answer, q.AnsweredAt)).ToList());
    }

    [HttpPost("{instanceId:guid}/queries")]
    public async Task<ActionResult<WorkflowQueryResponse>> AskQuery(Guid instanceId, AskQueryRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // The asker must themselves already be an actor on this instance --
        // symmetric with the target check AskQueryAsync itself enforces.
        var instance = await workflowEngine.GetAsync(instanceId);
        if (instance is null)
        {
            return NotFound();
        }
        if (!instance.Steps.Any(s => s.ActorUserId == userId.Value))
        {
            return Forbid();
        }

        var query = await workflowEngine.AskQueryAsync(instanceId, userId.Value, request.AskedOfUserId, request.Question);
        return Ok(new WorkflowQueryResponse(
            query.Id, query.AskedByUserId, query.AskedOfUserId, query.Question, query.AskedAt, query.Answer, query.AnsweredAt));
    }

    [HttpPost("queries/{queryId:guid}/answer")]
    public async Task<IActionResult> AnswerQuery(Guid queryId, AnswerQueryRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await workflowEngine.AnswerQueryAsync(queryId, userId.Value, request.Answer);
        return NoContent();
    }
}
