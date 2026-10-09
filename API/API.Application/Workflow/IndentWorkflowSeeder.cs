using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the indent approval workflow as per user requirements:
/// Faculty (Raise) → Faculty (SignedCopyUploaded) → HOD (forward/return) → 
/// Clerk/RegularStaff (assign/forward/return) → Assigned Staff (forward/return) → 
/// Superintendent (assign/forward/return) → Deputy Registrar (forward/return) → 
/// Dean (conditional based on cost: approve if ≤1L, forward if >1L, return/reject) → 
/// Director (approve if >1L, return/reject).
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkflowDefinitionSeeder"/>, which provides the generic
/// office escalation route. Indents have a specific approval routing that differs 
/// from the standard escalation path based on cost thresholds.
/// </remarks>
public static class IndentWorkflowSeeder
{
    /// <summary>
    /// Indent approval stages. Key points:
    /// 1. Raised: Faculty raises the indent request
    /// 2. SignedCopyUploaded: Faculty uploads signed copy
    /// 3. IndentWithHOD: HOD verifies and can forward or return
    /// 4. IndentWithRnCOffice: Clerk/RegularStaff assigns and forwards, or returns
    /// 5. IndentAssignedToDA: Assigned staff can forward or return
    /// 6. IndentWithSuperintendent: Superintendent can assign, forward, or return
    /// 7. IndentWithDeputyRegistrar: Deputy Registrar can forward or return
    /// 8. IndentWithDean: Dean can approve (≤1L) or forward (>1L), return/reject
    /// 9. Director: Director can approve, return, or reject
    /// 10. IndentApproved: Terminal stage
    /// </summary>
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn)[] Route =
    [
        (1, WorkflowStage.IndentRaised, "Faculty,PI", false, false, false),                                    // Faculty raises indent
        (2, WorkflowStage.IndentWithHOD, "HOD", false, false, true),                                           // HOD verifies, can forward or return (signed copy uploaded by faculty)
        (3, WorkflowStage.IndentWithRnCOffice, "RegularStaff,Clerk", false, false, true),                      // Clerk/RegularStaff assigns and forwards, can return
        (4, WorkflowStage.IndentAssignedToDA, "RegularStaff,Faculty", false, false, true),                     // Assigned staff can forward or return
        (5, WorkflowStage.IndentWithSuperintendent, "Superintendent", false, false, true),                     // Superintendent can assign, forward, or return
        (6, WorkflowStage.IndentWithDeputyRegistrar, "DeputyRegistrar", false, false, true),                   // Deputy Registrar can forward or return (no approve)
        (7, WorkflowStage.IndentWithDean, "Dean", true, true, true),                                           // Dean can approve (≤1L) or forward (>1L), return/reject
        (8, WorkflowStage.Director, "Director", true, true, true),                                             // Director can approve (>1L), return, or reject
        (9, WorkflowStage.IndentApproved, "", false, false, false),                                            // Terminal stage - approved
        (10, WorkflowStage.Rejected, "", false, false, false),                                                 // Terminal stage - rejected
        (11, WorkflowStage.IndentReturnedToPI, "", false, false, false),                                       // Returned to PI for revision
    ];

    /// <summary>
    /// Sequence where returned indents re-enter the workflow (back to PI/Faculty).
    /// </summary>
    public const int ResubmitEntrySequence = 1; // Raised (Faculty can re-raise/modify)

    /// <summary>
    /// Idempotent on (RequestType, Phase), matching <see cref="WorkflowDefinitionSeeder"/>:
    /// creates a definition (and its stages) only if missing, and backfills an
    /// existing one's stage roles/flags/sequence in place. Never deletes a
    /// WorkflowDefinition or WorkflowStageDefinition row -- an earlier version
    /// of this seeder deleted and recreated them on every startup, which
    /// silently destroyed every live WorkflowInstance's audit trail whenever
    /// the app booted in Development against the shared database.
    /// </summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var indentRequestTypes = new[]
        {
            RequestType.Consumable,
            RequestType.Equipment,
            RequestType.Contingency,
            RequestType.DynamicIndent,
        };

        var added = false;
        foreach (var requestType in indentRequestTypes)
        {
            added |= await SeedIndentRouteAsync(db, requestType, ct);
        }

        if (added)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task<bool> SeedIndentRouteAsync(IApplicationDbContext db, RequestType requestType, CancellationToken ct)
    {
        var existingDefinition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == requestType && d.Phase == WorkflowPhase.Indent, ct);

        if (existingDefinition is null)
        {
            var newDefinition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = requestType,
                Phase = WorkflowPhase.Indent,
                Name = $"{requestType} (Indent) — Cost-based approval routing",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                ResubmitEntrySequence = ResubmitEntrySequence,
                Stages =
                [
                    .. Route.Select(r => new WorkflowStageDefinition
                    {
                        Id = Guid.NewGuid(),
                        Sequence = r.Sequence,
                        Stage = r.Stage,
                        AllowedRoles = r.Roles,
                        IsInitial = r.Sequence == 1,
                        IsTerminal = r.Stage == WorkflowStage.IndentApproved || r.Stage == WorkflowStage.Rejected,
                        CanApprove = r.CanApprove,
                        CanReject = r.CanReject,
                        CanReturn = r.CanReturn,
                    })
                ],
            };

            db.WorkflowDefinitions.Add(newDefinition);
            return true;
        }

        // Backfill: add any missing stage, and bring an existing stage's
        // sequence/roles/flags in line with Route -- same convention as
        // WorkflowDefinitionSeeder.SeedAsync's backfill loop.
        var added = false;
        var existingStageNames = existingDefinition.Stages.Select(s => s.Stage).ToHashSet();

        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn) in Route)
        {
            if (!existingStageNames.Contains(stage))
            {
                existingDefinition.Stages.Add(new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = existingDefinition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage == WorkflowStage.IndentApproved || stage == WorkflowStage.Rejected,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                });
                added = true;
                continue;
            }

            var existingStage = existingDefinition.Stages.First(s => s.Stage == stage);
            if (existingStage.Sequence != sequence
                || existingStage.AllowedRoles != roles
                || existingStage.CanApprove != canApprove
                || existingStage.CanReject != canReject
                || existingStage.CanReturn != canReturn)
            {
                existingStage.Sequence = sequence;
                existingStage.AllowedRoles = roles;
                existingStage.CanApprove = canApprove;
                existingStage.CanReject = canReject;
                existingStage.CanReturn = canReturn;
                added = true;
            }
        }

        if (existingDefinition.ResubmitEntrySequence != ResubmitEntrySequence)
        {
            existingDefinition.ResubmitEntrySequence = ResubmitEntrySequence;
            added = true;
        }

        return added;
    }
}
