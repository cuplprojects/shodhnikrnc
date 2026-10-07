using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the advertisement approval chain: the PI raises and forwards to the
/// RnC office; the RnC office may approve (-> Computer Centre), reject
/// (terminal), or return (-> back to the PI to edit and resubmit); the Computer
/// Centre's approve concludes the route, at which point RecruitmentService flips
/// RecruitmentRequest.Stage to Advertised. The workflow engine itself has no
/// concept of "make the ad live" -- that is the recruitment entity's own
/// reaction to its instance concluding.
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkflowDefinitionSeeder"/>'s generic office
/// escalation, and from the recruitment merit-list route
/// (<see cref="RequestType.ManpowerDocument"/>): this is its own
/// (<see cref="RequestType.Advertisement"/>, <see cref="WorkflowPhase.Indent"/>)
/// definition, so a request carries two independent instances.
/// </remarks>
public static class AdvertisementWorkflowSeeder
{
    /// <summary>
    /// The stages, in routing order.
    /// </summary>
    /// <remarks>
    /// Two placements here are dictated by <c>WorkflowEngineService</c>'s actual
    /// behaviour, not by taste:
    ///
    /// <para>
    /// <see cref="WorkflowStage.Approved"/> (sequence 4) is a real stage, not an
    /// implicit one. <c>ApproveAsync</c> resolves its next stage and, when there
    /// is none, hardcodes <c>instance.CurrentStage = WorkflowStage.Approved</c>.
    /// Marking <see cref="WorkflowStage.WithComputerCentre"/> itself both
    /// <c>CanApprove</c> and <c>IsTerminal</c> would therefore still land the
    /// instance on <c>Approved</c> -- a stage the route would not contain, so
    /// the very next <c>GetStageAsync</c> would throw
    /// <c>WorkflowConfigurationException</c> and strand it. Both shipped routes
    /// (<see cref="ResearchProposalWorkflowSeeder"/>,
    /// <see cref="FellowshipWorkflowSeeder"/>) carry the same explicit terminal
    /// stage one step after their last approving stage, for the same reason.
    /// </para>
    ///
    /// <para>
    /// <see cref="WorkflowStage.Rejected"/> (sequence 6) is present for exactly
    /// the same reason as <see cref="WorkflowStage.Approved"/>:
    /// <c>RejectAsync</c> hardcodes <c>instance.CurrentStage =
    /// WorkflowStage.Rejected</c> rather than resolving it from the route, so a
    /// route granting <c>CanReject</c> anywhere -- here, the RnC office -- must
    /// contain the stage or the rejection strands the instance on a stage the
    /// next <c>GetStageAsync</c> cannot resolve. It sits after the branch stage
    /// so it never lands on the ordinary forward line, which resolves "next"
    /// strictly by ascending sequence.
    /// </para>
    ///
    /// <para>
    /// <see cref="WorkflowStage.ReturnedToPIAdvertisement"/> (sequence 5) sits
    /// deliberately off the forward line, after the terminal stage. Both
    /// <c>ForwardAsync</c> and <c>ApproveAsync</c> resolve "next" strictly as the
    /// lowest sequence greater than the current one, with no notion of skipping
    /// a branch stage. Placed between <see cref="WorkflowStage.WithRnCOfficeAdvertisement"/>
    /// and <see cref="WorkflowStage.WithComputerCentre"/> it would catch every
    /// advertisement on the happy path, not just returned ones. It is reachable
    /// only via <see cref="ResubmitEntrySequence"/>'s explicit jump in
    /// <c>ReturnAsync</c>, and its <c>ForwardOverrideSequence</c> sends the PI's
    /// own forward back to the RnC office (sequence 2) -- never back to
    /// sequence 1, which would make the PI forward twice.
    /// </para>
    ///
    /// <para>
    /// <see cref="WorkflowStage.WithPIAdvertisement"/> and
    /// <see cref="WorkflowStage.ReturnedToPIAdvertisement"/> carry no
    /// AllowedRoles, mirroring <see cref="WorkflowStage.Draft"/>: an empty list
    /// means "not role-restricted", with ownership enforced by
    /// RecruitmentService rather than by a role name.
    /// </para>
    /// </remarks>
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.WithPIAdvertisement, "", false, false, false, null),                 // the PI's own stage; forwards to the RnC office
        (2, WorkflowStage.WithRnCOfficeAdvertisement, "RegularStaff,Superintendent,DeputyRegistrar,Dean", true, true, true, null),
        (3, WorkflowStage.WithComputerCentre, "ComputerCentre", true, false, false, null),      // approving here concludes the route
        (4, WorkflowStage.Approved, "", false, false, false, null),                             // terminal
        (5, WorkflowStage.ReturnedToPIAdvertisement, "", false, false, false, 2),               // branch stage; resubmit re-entry point, PI-only
        (6, WorkflowStage.Rejected, "", false, false, false, null),                             // terminal; RejectAsync's hardcoded landing stage
    ];

    /// <summary>Sequence of <see cref="WorkflowStage.ReturnedToPIAdvertisement"/>.</summary>
    /// <remarks>
    /// A returned advertisement re-enters at the PI's correction stage, and its
    /// only exit forwards to <see cref="WorkflowStage.WithRnCOfficeAdvertisement"/>
    /// (sequence 2, via its ForwardOverrideSequence) -- it never re-enters at
    /// the Computer Centre, which has not seen it yet.
    /// </remarks>
    public const int ResubmitEntrySequence = 5;

    /// <summary>Idempotent on (RequestType, Phase), matching <see cref="ResearchProposalWorkflowSeeder"/>.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.Advertisement && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Advertisement,
                Phase = WorkflowPhase.Indent,
                Name = "Advertisement Approval (Indent)",
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
                    IsTerminal = stage is WorkflowStage.Approved or WorkflowStage.Rejected,
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
