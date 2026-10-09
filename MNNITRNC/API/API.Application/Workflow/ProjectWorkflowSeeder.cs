using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the workflow definition for Project Update re-approval chain.
/// Reuses the same approval hierarchy (PI -> HOD -> R&C Office -> Dealing Assistant -> Superintendent -> Deputy Registrar -> Dean).
/// </summary>
public static class ProjectWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence, string? ForwardOverrideSequenceByReturnOrigin)[] Route =
    [
        (1, WorkflowStage.Draft, "", false, false, false, null, null),
        (2, WorkflowStage.WithHOD, "HOD", false, false, true, null, null),
        (3, WorkflowStage.WithRnCOffice, "RegularStaff,Superintendent,DeputyRegistrar,Dean", false, false, false, null, null),
        (4, WorkflowStage.AssignedToDealingAssistant, "RegularStaff,Superintendent,DeputyRegistrar,Dean", false, false, false, null, null),
        (5, WorkflowStage.WithSuperintendent, "Superintendent", false, true, true, null, null),
        (6, WorkflowStage.WithDeputyRegistrar, "DeputyRegistrar", false, true, true, null, null),
        (7, WorkflowStage.WithDean, "Dean,Director", true, true, true, null, null),
        (8, WorkflowStage.Approved, "", false, false, false, null, null),
        (9, WorkflowStage.ReturnedToPI, "", false, false, false, 4, "WithHOD:2"),
    ];

    public const int ResubmitEntrySequence = 9;

    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.ProjectUpdate && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ProjectUpdate,
                Phase = WorkflowPhase.Indent,
                Name = "Project Update Re-Approval Workflow",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                ResubmitEntrySequence = ResubmitEntrySequence,
            };

            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence, forwardOverrideSequenceByReturnOrigin) in Route)
            {
                definition.Stages.Add(new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage == WorkflowStage.Approved,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                    ForwardOverrideSequenceByReturnOrigin = forwardOverrideSequenceByReturnOrigin,
                });
            }

            db.WorkflowDefinitions.Add(definition);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            var changed = false;
            if (definition.ResubmitEntrySequence != ResubmitEntrySequence)
            {
                definition.ResubmitEntrySequence = ResubmitEntrySequence;
                changed = true;
            }

            var routeStages = Route.Select(r => r.Stage).ToHashSet();
            var extraStages = definition.Stages.Where(s => !routeStages.Contains(s.Stage)).ToList();
            if (extraStages.Count > 0)
            {
                foreach (var extra in extraStages)
                {
                    definition.Stages.Remove(extra);
                }
                changed = true;
            }

            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence, forwardOverrideSequenceByReturnOrigin) in Route)
            {
                var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence || s.Stage == stage);
                if (existingStage is null)
                {
                    definition.Stages.Add(new WorkflowStageDefinition
                    {
                        Id = Guid.NewGuid(),
                        WorkflowDefinitionId = definition.Id,
                        Sequence = sequence,
                        Stage = stage,
                        AllowedRoles = roles,
                        IsInitial = sequence == 1,
                        IsTerminal = stage == WorkflowStage.Approved,
                        CanApprove = canApprove,
                        CanReject = canReject,
                        CanReturn = canReturn,
                        ForwardOverrideSequence = forwardOverrideSequence,
                        ForwardOverrideSequenceByReturnOrigin = forwardOverrideSequenceByReturnOrigin,
                    });
                    changed = true;
                }
                else
                {
                    if (existingStage.Sequence != sequence) { existingStage.Sequence = sequence; changed = true; }
                    if (existingStage.Stage != stage) { existingStage.Stage = stage; changed = true; }
                    if (existingStage.AllowedRoles != roles) { existingStage.AllowedRoles = roles; changed = true; }
                    if (existingStage.CanApprove != canApprove) { existingStage.CanApprove = canApprove; changed = true; }
                    if (existingStage.CanReject != canReject) { existingStage.CanReject = canReject; changed = true; }
                    if (existingStage.CanReturn != canReturn) { existingStage.CanReturn = canReturn; changed = true; }
                    if (existingStage.ForwardOverrideSequence != forwardOverrideSequence) { existingStage.ForwardOverrideSequence = forwardOverrideSequence; changed = true; }
                    if (existingStage.ForwardOverrideSequenceByReturnOrigin != forwardOverrideSequenceByReturnOrigin) { existingStage.ForwardOverrideSequenceByReturnOrigin = forwardOverrideSequenceByReturnOrigin; changed = true; }
                    if (existingStage.IsInitial != (sequence == 1)) { existingStage.IsInitial = sequence == 1; changed = true; }
                    if (existingStage.IsTerminal != (stage == WorkflowStage.Approved)) { existingStage.IsTerminal = stage == WorkflowStage.Approved; changed = true; }
                }
            }

            if (changed)
            {
                await db.SaveChangesAsync(ct);
            }
        }

        // Remap any active ProjectUpdate workflow instances sitting on legacy stages
        var legacyInstances = await db.WorkflowInstances
            .Where(i => i.RequestType == RequestType.ProjectUpdate &&
                       (i.CurrentStage == WorkflowStage.Director || i.CurrentStage == WorkflowStage.ForwardedDR || i.CurrentStage == WorkflowStage.ForwardedOSRC))
            .ToListAsync(ct);

        if (legacyInstances.Count > 0)
        {
            foreach (var inst in legacyInstances)
            {
                if (inst.CurrentStage == WorkflowStage.Director)
                {
                    inst.CurrentStage = WorkflowStage.WithDean;
                }
                else if (inst.CurrentStage == WorkflowStage.ForwardedDR)
                {
                    // Check if DR already forwarded in steps history
                    var drForwarded = inst.Steps.Any(s => s.Action == WorkflowAction.Forward && s.Stage == WorkflowStage.ForwardedDR);
                    inst.CurrentStage = drForwarded ? WorkflowStage.WithDean : WorkflowStage.WithDeputyRegistrar;
                }
                else if (inst.CurrentStage == WorkflowStage.ForwardedOSRC)
                {
                    inst.CurrentStage = WorkflowStage.WithDeputyRegistrar;
                }
            }
            await db.SaveChangesAsync(ct);
        }
    }
}
