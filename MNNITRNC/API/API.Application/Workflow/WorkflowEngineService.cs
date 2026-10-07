using API.Application.Common;
using API.Application.Notifications;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Application.Workflow;

/// <summary>
/// Drives workflow instances along the route stored in
/// <see cref="WorkflowDefinition"/>.
/// </summary>
/// <remarks>
/// The route used to live here, as a static ForwardChain dictionary plus a
/// DecisionStages set. It is now read per (RequestType, Phase) from the
/// database, which is what lets a SuperAdmin change it without a redeploy.
///
/// <paramref name="definitions"/> is optional so that constructing the engine
/// with only a DbContext keeps working. That is not merely a convenience for
/// tests: the phase's regression bar is that the existing suite passes
/// unmodified, and a required parameter would have forced edits to eight call
/// sites, turning "the tests still pass" into "the tests were changed until
/// they passed". The default builds the real service over the same context, so
/// nothing is stubbed out.
/// </remarks>
public class WorkflowEngineService(
    IApplicationDbContext db,
    IWorkflowDefinitionService? definitions = null,
    IApprovalNotificationService? notifications = null,
    IWorkflowRequesterResolver? requesterResolver = null,
    IOptions<EmailOptions>? emailOptions = null) : IWorkflowEngineService
{
    private readonly IWorkflowDefinitionService _definitions =
        definitions ?? new WorkflowDefinitionService(db);
    private readonly IApprovalNotificationService? _notifications = notifications;
    private readonly IWorkflowRequesterResolver? _requesterResolver = requesterResolver;
    private readonly IOptions<EmailOptions>? _emailOptions = emailOptions;

    private static readonly HashSet<WorkflowStage> TerminalStages =
        [WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled, WorkflowStage.IndentApproved];

    public async Task<WorkflowInstance> RaiseAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, Guid actorUserId, CancellationToken ct = default)
    {
        // Resolved from the route's IsInitial stage rather than hardcoded.
        // Latent since Phase 7: every route until the research proposal chain
        // happened to use Raised as its first stage, so nothing exposed that
        // RaiseAsync never actually consulted the route -- ReturnAsync's
        // re-entry fallback already did (line ~151), which is what made the
        // gap visible once a route with a genuinely different initial stage
        // (Draft) existed. Every shipped route's initial stage is still Raised,
        // so this changes no route's observed behaviour.
        var definition = await _definitions.GetAsync(requestType, phase, ct);
        var initial = definition.Stages.FirstOrDefault(s => s.IsInitial)
            ?? throw new WorkflowConfigurationException(
                $"The workflow definition for '{requestType}' ({phase}) has no initial stage.");

        var stageToUse = (initial.Stage == WorkflowStage.WithPIFellowship && requestType != RequestType.FellowshipClaim)
            ? WorkflowStage.Raised
            : initial.Stage;

        var instance = new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = requestType,
            RequestId = requestId,
            Phase = phase,
            CurrentStage = stageToUse,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.WorkflowInstances.Add(instance);
        AppendStep(instance, WorkflowAction.Raise, actorUserId, null);
        await db.SaveChangesAsync(ct);
        return instance;
    }

    public async Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId, CancellationToken ct = default)
    {
        return await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == workflowInstanceId, ct);
    }

    public async Task<WorkflowInstance?> GetByRequestAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, CancellationToken ct = default)
    {
        return await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.RequestType == requestType && w.RequestId == requestId && w.Phase == phase, ct);
    }

    public async Task UploadSignedCopyAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        
        // If already at HOD stage (signed copy already uploaded), this is idempotent
        if (instance.CurrentStage == WorkflowStage.IndentWithHOD)
        {
            return;
        }
        
        // Check if at the initial raise stage OR already at SignedCopyUploaded (legacy indents)
        var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);
        var initialStage = definition.Stages.FirstOrDefault(s => s.IsInitial)?.Stage ?? WorkflowStage.Raised;
        
        // Allow upload from initial Raised stage, WithPIFellowship, WithPITravel (re-upload), or SignedCopyUploaded (legacy)
        bool isValidStage = instance.CurrentStage == initialStage || 
                           instance.CurrentStage == WorkflowStage.WithPIFellowship ||
                           instance.CurrentStage == WorkflowStage.WithPITravel ||
                           instance.CurrentStage == WorkflowStage.SignedCopyUploaded;  // Legacy stage
        
        if (!isValidStage)
        {
            RequireStage(instance, initialStage, WorkflowAction.UploadSignedCopy);
        }
        
        // If the actor is the one who raised the request, they can re-upload the signed copy
        var isRaiser = instance.Steps.Any(s => s.Action == WorkflowAction.Raise && s.ActorUserId == actorUserId);
        if (!isRaiser)
        {
            await RequireRoleAsync(instance, actorUserId, actorRoles, ct);
        }

        // For DynamicIndent and other indent workflows, skip SignedCopyUploaded and go directly to IndentWithHOD
        if (instance.RequestType == RequestType.DynamicIndent || 
            instance.RequestType == RequestType.Consumable || 
            instance.RequestType == RequestType.Equipment || 
            instance.RequestType == RequestType.Contingency)
        {
            // Record the upload action
            AppendStep(instance, WorkflowAction.UploadSignedCopy, actorUserId, remarks);
            
            // Auto-transition directly to IndentWithHOD for pending approval
            instance.CurrentStage = WorkflowStage.IndentWithHOD;
        }
        else if (instance.RequestType == RequestType.Travel)
        {
            AppendStep(instance, WorkflowAction.UploadSignedCopy, actorUserId, remarks);
            
            // If the actor is a Faculty (PI), they upload their own request → go directly to HOD (SignedCopyUploaded).
            // If the actor is a Fellow/Manpower, they upload → goes to PI stage first (WithPITravel).
            var isPI = actorRoles.Contains("Faculty", StringComparer.OrdinalIgnoreCase);
            instance.CurrentStage = isPI
                ? WorkflowStage.SignedCopyUploaded
                : WorkflowStage.WithPITravel;
        }
        else
        {
            // For other request types, use the traditional SignedCopyUploaded stage
            instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
            AppendStep(instance, WorkflowAction.UploadSignedCopy, actorUserId, remarks);
        }
        
        await db.SaveChangesAsync(ct);
    }

    public async Task AssignAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        
        // Allow assign from new indent-specific stages
        bool isValidStage = instance.CurrentStage == WorkflowStage.IndentWithRnCOffice ||
                           instance.CurrentStage == WorkflowStage.IndentWithSuperintendent ||
                           // Legacy stages for backward compatibility
                           instance.CurrentStage == WorkflowStage.SignedCopyUploaded ||
                           instance.CurrentStage == WorkflowStage.WithHOD ||
                           instance.CurrentStage == WorkflowStage.WithRnCOffice ||
                           instance.CurrentStage == WorkflowStage.AssignedToDealingAssistant;
        
        if (!isValidStage)
        {
            throw new WorkflowTransitionException(
                $"Cannot perform 'Assign' on a workflow instance in stage '{instance.CurrentStage}'.");
        }
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        // For new indent workflows, assigning doesn't change the stage - it just records the assignee
        if (instance.CurrentStage == WorkflowStage.IndentWithRnCOffice ||
            instance.CurrentStage == WorkflowStage.IndentWithSuperintendent)
        {
            // Just set the assignee, don't transition yet
            instance.AssignedToUserId = assigneeUserId;
        }
        // Legacy logic for old stages
        else if (instance.CurrentStage == WorkflowStage.SignedCopyUploaded)
        {
            instance.CurrentStage = WorkflowStage.Assigned;
        }
        else if (instance.CurrentStage == WorkflowStage.WithRnCOffice)
        {
            instance.CurrentStage = WorkflowStage.AssignedToDealingAssistant;
        }
        else
        {
            instance.AssignedToUserId = assigneeUserId;
        }

        AppendStep(instance, WorkflowAction.Assign, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task AssignAndForwardAsync(
        Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId,
        IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        var next = await _definitions.GetNextStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);
        if (next is null)
        {
            throw new WorkflowTransitionException(
                $"Cannot assign a workflow instance in stage '{instance.CurrentStage}': nowhere to advance it to.");
        }

        instance.AssignedToUserId = assigneeUserId;
        instance.CurrentStage = next.Stage;
        AppendStep(instance, WorkflowAction.Assign, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ForwardAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        // Special case: WithPITravel is a runtime-injected PI-review stage for
        // Fellow-raised travel requests. It is not part of the DB-seeded route so
        // GetStageAsync would fail. RequireRoleAsync also calls GetStageAsync, so
        // we do the role check inline: only Faculty (PI) or HOD may forward.
        if (instance.CurrentStage == WorkflowStage.WithPITravel)
        {
            bool isAllowed = actorRoles.Any(r =>
                r.Equals("Faculty", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("HOD", StringComparison.OrdinalIgnoreCase));
            if (!isAllowed)
                throw new WorkflowAuthorizationException(
                    $"This action at stage '{instance.CurrentStage}' (PI / Faculty) is permitted to: Faculty, HOD.");
            if (string.IsNullOrWhiteSpace(remarks))
                throw new WorkflowTransitionException(
                    "A remark is required when forwarding this request.");
            instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
            AppendStep(instance, WorkflowAction.Forward, actorUserId, remarks);
            await db.SaveChangesAsync(ct);
            return;
        }

        // The next stage is the following row by sequence. A stage that can
        // conclude is the end of the road for Forward -- previously expressed by
        // ForwardedDR simply being absent from the ForwardChain dictionary.
        var current = await _definitions.GetStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);

        // ForwardOverrideSequence exists for branch stages sitting off the main
        // line (e.g. the research proposal chain's ReturnedToPI): "next by
        // sequence" would find nothing there, or the wrong thing, so the stage
        // says explicitly where its own Forward rejoins the route.
        WorkflowStageDefinition? next;
        if (current.CanApprove)
        {
            next = null;
        }
        else if (current.ForwardOverrideSequence is { } overrideSequence)
        {
            var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);

            // A return-origin exception overrides the stage's own static
            // ForwardOverrideSequence when the instance was sent here by a
            // specific returning stage (e.g. the research proposal chain's
            // ReturnedToPI rejoins at WithHOD, not AssignedToDealingAssistant,
            // when HOD itself issued the Return).
            var overrideMap = current.ForwardOverrideSequenceByReturnOriginMap();
            if (instance.ReturnedFromStage is { } returnedFrom && overrideMap.TryGetValue(returnedFrom, out var originSpecificSequence))
            {
                overrideSequence = originSpecificSequence;
            }

            next = definition.Stages.SingleOrDefault(s => s.Sequence == overrideSequence)
                ?? throw new WorkflowConfigurationException(
                    $"Stage '{current.Stage}' has ForwardOverrideSequence {overrideSequence}, but the route for "
                    + $"'{instance.RequestType}' ({instance.Phase}) has no stage at that sequence.");
        }
        else
        {
            next = await _definitions.GetNextStageAsync(
                instance.RequestType, instance.Phase, instance.CurrentStage, ct);
        }

        // Checked before the role, so that forwarding from a stage with nowhere
        // to forward to reports the dead end rather than blaming the actor's
        // roles. "Is this action possible here" precedes "may this actor do it";
        // the reverse order told a Dean at ForwardedDR they lacked a role, when
        // no role would have helped.
        if (next is null)
        {
            throw new WorkflowTransitionException(
                $"Cannot Forward a workflow instance in stage '{instance.CurrentStage}'.");
        }

        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        bool isPiOwnedStage = string.IsNullOrEmpty(current.AllowedRoles);
        // isHod restored: silently dropped in commit 93b7188 (an unrelated
        // "project service + reappropriation history UI" commit), leaving
        // WorkflowMandatoryRemarksTests and this method's own callers
        // documenting a rule the code no longer enforced.
        bool isHod = actorRoles.Any(r => r.Equals("HOD", StringComparison.OrdinalIgnoreCase));
        if ((isPiOwnedStage || isHod) && string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when forwarding this request.");
        }

        instance.CurrentStage = next.Stage;
        instance.ReturnedFromStage = null; // consumed -- never leaks into a later, unrelated Return/Forward cycle
        AppendStep(instance, WorkflowAction.Forward, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        await RequireStageCanAsync(instance, s => s.CanApprove, WorkflowAction.Approve, ct);
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        // Get the current stage definition to find the next stage
        var current = await _definitions.GetStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);

        // Determine the next stage
        // If current stage has ForwardOverrideSequence, use that
        WorkflowStageDefinition? next;
        if (current.ForwardOverrideSequence is { } overrideSequence)
        {
            var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);
            next = definition.Stages.SingleOrDefault(s => s.Sequence == overrideSequence)
                ?? throw new WorkflowConfigurationException(
                    $"Stage '{current.Stage}' has ForwardOverrideSequence {overrideSequence}, but the route for "
                    + $"'{instance.RequestType}' ({instance.Phase}) has no stage at that sequence.");
        }
        else
        {
            next = await _definitions.GetNextStageAsync(
                instance.RequestType, instance.Phase, instance.CurrentStage, ct);
        }

        // Director sits after ForwardedDR by sequence in the shipped indent
        // route, but it is not the next mandatory step in ForwardedDR's own
        // approval chain -- it is a separate, optional escalation reached
        // only through the dedicated ForwardToDirectorAsync action. Treating
        // it as "next" here would silently reroute a Dean's own approval into
        // a second, unwanted Director sign-off instead of concluding it.
        // Multi-hop routes (e.g. fellowship's WithPIFellowship ->
        // WithHODFellowship -> WithDeanFellowship) still walk normally --
        // this is a point-fix for this one specific branch, not a rule
        // about CanApprove stages in general.
        if (instance.CurrentStage == WorkflowStage.ForwardedDR && next?.Stage == WorkflowStage.Director)
        {
            next = null;
        }

        // NEW: For indent workflows at IndentWithDean stage, check cost threshold
        // If cost ≤ ₹1 Lakh, skip Director stage and go directly to IndentApproved
        if (instance.CurrentStage == WorkflowStage.IndentWithDean && 
            (instance.RequestType == RequestType.Consumable || 
             instance.RequestType == RequestType.Equipment || 
             instance.RequestType == RequestType.Contingency ||
             instance.RequestType == RequestType.DynamicIndent))
        {
            // Fetch the indent to check its total cost
            // All indent types (DynamicIndent, Consumable, Equipment, Contingency) use the Indent table
            var indent = await db.Indents
                .Include(i => i.Items)
                .Where(i => i.Id == instance.RequestId)
                .FirstOrDefaultAsync(ct);

            // If cost ≤ ₹1 Lakh, skip Director and go to IndentApproved
            if (indent != null)
            {
                var totalCost = indent.Items.Sum(item => item.EstimatedCostInclTax);
                if (totalCost <= 100_000m)
                {
                    next = null;  // Force approval, skipping Director stage
                }
            }
        }

        // If no next stage found, transition to Approved
        if (next is null)
        {
            instance.CurrentStage = WorkflowStage.Approved;
        }
        else
        {
            instance.CurrentStage = next.Stage;
        }

        AppendStep(instance, WorkflowAction.Approve, actorUserId, remarks);
        await db.SaveChangesAsync(ct);

        // IndentApproved is the indent route's own terminal-approved stage,
        // distinct from the generic Approved every other route uses -- see
        // this file's own DescribeStage-equivalent mapping and
        // IndentServiceBase's own two guards, both of which already treat
        // Approved and IndentApproved as the same outcome. A Director-level
        // (>1L) indent approval lands on IndentApproved, not Approved, so
        // checking Approved alone would silently never notify on that path.
        if (instance.CurrentStage is WorkflowStage.Approved or WorkflowStage.IndentApproved)
        {
            await NotifyRequesterAsync(instance, "approved", ct);
        }

        // Bill-phase workflows are a separate WorkflowInstance layered on
        // top of an already-approved Indent's own Indent-phase instance
        // (see IndentServiceBase.ProcessBillAsync). Reaching Approved here
        // is the actual "money paid" event -- the Indent-phase Approved
        // above is only the commit. This must not also fire for the
        // Indent-phase Approved/IndentApproved transition itself.
        if (instance.Phase == WorkflowPhase.Bill && instance.CurrentStage == WorkflowStage.Approved)
        {
            await RecordExpenditureAsync(instance, ct);
        }
    }

    public async Task RejectAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when rejecting this request.");
        }

        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        await RequireStageCanAsync(instance, s => s.CanReject, WorkflowAction.Reject, ct);
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        instance.CurrentStage = WorkflowStage.Rejected;
        AppendStep(instance, WorkflowAction.Reject, actorUserId, remarks);
        await db.SaveChangesAsync(ct);

        await NotifyRequesterAsync(instance, "rejected", ct);
    }

    public async Task ReturnAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when returning this request.");
        }

        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        // Special case: WithPITravel is a runtime-injected stage not in the DB route.
        // RequireStageCanAsync and RequireRoleAsync both call GetStageAsync which would
        // fail. The PI can return a Fellow's request directly to Raised.
        if (instance.CurrentStage == WorkflowStage.WithPITravel)
        {
            bool isAllowed = actorRoles.Any(r =>
                r.Equals("Faculty", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("HOD", StringComparison.OrdinalIgnoreCase));
            if (!isAllowed)
                throw new WorkflowAuthorizationException(
                    $"This action at stage '{instance.CurrentStage}' (PI / Faculty) is permitted to: Faculty, HOD.");
            instance.CurrentStage = WorkflowStage.Raised;
            AppendStep(instance, WorkflowAction.Return, actorUserId, remarks);
            await db.SaveChangesAsync(ct);
            return;
        }

        await RequireStageCanAsync(instance, s => s.CanReturn, WorkflowAction.Return, ct);
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);

        // Null ResubmitEntrySequence is every route shipped before this action
        // existed, so falling back to the initial stage reproduces "restart at
        // step 1" exactly rather than introducing a new default.
        var reentry = definition.ResubmitEntrySequence is { } sequence
            ? definition.Stages.FirstOrDefault(s => s.Sequence == sequence)
            : definition.Stages.FirstOrDefault(s => s.IsInitial);

        if (reentry is null)
        {
            throw new WorkflowConfigurationException(
                $"The workflow definition for '{instance.RequestType}' ({instance.Phase}) has no stage at its "
                + $"configured resubmit entry point (sequence {definition.ResubmitEntrySequence}). "
                + "An instance returned here cannot proceed.");
        }

        instance.ReturnedFromStage = instance.CurrentStage;
        instance.CurrentStage = reentry.Stage;
        AppendStep(instance, WorkflowAction.Return, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ForwardToDirectorAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        if (instance.CurrentStage != WorkflowStage.ForwardedDR && instance.CurrentStage != WorkflowStage.IndentWithDean)
        {
            throw new WorkflowTransitionException(
                $"Cannot perform '{WorkflowAction.ForwardToDirector}' on a workflow instance in stage '{instance.CurrentStage}' (requires '{WorkflowStage.ForwardedDR}' or '{WorkflowStage.IndentWithDean}').");
        }
        await RequireRoleAsync(instance, actorUserId, actorRoles, ct);

        instance.CurrentStage = WorkflowStage.Director;
        AppendStep(instance, WorkflowAction.ForwardToDirector, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task CancelAsync(Guid workflowInstanceId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        if (TerminalStages.Contains(instance.CurrentStage))
        {
            throw new WorkflowTransitionException(
                $"Cannot Cancel a workflow instance already in terminal stage '{instance.CurrentStage}'.");
        }

        instance.CurrentStage = WorkflowStage.Cancelled;
        AppendStep(instance, WorkflowAction.Cancel, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task<WorkflowQuery> AskQueryAsync(
        Guid workflowInstanceId, Guid askedByUserId, Guid askedOfUserId, string question, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        if (!instance.Steps.Any(s => s.ActorUserId == askedOfUserId))
        {
            throw new QueryTargetNotAnActorException(workflowInstanceId, askedOfUserId);
        }

        // Queries are always internal -- never surfaced to the PI (mirrors
        // WorkflowController.Get/ListQueries' own IsInternal-style filtering).
        // The PI is technically an "actor" on their own instance (their Raise
        // step), so without this check the actor-history test above would
        // wrongly let a query be addressed to them -- one they could then
        // never see via ListQueries, but could still answer via
        // AnswerQueryAsync, silently breaking the "always internal" invariant.
        if (instance.RequestType == RequestType.ResearchProposal)
        {
            var isPi = await db.ResearchProposals
                .AnyAsync(p => p.Id == instance.RequestId && p.OwnerUserId == askedOfUserId, ct);
            if (isPi)
            {
                throw new QueryTargetNotAnActorException(workflowInstanceId, askedOfUserId);
            }
        }

        var query = new WorkflowQuery
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = workflowInstanceId,
            AskedByUserId = askedByUserId,
            AskedOfUserId = askedOfUserId,
            Question = question,
            AskedAt = DateTimeOffset.UtcNow,
        };

        db.WorkflowQueries.Add(query);
        await db.SaveChangesAsync(ct);
        return query;
    }

    public async Task AnswerQueryAsync(Guid queryId, Guid actorUserId, string answer, CancellationToken ct = default)
    {
        var query = await db.WorkflowQueries.FirstOrDefaultAsync(q => q.Id == queryId, ct)
            ?? throw new WorkflowTransitionException($"Query '{queryId}' was not found.");

        if (query.AskedOfUserId != actorUserId)
        {
            throw new NotTheQueryRecipientException(queryId);
        }

        query.Answer = answer;
        query.AnsweredAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<WorkflowQuery>> ListQueriesAsync(Guid workflowInstanceId, CancellationToken ct = default)
    {
        return await db.WorkflowQueries
            .Where(q => q.WorkflowInstanceId == workflowInstanceId)
            .OrderBy(q => q.AskedAt)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Asserts the actor holds at least one of the roles the current stage
    /// permits.
    /// </summary>
    /// <remarks>
    /// An empty AllowedRoles means the stage is not role-restricted, not that
    /// nobody may act: the initial stage carries no roles because it belongs to
    /// whoever raised the request. Reading it the other way would make
    /// upload-signed-copy impossible for everyone and strand every instance at
    /// Raised.
    ///
    /// The comparison is case-insensitive because ASP.NET Identity treats role
    /// names that way, so a claim spelled "dean" must not be silently refused.
    ///
    /// It is an intersection, not a superset test: a user carries every role
    /// they hold, and a stage may list several alternatives.
    /// </remarks>
    /// <summary>
    /// Roles AssignedToUserId does not narrow at <see cref="WorkflowStage.AssignedToDealingAssistant"/>:
    /// a Superintendent, DeputyRegistrar or Dean retains the ability to act
    /// there regardless of who it is assigned to, since they sit above the
    /// assignee in the chain rather than being an alternative pool assignment
    /// picks from. RegularStaff is deliberately absent -- that is the pool
    /// AssignAndForwardAsync actually assigns a specific person out of.
    /// </summary>
    internal static readonly HashSet<string> RolesNotNarrowedByAssignment =
        new(StringComparer.OrdinalIgnoreCase) { "Superintendent", "DeputyRegistrar", "Dean" };

    /// <summary>
    /// Stages where a MANUALLY set AssignedToUserId (AssignAsync /
    /// AssignAndForwardAsync, IsAssignedViaProjectDa == false) restricts who
    /// may act -- the pre-DA-feature rule, preserved unchanged.
    /// </summary>
    /// <remarks>
    /// AssignedToUserId is never cleared once a manual assign sets it, so it
    /// is still populated at every later stage of an instance's life. Only
    /// AssignedToDealingAssistant was ever meant to be restricted by a manual
    /// assignment; widening that would silently start blocking other
    /// RegularStaff at later stages of unrelated instances. DA-originated
    /// assignments (IsAssignedViaProjectDa) narrow at every
    /// RegularStaff-listed stage instead.
    /// </remarks>
    private static readonly HashSet<WorkflowStage> StagesNarrowedByAssignmentManually =
        [WorkflowStage.AssignedToDealingAssistant];

    private async Task RequireRoleAsync(
        WorkflowInstance instance,
        Guid actorUserId,
        IReadOnlyCollection<string> actorRoles,
        CancellationToken ct)
    {
        var current = await _definitions.GetStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);

        var allowed = current.AllowedRoleList();
        if (allowed.Count == 0)
        {
            return;
        }

        if (!actorRoles.Any(r => allowed.Contains(r, StringComparer.OrdinalIgnoreCase)))
        {
            throw new WorkflowAuthorizationException(
                $"This action at stage '{instance.CurrentStage}' ({GetStageFriendlyName(instance.CurrentStage)}) is permitted to: " +
                $"{string.Join(", ", allowed)}.");
        }

        // Assignment narrows the field to one specific person, but only at
        // stages it is actually meant to govern, and only among roles it
        // actually assigns out of -- an actor whose roles include one of
        // RolesNotNarrowedByAssignment passes regardless of AssignedToUserId.
        // Generalized from a hardcoded single-stage set: any stage whose
        // AllowedRoles includes RegularStaff is narrowed once
        // AssignedToUserId is set -- covers AssignedToDealingAssistant,
        // IndentAssignedToDA, IndentWithRnCOffice, WithRnCOffice,
        // WithRnCOfficeGrantReceipt, WithDAFellowship, and any future
        // RegularStaff stage, with no per-stage hand-listing required.
        // Scoped to DA-originated assignments only (IsAssignedViaProjectDa):
        // a manual per-instance Assign/AssignAndForward also sets
        // AssignedToUserId, and must keep exactly its pre-existing behaviour
        // -- which narrowed at StagesNarrowedByAssignmentManually
        // (AssignedToDealingAssistant) and nowhere else.
        var narrowedHere =
            StagesNarrowedByAssignmentManually.Contains(instance.CurrentStage)
            || (instance.IsAssignedViaProjectDa
                && allowed.Contains("RegularStaff", StringComparer.OrdinalIgnoreCase));
        if (narrowedHere
            && instance.AssignedToUserId is { } assignedTo
            && assignedTo != actorUserId
            && !actorRoles.Any(r => RolesNotNarrowedByAssignment.Contains(r)))
        {
            throw new WorkflowAuthorizationException(
                $"This workflow at stage '{instance.CurrentStage}' ({GetStageFriendlyName(instance.CurrentStage)}) is assigned to a specific person; " +
                "only they (or Superintendent/DeputyRegistrar/Dean) may act on it here.");
        }
    }

    private static string GetStageFriendlyName(WorkflowStage stage) => stage switch
    {
        WorkflowStage.Raised or WorkflowStage.Draft or WorkflowStage.WithPIFellowship or WorkflowStage.WithPIAdvertisement or WorkflowStage.ReturnedToPI or WorkflowStage.ReturnedByHODToPI or WorkflowStage.ReturnedByDeanToPI or WorkflowStage.WithPITravel => "PI / Faculty",
        WorkflowStage.SignedCopyUploaded or WorkflowStage.WithHOD or WorkflowStage.WithHODFellowship or WorkflowStage.WithHODGrantReceipt or WorkflowStage.IndentWithHOD => "HOD",
        WorkflowStage.Assigned or WorkflowStage.AssignedToDealingAssistant or WorkflowStage.IndentAssignedToDA or WorkflowStage.AssignedToDAGrantReceipt => "Clerk / RegularStaff",
        WorkflowStage.Forwarded or WorkflowStage.WithSuperintendent or WorkflowStage.WithRnCOffice or WorkflowStage.WithRnCOfficeGrantReceipt or WorkflowStage.IndentWithRnCOffice or WorkflowStage.IndentWithSuperintendent or WorkflowStage.WithSuperintendentGrantReceipt => "OSRC / Superintendent R&C",
        WorkflowStage.ForwardedOSRC or WorkflowStage.WithDeputyRegistrar or WorkflowStage.IndentWithDeputyRegistrar or WorkflowStage.WithDeputyRegistrarGrantReceipt => "DR / Deputy Registrar",
        WorkflowStage.ForwardedDR or WorkflowStage.Director or WorkflowStage.WithDean or WorkflowStage.WithDeanFellowship or WorkflowStage.WithDeanGrantReceipt or WorkflowStage.IndentWithDean => "Dean",
        WorkflowStage.Approved or WorkflowStage.IndentApproved => "Approved",
        WorkflowStage.Rejected => "Rejected",
        WorkflowStage.Cancelled => "Cancelled",
        _ => stage.ToString()
    };

    private async Task<WorkflowInstance> RequireInstanceAsync(Guid workflowInstanceId, CancellationToken ct)
    {
        var instance = await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == workflowInstanceId, ct);

        if (instance is null)
        {
            throw new WorkflowTransitionException($"Workflow instance '{workflowInstanceId}' was not found.");
        }

        return instance;
    }

    /// <summary>
    /// Asserts that the instance's current stage permits an action, according to
    /// the stored route rather than a hardcoded set of stages.
    /// </summary>
    /// <remarks>
    /// The message still names the stages that would allow the action, which the
    /// old DecisionStages version could do trivially. Here it means reading them
    /// off the definition -- worth the extra work, because "you cannot approve
    /// from Assigned" is far less useful without "approval happens at
    /// ForwardedDR or Director".
    /// </remarks>
    private async Task RequireStageCanAsync(
        WorkflowInstance instance,
        Func<WorkflowStageDefinition, bool> permits,
        WorkflowAction attemptedAction,
        CancellationToken ct)
    {
        var current = await _definitions.GetStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);

        if (permits(current))
        {
            return;
        }

        var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);
        var permitted = definition.Stages
            .Where(permits)
            .OrderBy(s => s.Sequence)
            .Select(s => s.Stage.ToString())
            .ToList();

        throw new WorkflowTransitionException(
            $"Cannot perform '{attemptedAction}' on a workflow instance in stage '{instance.CurrentStage}' " +
            $"(requires one of: {string.Join(", ", permitted)}).");
    }

    private static void RequireStage(WorkflowInstance instance, WorkflowStage requiredStage, WorkflowAction attemptedAction)
    {
        if (instance.CurrentStage != requiredStage)
        {
            throw new WorkflowTransitionException(
                $"Cannot perform '{attemptedAction}' on a workflow instance in stage '{instance.CurrentStage}' (requires '{requiredStage}').");
        }
    }

    public async Task UndoLastActionAsync(Guid workflowInstanceId, Guid actorUserId, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        var orderedSteps = instance.Steps
            .Where(s => !s.IsUndone)
            .OrderBy(s => s.Timestamp)
            .ToList();

        if (orderedSteps.Count == 0)
        {
            throw new CannotUndoException("There is no action on this instance to undo.");
        }

        var last = orderedSteps[^1];

        if (last.ActorUserId != actorUserId)
        {
            throw new CannotUndoException("Only the person who performed the last action may undo it.");
        }

        var definition = await _definitions.GetAsync(instance.RequestType, instance.Phase, ct);
        var previousStage = orderedSteps.Count >= 2
            ? orderedSteps[^2].Stage
            : definition.Stages.First(s => s.IsInitial).Stage;

        last.IsUndone = true;
        last.UndoneAt = DateTimeOffset.UtcNow;
        instance.CurrentStage = previousStage;

        if (last.Action == WorkflowAction.Return)
        {
            instance.ReturnedFromStage = null;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Every template's shared placeholder pair, present on every
    /// EmailTemplateCatalogue entry -- excluded when deriving each prefix's
    /// module-specific second placeholder below.
    /// </summary>
    private static readonly HashSet<string> CommonPlaceholders = ["RequesterName", "PortalLink"];

    /// <summary>
    /// Derives the module-specific second placeholder name from
    /// EmailTemplateCatalogue itself -- the "approved" template's one
    /// placeholder that isn't RequesterName/PortalLink -- rather than a
    /// hand-maintained switch that could silently drift from the catalogue
    /// if a template's placeholder were ever renamed there. Both outcome
    /// templates for a prefix (approved/rejected) are seeded with the same
    /// placeholder set, so reading the "approved" one is sufficient.
    /// </summary>
    private static string? DisplayTitlePlaceholderFor(string prefix) =>
        EmailTemplateCatalogue.Find($"{prefix}.approved")?.Placeholders
            .FirstOrDefault(p => !CommonPlaceholders.Contains(p));

    /// <summary>
    /// Emails the requester on a terminal approval or a rejection. Recruitment's
    /// two RequestTypes (ManpowerDocument, Advertisement) resolve to a null
    /// prefix/requester and are silently skipped -- Recruitment's approval flow
    /// is out of scope for this feature. A missing requester (a data integrity
    /// problem) is likewise skipped silently rather than thrown, so it never
    /// blocks the approval/rejection that already succeeded and was already
    /// saved above this call.
    /// </summary>
    private async Task NotifyRequesterAsync(WorkflowInstance instance, string outcomeSuffix, CancellationToken ct)
    {
        if (_notifications is null || _requesterResolver is null)
        {
            return;
        }

        var prefix = _requesterResolver.ResolveTemplateKeyPrefix(instance.RequestType);
        if (prefix is null)
        {
            return;
        }

        var requesterUserId = await _requesterResolver.ResolveRequesterUserIdAsync(
            instance.RequestType, instance.RequestId, ct);
        if (requesterUserId is null)
        {
            return;
        }

        var requester = await db.Users.FirstOrDefaultAsync(u => u.Id == requesterUserId.Value, ct);
        if (requester is null)
        {
            return;
        }

        var variables = new Dictionary<string, string>
        {
            ["RequesterName"] = requester.FullName,
            ["PortalLink"] = _emailOptions?.Value.PortalBaseUrl ?? string.Empty,
        };

        var placeholder = DisplayTitlePlaceholderFor(prefix);
        if (placeholder is not null)
        {
            // Always supplied, even when the resolver can't find a real
            // value (e.g. an indent with no number yet, a grant receipt
            // whose project went missing) -- a fallback keeps the rendered
            // email free of a literal, un-substituted {{Placeholder}}
            // token, which would otherwise ship to the recipient and be
            // replayed verbatim by EmailLog's Resend action.
            var displayTitle = await _requesterResolver.ResolveDisplayTitleAsync(
                instance.RequestType, instance.RequestId, ct);
            variables[placeholder] = displayTitle ?? "your request";
        }

        await _notifications.NotifyAsync(
            $"{prefix}.{outcomeSuffix}", requester, variables,
            instance.RequestType.ToString(), instance.RequestId, ct);
    }

    /// <summary>
    /// Fires when a Bill-phase workflow instance (see ApproveAsync's
    /// caller) reaches Approved -- the point real money has been paid.
    /// Resolves the underlying indent by RequestType (the same 1:1
    /// mapping ConsumableIndentService/ContingencyIndentService/
    /// EquipmentIndentService/the dynamic-indent path already use) and
    /// records an Expenditure row against its BudgetHead, using the
    /// actual billed amount (BillAmount) rather than the original
    /// estimate wherever both exist.
    /// </summary>
    private async Task RecordExpenditureAsync(WorkflowInstance instance, CancellationToken ct)
    {
        Guid projectId;
        Guid? budgetHeadId;
        decimal amount;
        DateOnly transactionDate;
        string? billNo;

        switch (instance.RequestType)
        {
            case RequestType.Consumable:
                var consumable = await db.ConsumableIndents.FirstOrDefaultAsync(i => i.Id == instance.RequestId, ct);
                if (consumable is null) return;
                projectId = consumable.ProjectId;
                budgetHeadId = consumable.BudgetHeadId;
                amount = consumable.BillAmount ?? consumable.EstimatedCost;
                transactionDate = consumable.ItemReceivingDate ?? consumable.GenerationDate ?? DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
                billNo = consumable.OriginalBillReference;
                break;
            case RequestType.Contingency:
                var contingency = await db.ContingencyIndents.FirstOrDefaultAsync(i => i.Id == instance.RequestId, ct);
                if (contingency is null) return;
                projectId = contingency.ProjectId;
                budgetHeadId = contingency.BudgetHeadId;
                amount = contingency.BillAmount ?? contingency.EstimatedCost;
                transactionDate = contingency.ItemReceivingDate ?? contingency.GenerationDate ?? DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
                billNo = contingency.OriginalBillReference;
                break;
            case RequestType.Equipment:
                var equipment = await db.EquipmentIndents.FirstOrDefaultAsync(i => i.Id == instance.RequestId, ct);
                if (equipment is null) return;
                projectId = equipment.ProjectId;
                budgetHeadId = equipment.BudgetHeadId;
                amount = equipment.BillAmount ?? equipment.EstimatedCost;
                transactionDate = equipment.ItemReceivingDate ?? equipment.GenerationDate ?? DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
                billNo = equipment.OriginalBillReference;
                break;
            case RequestType.DynamicIndent:
                var dynamicIndent = await db.Indents.Include(i => i.Items)
                    .FirstOrDefaultAsync(i => i.Id == instance.RequestId, ct);
                if (dynamicIndent is null) return;
                projectId = dynamicIndent.ProjectId;
                budgetHeadId = dynamicIndent.BudgetHeadId;
                amount = dynamicIndent.BillAmount ?? dynamicIndent.Items.Sum(i => i.EstimatedCostInclTax);
                transactionDate = dynamicIndent.ItemReceivingDate ?? dynamicIndent.GenerationDate ?? DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
                billNo = dynamicIndent.BillNo;
                break;
            default:
                return;
        }

        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            SectionType = $"{instance.RequestType} bill {billNo}",
            TransactionDate = transactionDate,
            Amount = amount,
        });
        await db.SaveChangesAsync(ct);
    }

    private void AppendStep(WorkflowInstance instance, WorkflowAction action, Guid actorUserId, string? remarks)
    {
        var step = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = action,
            ActorUserId = actorUserId,
            Remarks = remarks,
            IsInternal = action is not (WorkflowAction.Reject or WorkflowAction.Return),
            Timestamp = DateTimeOffset.UtcNow,
        };

        instance.Steps.Add(step);
        db.WorkflowSteps.Add(step);
    }
}
