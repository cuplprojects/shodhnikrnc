using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the Screening Committee formation chain: the PI submits (auto-adding
/// PI + Co-PI, if any, as CommitteeMember rows) and requests one additional
/// member from the Dean; the Dean assigns that member and approves in the
/// same action -- no return/reject path for Screening (unlike Selection).
/// </summary>
/// <remarks>
/// Separate (RequestType.ScreeningCommittee, WorkflowPhase.Indent) definition
/// from the merit-list route (RequestType.ManpowerDocument) and the
/// advertisement route (RequestType.Advertisement, see
/// AdvertisementWorkflowSeeder) -- a RecruitmentRequest carries independent
/// instances of each.
/// </remarks>
public static class ScreeningCommitteeWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.WithPIScreeningCommittee, "", false, false, false, null),   // PI-owned; forwards to the Dean
        (2, WorkflowStage.WithDeanScreeningCommittee, "Dean", true, false, false, null), // Dean assigns the nominee and approves in one action
        (3, WorkflowStage.ScreeningCommitteeApproved, "", false, false, false, null),  // terminal
    ];

    /// <summary>Idempotent on (RequestType, Phase), matching AdvertisementWorkflowSeeder.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.ScreeningCommittee && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ScreeningCommittee,
                Phase = WorkflowPhase.Indent,
                Name = "Screening Committee Formation",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
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
                    IsTerminal = stage == WorkflowStage.ScreeningCommitteeApproved,
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

        // A row can already exist under this (RequestType, Phase) whose stages
        // don't match Route at all -- e.g. WorkflowDefinitionService's
        // BuildShippedRoute fallback got seeded here first (RequestType is a
        // shared, append-only enum ordinal across branches writing to the same
        // database; a stale fallback row can land on the right ordinal before
        // this seeder ever runs). Matching by Sequence alone and only patching
        // flags silently kept such a row's wrong Stage values forever. Detect
        // a structural mismatch (different stage count, or any sequence whose
        // Stage doesn't match Route) and replace the stage rows wholesale in
        // that case, instead of trying to patch them field-by-field.
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
                    IsTerminal = stage == WorkflowStage.ScreeningCommitteeApproved,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                });
            }

            definition.Name = "Screening Committee Formation";
            definition.IsActive = true;
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
