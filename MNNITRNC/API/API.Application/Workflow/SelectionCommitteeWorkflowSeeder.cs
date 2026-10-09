using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the Selection Committee formation chain: the PI submits (auto-adding
/// PI + HOD, an optional PI-chosen member, and 3-5 PI-recommended candidates)
/// and forwards to the Dean; the Dean picks exactly one recommended candidate
/// (CommitteeMember.IsSelectedByDean = true) and approves, or returns to the
/// PI for edits. A returned instance re-enters at ReturnedToPISelectionCommittee
/// (sequence 4, off the forward line) and its own forward rejoins at sequence 2
/// (WithDeanSelectionCommittee) via ForwardOverrideSequence -- never back to
/// sequence 1, which would make the PI submit twice.
/// </summary>
public static class SelectionCommitteeWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.WithPISelectionCommittee, "", false, false, false, null),
        (2, WorkflowStage.WithDeanSelectionCommittee, "Dean", true, false, true, null),
        (3, WorkflowStage.SelectionCommitteeApproved, "", false, false, false, null),   // terminal
        (4, WorkflowStage.ReturnedToPISelectionCommittee, "", false, false, false, 2),  // branch stage; resubmit re-entry point, PI-only
    ];

    /// <summary>Sequence of <see cref="WorkflowStage.ReturnedToPISelectionCommittee"/>.</summary>
    public const int ResubmitEntrySequence = 4;

    /// <summary>Idempotent on (RequestType, Phase), matching AdvertisementWorkflowSeeder.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.SelectionCommittee && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.SelectionCommittee,
                Phase = WorkflowPhase.Indent,
                Name = "Selection Committee Formation",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                ResubmitEntrySequence = ResubmitEntrySequence,
            };

            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
            {
                definition.Stages.Add(new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage == WorkflowStage.SelectionCommitteeApproved,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                });
            }

            db.WorkflowDefinitions.Add(definition);
            await db.SaveChangesAsync(ct);
            return;
        }

        // See ScreeningCommitteeWorkflowSeeder's identical guard for why: a
        // stale WorkflowDefinition.BuildShippedRoute fallback row can already
        // occupy this (RequestType, Phase) -- RequestType is a shared,
        // append-only enum ordinal across branches writing to the same
        // database -- so matching by Sequence alone and only patching flags
        // would silently keep such a row's wrong Stage values forever.
        var structurallyMismatched =
            definition.Stages.Count != Route.Length ||
            Route.Any(r => definition.Stages.FirstOrDefault(s => s.Sequence == r.Sequence)?.Stage != r.Stage);

        if (structurallyMismatched)
        {
            db.WorkflowStageDefinitions.RemoveRange(definition.Stages);
            definition.Stages.Clear();

            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
            {
                definition.Stages.Add(new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage == WorkflowStage.SelectionCommitteeApproved,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                });
            }

            definition.Name = "Selection Committee Formation";
            definition.IsActive = true;
            definition.ResubmitEntrySequence = ResubmitEntrySequence;
            await db.SaveChangesAsync(ct);
            return;
        }

        var changed = false;
        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
        {
            var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence);
            if (existingStage is null) continue;

            if (existingStage.AllowedRoles != roles) { existingStage.AllowedRoles = roles; changed = true; }
            if (existingStage.CanApprove != canApprove) { existingStage.CanApprove = canApprove; changed = true; }
            if (existingStage.CanReject != canReject) { existingStage.CanReject = canReject; changed = true; }
            if (existingStage.CanReturn != canReturn) { existingStage.CanReturn = canReturn; changed = true; }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
