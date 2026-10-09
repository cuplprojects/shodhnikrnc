using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Checks a proposed route before it is persisted.
/// </summary>
/// <remarks>
/// These rules are what separate a configurator from a foot-gun. A SuperAdmin
/// editing a route is editing the path live requests are travelling along, and
/// several plausible edits would strand them silently -- a gap in the sequence,
/// a removed stage, a role that does not exist.
///
/// Every rule is evaluated and all failures are returned together, rather than
/// stopping at the first: an operator fixing a route should learn everything
/// wrong with it in one round trip.
/// </remarks>
public class WorkflowDefinitionValidator(
    IApplicationDbContext db,
    IWorkflowRoleCatalogue roles) : IWorkflowDefinitionValidator
{
    /// <summary>Stages an instance can sit on without being "live".</summary>
    private static readonly HashSet<WorkflowStage> TerminalStages =
        [WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled];

    public async Task<IReadOnlyList<string>> ValidateAsync(
        RequestType requestType,
        WorkflowPhase phase,
        IReadOnlyCollection<WorkflowStageDefinition> stages,
        int? resubmitEntrySequence = null,
        CancellationToken ct = default)
    {
        var errors = new List<string>();

        if (stages.Count == 0)
        {
            errors.Add("A workflow definition must have at least one stage.");
            return errors;
        }

        // Rule 1: sequences contiguous from 1. Forwarding resolves the next
        // stage by Sequence + 1, so a gap or duplicate strands an instance.
        var sequences = stages.Select(s => s.Sequence).OrderBy(n => n).ToList();
        if (!sequences.SequenceEqual(Enumerable.Range(1, stages.Count)))
        {
            errors.Add(
                $"Stage sequences must be contiguous starting at 1. Got: {string.Join(", ", sequences)}.");
        }

        // Rule 2: exactly one initial stage, or a raised instance has no
        // defined starting point.
        var initialCount = stages.Count(s => s.IsInitial);
        if (initialCount != 1)
        {
            errors.Add($"A workflow definition must have exactly one initial stage; found {initialCount}.");
        }

        // Rule 3: something must be able to conclude, or every request raised
        // on this route runs to the end and stops there permanently.
        if (!stages.Any(s => s.CanApprove))
        {
            errors.Add("At least one stage must be able to approve, or no request on this route can ever be completed.");
        }

        // Rule 3b: if this route has a resubmit entry point configured,
        // something must be able to return a request for correction, or
        // that entry point can never actually be reached. A route with no
        // ResubmitEntrySequence has no such concept and is not required to
        // have a return-capable stage.
        if (resubmitEntrySequence.HasValue && !stages.Any(s => s.CanReturn))
        {
            errors.Add("At least one stage must be able to return a request, or ReturnAsync can never be invoked on this route.");
        }

        // Rule 3c: every configured resubmit/forward-override target
        // (route-wide, per-stage ForwardOverrideSequence, or a return-origin
        // exception) must reference a Sequence that exists in this route,
        // and a return-origin exception's key must reference a Stage that
        // exists in this route -- a stale or typo'd value currently only
        // surfaces at runtime as a WorkflowConfigurationException, the
        // first time someone actually clicks Return or Forward.
        var validSequences = stages.Select(s => s.Sequence).ToHashSet();
        if (resubmitEntrySequence.HasValue && !validSequences.Contains(resubmitEntrySequence.Value))
        {
            errors.Add($"ResubmitEntrySequence {resubmitEntrySequence.Value} does not match any stage's Sequence in this route.");
        }
        foreach (var stage in stages)
        {
            if (stage.ForwardOverrideSequence is { } fwd && !validSequences.Contains(fwd))
            {
                errors.Add($"Stage '{stage.Stage}' (sequence {stage.Sequence}) has ForwardOverrideSequence {fwd} which does not match any stage's Sequence in this route.");
            }
            foreach (var (fromStage, toSequence) in stage.ForwardOverrideSequenceByReturnOriginMap())
            {
                if (!validSequences.Contains(toSequence))
                {
                    errors.Add($"Stage '{stage.Stage}' (sequence {stage.Sequence}) has a ForwardOverrideSequenceByReturnOrigin entry for '{fromStage}' pointing at sequence {toSequence}, which does not match any stage's Sequence in this route.");
                }
                if (!stages.Any(s => s.Stage == fromStage))
                {
                    errors.Add($"Stage '{stage.Stage}' (sequence {stage.Sequence}) has a ForwardOverrideSequenceByReturnOrigin entry keyed on '{fromStage}', which is not a stage in this route.");
                }
            }
        }

        // Rule 4: roles must exist. A typo silently locks a stage -- no user can
        // hold "Deen", so every request would stall there with a 403.
        var known = await roles.GetRoleNamesAsync(ct);
        var knownSet = new HashSet<string>(known, StringComparer.OrdinalIgnoreCase);
        foreach (var stage in stages.OrderBy(s => s.Sequence))
        {
            foreach (var role in stage.AllowedRoleList())
            {
                if (!knownSet.Contains(role))
                {
                    errors.Add($"Stage '{stage.Stage}' allows role '{role}', which does not exist.");
                }
            }
        }

        // Rule 5: do not strand live instances. The operationally important one.
        var proposed = stages.Select(s => s.Stage).ToHashSet();
        var live = await db.WorkflowInstances
            .Where(w => w.RequestType == requestType
                     && w.Phase == phase
                     && !TerminalStages.Contains(w.CurrentStage))
            .GroupBy(w => w.CurrentStage)
            .Select(g => new { Stage = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        foreach (var group in live.Where(g => !proposed.Contains(g.Stage)))
        {
            // The count is what tells an operator how much is at stake.
            errors.Add(
                $"Cannot remove stage '{group.Stage}': {group.Count} live request(s) are currently at it " +
                "and would be stranded.");
        }

        return errors;
    }
}
