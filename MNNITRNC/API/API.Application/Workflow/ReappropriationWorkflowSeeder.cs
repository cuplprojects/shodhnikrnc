using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

public static class ReappropriationWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.Draft, "", false, false, false, null),
        (2, WorkflowStage.ReappropriationWithHOD, "HOD", false, true, true, null),
        (3, WorkflowStage.ReappropriationWithDA, "RegularStaff", false, true, true, null),
        (4, WorkflowStage.ReappropriationWithSuperintendent, "Superintendent", false, true, true, null),
        (5, WorkflowStage.ReappropriationWithDR, "DeputyRegistrar", false, true, true, null),
        (6, WorkflowStage.ReappropriationWithDean, "Dean", true, true, true, null),
        (7, WorkflowStage.Approved, "", false, false, false, null),
        (8, WorkflowStage.Rejected, "", false, false, false, null),
        (9, WorkflowStage.ReappropriationReturnedToPI, "Faculty", false, false, false, 3),
    ];

    public const int ResubmitEntrySequence = 9;

    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.Reappropriation && d.Phase == WorkflowPhase.Indent, ct);

        if (definition == null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Reappropriation,
                Phase = WorkflowPhase.Indent,
                Name = "Reappropriation Approval",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                ResubmitEntrySequence = ResubmitEntrySequence,
            };
            db.WorkflowDefinitions.Add(definition);
        }
        else
        {
            definition.Name = "Reappropriation Approval";
            definition.ResubmitEntrySequence = ResubmitEntrySequence;
        }

        var existingStages = definition.Stages.ToList();

        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
        {
            var existing = existingStages.FirstOrDefault(s => s.Stage == stage);
            if (existing != null)
            {
                existing.Sequence = sequence;
                existing.AllowedRoles = roles;
                existing.IsInitial = sequence == 1;
                existing.IsTerminal = stage is WorkflowStage.Approved or WorkflowStage.Rejected;
                existing.CanApprove = canApprove;
                existing.CanReject = canReject;
                existing.CanReturn = canReturn;
                existing.ForwardOverrideSequence = forwardOverrideSequence;
                existingStages.Remove(existing);
            }
            else
            {
                definition.Stages.Add(new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definition.Id,
                    Sequence = sequence,
                    Stage = stage,
                    AllowedRoles = roles,
                    IsInitial = sequence == 1,
                    IsTerminal = stage is WorkflowStage.Approved or WorkflowStage.Rejected,
                    CanApprove = canApprove,
                    CanReject = canReject,
                    CanReturn = canReturn,
                    ForwardOverrideSequence = forwardOverrideSequence,
                });
            }
        }

        // Remove any old stages that are no longer in Route
        foreach (var oldStage in existingStages)
        {
            definition.Stages.Remove(oldStage);
        }

        await db.SaveChangesAsync(ct);
    }
}
