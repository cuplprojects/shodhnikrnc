using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the process bill approval chain (PI -> HOD -> Assigned Clerk -> OSRC -> DYREGRC -> DEAN).
/// </summary>
public static class ProcessBillWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.Raised, "", false, false, false, null),                                    // PI initial stage / Bill Processed
        (2, WorkflowStage.WithHOD, "HOD,SuperAdmin,Admin", false, false, false, null),               // HOD stage
        (3, WorkflowStage.WithRnCOffice, "RegularStaff,DealingAssistant,Superintendent,DeputyRegistrar,Dean,SuperAdmin,Admin", false, false, false, null), // Office stage
        (4, WorkflowStage.AssignedToDealingAssistant, "RegularStaff,DealingAssistant,Superintendent,DeputyRegistrar,Dean,SuperAdmin,Admin", false, false, false, null), // Clerk stage (assigned regular staff)
        (5, WorkflowStage.WithSuperintendent, "Superintendent,SuperAdmin,Admin", false, true, true, null), // OSRC stage (Forward, Return to PI, Reject)
        (6, WorkflowStage.WithDeputyRegistrar, "DeputyRegistrar,SuperAdmin,Admin", false, true, true, null), // DYREGRC stage (Forward, Return to PI, Reject)
        (7, WorkflowStage.WithDean, "Dean,Director,SuperAdmin,Admin", true, true, true, null),      // DEAN stage (Approve, Reject, Return)
        (8, WorkflowStage.Approved, "", false, false, false, null),                                 // Terminal approved
        (9, WorkflowStage.ReturnedToPI, "", false, false, false, 4),                                // Returned to PI branch (Forward override -> 4 AssignedToDealingAssistant)
    ];

    public const int ResubmitEntrySequence = 9;

    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        RequestType[] procurementTypes = [RequestType.Consumable, RequestType.Contingency, RequestType.Equipment, RequestType.Travel];

        foreach (var requestType in procurementTypes)
        {
            var definition = await db.WorkflowDefinitions
                .Include(d => d.Stages)
                .FirstOrDefaultAsync(d => d.RequestType == requestType && d.Phase == WorkflowPhase.Bill, ct);

            if (definition is null)
            {
                definition = new WorkflowDefinition
                {
                    Id = Guid.NewGuid(),
                    RequestType = requestType,
                    Phase = WorkflowPhase.Bill,
                    Name = $"{requestType} (Bill) — Process Bill Chain",
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
                        IsTerminal = stage == WorkflowStage.Approved,
                        CanApprove = canApprove,
                        CanReject = canReject,
                        CanReturn = canReturn,
                        ForwardOverrideSequence = forwardOverrideSequence,
                    });
                }

                db.WorkflowDefinitions.Add(definition);
            }
            else
            {
                definition.ResubmitEntrySequence = ResubmitEntrySequence;
                foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence) in Route)
                {
                    var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence);
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
                        });
                    }
                    else
                    {
                        if (existingStage.Stage != stage ||
                            existingStage.AllowedRoles != roles ||
                            existingStage.CanApprove != canApprove ||
                            existingStage.CanReject != canReject ||
                            existingStage.CanReturn != canReturn ||
                            existingStage.ForwardOverrideSequence != forwardOverrideSequence)
                        {
                            existingStage.Stage = stage;
                            existingStage.AllowedRoles = roles;
                            existingStage.CanApprove = canApprove;
                            existingStage.CanReject = canReject;
                            existingStage.CanReturn = canReturn;
                            existingStage.ForwardOverrideSequence = forwardOverrideSequence;
                        }
                    }
                }
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Seed data is already up-to-date in database
        }
    }
}

