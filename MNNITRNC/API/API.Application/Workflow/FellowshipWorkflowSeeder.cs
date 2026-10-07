using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the fellowship claim approval workflow: Fellow raises claim → PI approves
/// (forward only, no return) → HOD approves (forward, reject, or return) → Dean approves
/// (forward, reject, or return).
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkflowDefinitionSeeder"/>, which provides the generic
/// office escalation route. Fellowship claims have a specific BRD-defined routing
/// (BRD A3: "Approval Workflow: PI → HOD → Dean") that differs from the standard
/// escalation path.
/// </remarks>
public static class FellowshipWorkflowSeeder
{
    /// <summary>
    /// Fellowship claim approval stages. Key points:
    /// - WithPIFellowship: PI reviews and can approve (forward) or reject (no return) - INITIAL STAGE
    /// - WithHODFellowship: HOD can approve, reject, or return to PI
    /// - WithDeanFellowship: Dean can approve, reject, or return to PI
    /// - ReturnedByHODToPI: Returned by HOD (re-entry point to WithPIFellowship)
    /// - ReturnedByDeanToPI: Returned by Dean (re-entry point to WithPIFellowship)
    /// - Approved: Terminal stage
    /// - Rejected: Terminal stage
    /// </summary>
    /// <summary>
    /// CanReturn mirrors CanReject at every stage here: Task A2 backfills this
    /// route's new CanReturn column to reproduce ReturnAsync's prior
    /// CanReject-gated behavior exactly. Only Research Proposal's route (seeded
    /// separately) narrows the two apart.
    /// </summary>
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.WithPIFellowship, "Faculty", true, true, true, null),          // PI can approve (forward) or reject (no return) - INITIAL STAGE
        (2, WorkflowStage.WithHODFellowship, "HOD", true, true, true, null),             // HOD can approve, reject, or return
        (3, WorkflowStage.WithDAFellowship, "RegularStaff", true, true, true, null), // DA can approve, reject, or return
        (4, WorkflowStage.WithSuperintendentFellowship, "Superintendent", true, true, true, null), // Supt can approve, reject, or return
        (5, WorkflowStage.WithDRFellowship, "DeputyRegistrar", true, true, true, null), // DR can approve, reject, or return
        (6, WorkflowStage.WithDeanFellowship, "Dean", true, true, true, null),           // Dean can approve, reject, or return
        (7, WorkflowStage.Approved, "", false, false, false, null),                       // Terminal stage - reached from WithDeanFellowship
        (8, WorkflowStage.Rejected, "", false, false, false, null),                       // Terminal stage - rejection path
        (9, WorkflowStage.ReturnedByHODToPI, "", false, false, false, 1),                // Returned by HOD: re-entry at WithPIFellowship (sequence 1)
        (10, WorkflowStage.ReturnedByDAToPI, "", false, false, false, 1),                // Returned by DA: re-entry at WithPIFellowship (sequence 1)
        (11, WorkflowStage.ReturnedBySuperintendentToPI, "", false, false, false, 1),    // Returned by Superintendent: re-entry at WithPIFellowship (sequence 1)
        (12, WorkflowStage.ReturnedByDRToPI, "", false, false, false, 1),                // Returned by DR: re-entry at WithPIFellowship (sequence 1)
        (13, WorkflowStage.ReturnedByDeanToPI, "", false, false, false, 1),              // Returned by Dean: re-entry at WithPIFellowship (sequence 1)
    ];

    /// <summary>
    /// Sequence where returned claims re-enter the workflow.
    /// BRD: Returned claims go back to PI for revision.
    /// </summary>
    public const int ResubmitEntrySequence = 1; // WithPIFellowship

    /// <summary>Idempotent on (RequestType, Phase), matching <see cref="WorkflowDefinitionSeeder"/>.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.FellowshipClaim && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.FellowshipClaim,
                Phase = WorkflowPhase.Indent,
                Name = "Fellowship Claim (Indent) — BRD A3",
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
                    IsTerminal = stage == WorkflowStage.Approved || stage == WorkflowStage.Rejected,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                });
            }

            db.WorkflowDefinitions.Add(definition);
            
            // Explicitly add stages to ensure they're tracked and saved
            foreach (var stage in definition.Stages)
            {
                db.WorkflowStageDefinitions.Add(stage);
            }
            
            await db.SaveChangesAsync(ct);

            // Migrate any existing instances that may have been created before this seeder existed
            await MigrateExistingInstancesAsync(db, ct);

            return;
        }

        // Update existing definition if needed (idempotent)
        // Check if stages match the route; if not, recreate them
        var expectedStageCount = Route.Length;
        var actualStageCount = definition.Stages.Count;

        bool stagesNeedRebuild = actualStageCount != expectedStageCount;
        if (!stagesNeedRebuild)
        {
            // Check if each stage's stage and sequence match
            foreach (var (sequence, stage, _, _, _, _, _) in Route)
            {
                var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence);
                if (existingStage?.Stage != stage)
                {
                    stagesNeedRebuild = true;
                    break;
                }
            }
        }

        if (stagesNeedRebuild)
        {
            // Remove existing stages from the tracker
            db.WorkflowStageDefinitions.RemoveRange(definition.Stages);
            
            definition.Stages.Clear();
            
            // Add new stages based on Route
            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
            {
                var newStage = new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage == WorkflowStage.Approved || stage == WorkflowStage.Rejected,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                };
                definition.Stages.Add(newStage);
                db.WorkflowStageDefinitions.Add(newStage);
            }

            definition.ResubmitEntrySequence = ResubmitEntrySequence;
            await db.SaveChangesAsync(ct);

            // Migrate existing workflow instances that may be in old/incorrect stages
            await MigrateExistingInstancesAsync(db, ct);

            return;
        }

        // If stages are correct, just update properties
        var changed = false;
        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
        {
            var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence);
            if (existingStage is not null)
            {
                var expectedIsTerminal = stage == WorkflowStage.Approved || stage == WorkflowStage.Rejected;
                if (existingStage.AllowedRoles != roles
                    || existingStage.CanApprove != canApprove
                    || existingStage.CanReject != canReject
                    || existingStage.CanReturn != canReturn
                    || existingStage.IsTerminal != expectedIsTerminal)
                {
                    existingStage.AllowedRoles = roles;
                    existingStage.CanApprove = canApprove;
                    existingStage.CanReject = canReject;
                    existingStage.CanReturn = canReturn;
                    existingStage.IsTerminal = expectedIsTerminal;
                    changed = true;
                }
            }
        }

        if (changed || definition.ResubmitEntrySequence != ResubmitEntrySequence)
        {
            definition.ResubmitEntrySequence = ResubmitEntrySequence;
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Migrates existing workflow instances to the correct fellowship stages.
    /// Handles three cases:
    /// 1. Instances in the old generic "Raised" stage → WithPIFellowship
    /// 2. Instances in generic office stages (Forwarded, ForwardedOSRC, etc.) → WithHODFellowship
    /// 3. Instances in Director/ForwardedDR stages → WithDeanFellowship
    /// </summary>
    private static async Task MigrateExistingInstancesAsync(IApplicationDbContext db, CancellationToken ct)
    {
        var fellowshipInstances = await db.WorkflowInstances
            .Where(w => w.RequestType == RequestType.FellowshipClaim && w.Phase == WorkflowPhase.Indent)
            .ToListAsync(ct);

        var changed = false;

        foreach (var instance in fellowshipInstances)
        {
            // Map old generic stages to new fellowship stages
            var newStage = instance.CurrentStage switch
            {
                // Initial stage: anything that isn't yet in the fellowship stages should go to PI
                WorkflowStage.Raised => WorkflowStage.WithPIFellowship,

                // HOD stages: generic office forwarding stages that indicate "PI approved, now with HOD"
                WorkflowStage.SignedCopyUploaded or
                WorkflowStage.Assigned or
                WorkflowStage.Forwarded or
                WorkflowStage.ForwardedOSRC
                    => WorkflowStage.WithHODFellowship,

                // Dean stages: generic stages that indicate "HOD approved, now with Dean"
                WorkflowStage.ForwardedDR or
                WorkflowStage.Director
                    => WorkflowStage.WithDeanFellowship,

                // Already in correct fellowship stages or terminal stages: no migration needed
                _ => instance.CurrentStage
            };

            if (newStage != instance.CurrentStage)
            {
                instance.CurrentStage = newStage;
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
