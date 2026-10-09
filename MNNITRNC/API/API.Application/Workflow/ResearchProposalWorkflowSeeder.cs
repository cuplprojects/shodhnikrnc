using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the eight-stage research proposal approval chain, BRD Prompt 1 / §A1.
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkflowDefinitionSeeder"/>, which excludes
/// <see cref="RequestType.ResearchProposal"/> from its generic loop precisely so
/// this route -- not the office escalation -- is what a proposal gets. This is
/// the configurator's first real use for a chain that is not the office
/// escalation: every role and stage below is transcribed from the BRD's routing
/// line, not invented.
/// </remarks>
public static class ResearchProposalWorkflowSeeder
{
    /// <summary>
    /// The stages, in BRD order. <c>CanReject</c> and <c>CanReturn</c> are
    /// independent gates: <c>CanReject</c> marks where a stage can reject a
    /// proposal outright (Dean/Director at WithDean), while <c>CanReturn</c>
    /// marks where a stage can return it to the PI for correction
    /// (Dean/Director at WithDean, and DeputyRegistrar at WithDeputyRegistrar).
    /// Reject and Return are no longer the same decision point, and
    /// Superintendent no longer holds either.
    /// </summary>
    /// <remarks>
    /// <see cref="WorkflowStage.ReturnedToPI"/> (sequence 9) is deliberately
    /// off the BRD's forward routing line, not spliced into it: ordinary
    /// Forward resolves strictly by "next sequence", so a stage sitting between
    /// WithRnCOffice and AssignedToDealingAssistant would catch every proposal
    /// on the happy path too, not just returned ones. It is reachable only via
    /// <see cref="ResubmitEntrySequence"/>'s explicit jump. A first read of the
    /// BRD's "goes directly to the Dealing Assistant" pointed re-entry straight
    /// at AssignedToDealingAssistant, which only permits RegularStaff -- the PI
    /// who owns the proposal could never act on their own return.
    /// ReturnedToPI carries no AllowedRoles, mirroring Draft, so only the PI
    /// (via ownership) can revise/re-upload; its ForwardOverrideSequence sends
    /// the PI's own forward straight back to AssignedToDealingAssistant,
    /// preserving "not the Dean" exactly as before.
    /// </remarks>
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence, string? ForwardOverrideSequenceByReturnOrigin)[] Route =
    [
        (1, WorkflowStage.Draft, "", false, false, false, null, null),                                    // the PI's own stage
        (2, WorkflowStage.WithHOD, "HOD", false, false, true, null, null),                                // forwards; department-scoped; can now return to the PI for corrections
        (3, WorkflowStage.WithRnCOffice, "RegularStaff,Superintendent,DeputyRegistrar,Dean", false, false, false, null, null),
        (4, WorkflowStage.AssignedToDealingAssistant, "RegularStaff,Superintendent,DeputyRegistrar,Dean", false, false, false, null, null),
        (5, WorkflowStage.WithSuperintendent, "Superintendent", false, true, true, null, null),
        (6, WorkflowStage.WithDeputyRegistrar, "DeputyRegistrar", false, true, true, null, null),
        (7, WorkflowStage.WithDean, "Dean,Director", true, true, true, null, null),
        (8, WorkflowStage.Approved, "", false, false, false, null, null),                                 // terminal
        (9, WorkflowStage.ReturnedToPI, "", false, false, false, 4, "WithHOD:2"),                          // branch stage; resubmit re-entry point, PI-only. Default rejoin is AssignedToDealingAssistant (4) for office returns; an HOD return instead rejoins at WithHOD (2), so the PI's correction comes back through HOD, not straight to the office.
    ];

    /// <summary>Sequence of <see cref="WorkflowStage.ReturnedToPI"/>.</summary>
    /// <remarks>
    /// BRD: "a resubmitted proposal goes directly to the Dealing Assistant -- it
    /// must NOT re-enter at the Dean step." Still true: ReturnedToPI's only
    /// exit forwards to AssignedToDealingAssistant (sequence 4, via its
    /// ForwardOverrideSequence), never back up the chain.
    /// </remarks>
    public const int ResubmitEntrySequence = 9;

    /// <summary>Idempotent on (RequestType, Phase), matching <see cref="WorkflowDefinitionSeeder"/>.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.ResearchProposal && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.ResearchProposal,
                Phase = WorkflowPhase.Indent,
                Name = "Research Proposal (Indent) — BRD Prompt 1",
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
            return;
        }

        var changed = false;
        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn, forwardOverrideSequence, forwardOverrideSequenceByReturnOrigin) in Route)
        {
            var existingStage = definition.Stages.FirstOrDefault(s => s.Sequence == sequence);
            if (existingStage is null) continue;

            if (existingStage.AllowedRoles != roles) { existingStage.AllowedRoles = roles; changed = true; }
            if (existingStage.CanApprove != canApprove) { existingStage.CanApprove = canApprove; changed = true; }
            if (existingStage.CanReject != canReject) { existingStage.CanReject = canReject; changed = true; }
            if (existingStage.CanReturn != canReturn) { existingStage.CanReturn = canReturn; changed = true; }
            if (existingStage.ForwardOverrideSequence != forwardOverrideSequence) { existingStage.ForwardOverrideSequence = forwardOverrideSequence; changed = true; }
            if (existingStage.ForwardOverrideSequenceByReturnOrigin != forwardOverrideSequenceByReturnOrigin) { existingStage.ForwardOverrideSequenceByReturnOrigin = forwardOverrideSequenceByReturnOrigin; changed = true; }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
