using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the grant receipt approval chain: the PI raises and is immediately
/// forwarded to the HOD (forward-only -- no reject/return at this stage,
/// deliberately kept different from ResearchProposal's own HOD stage); the
/// HOD forwards to the Dealing Assistant (DA); DA forwards to Superintendent;
/// Superintendent forwards to Deputy Registrar; Deputy Registrar forwards to
/// Dean; the Dean may approve (terminal -- the receipt now counts as real
/// money, see <c>ProjectService.ApproveGrantReceiptAsync</c>), reject
/// (terminal), or return. Each of DA/Superintendent/DeputyRegistrar may also
/// reject or return. Mirrors <see cref="ResearchProposalWorkflowSeeder"/>'s
/// route depth and role sequencing deliberately: the same senior sign-off
/// governing money going OUT via a proposal should govern money confirmed as
/// having come IN. Unlike ResearchProposal's own AssignedToDealingAssistant/
/// WithSuperintendent/WithDeputyRegistrar stages, this route's equivalent
/// stages use distinct, type-suffixed WorkflowStage enum members -- see that
/// enum's own doc comments for why names must stay distinct across routes.
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkflowDefinitionSeeder"/>, which excludes
/// <see cref="RequestType.GrantReceipt"/> from its generic loop precisely so
/// this route -- not the office escalation -- is what a grant receipt gets.
///
/// <para>
/// This route includes <see cref="WorkflowStage.Rejected"/> as a genuine
/// route member from the start: <c>ApproveAsync</c>/<c>RejectAsync</c>'s
/// engine fallback to <see cref="WorkflowStage.Approved"/>/<see cref="WorkflowStage.Rejected"/>
/// only reaches a stage <c>GetStageAsync</c> can subsequently resolve if that
/// stage is a real route member; omitting it strands every rejected instance
/// the next time anything reads it back (this exact bug was caught by review
/// in the Advertisement plan's Task 2).
/// </para>
///
/// <para>
/// Sequence 1 reuses <see cref="WorkflowStage.Draft"/> (the same enum value
/// <see cref="ResearchProposalWorkflowSeeder"/> uses for its own PI-only
/// first stage) rather than a distinct "WithPIGrantReceipt"-shaped member.
/// This was verified safe, not assumed: <c>WorkflowEngineService.RaiseAsync</c>
/// resolves the initial stage generically via
/// <c>definition.Stages.FirstOrDefault(s => s.IsInitial)</c> -- its one
/// special case redirects <see cref="WorkflowStage.WithPIFellowship"/>
/// specifically to <see cref="WorkflowStage.Raised"/> for non-fellowship
/// request types, and does not mention <see cref="WorkflowStage.Draft"/> at
/// all, so it does not fire here. Every other engine method
/// (<c>GetStageAsync</c>, <c>GetNextStageAsync</c>) resolves stages from the
/// route already scoped to <c>(RequestType, Phase)</c> via
/// <c>WorkflowDefinitionService.GetAsync</c>, so a value reused across two
/// routes causes no cross-route confusion at the engine level. The only cost
/// is the same audit-trail ambiguity flagged elsewhere: a
/// <c>WorkflowStep.Stage</c> reading <see cref="WorkflowStage.Draft"/> does
/// not, by itself, say which route it belongs to -- the request type is
/// needed too. That is an acceptable, deliberate tradeoff, not an oversight.
/// </para>
///
/// <para>
/// <see cref="WorkflowStage.ReturnedToPIGrantReceipt"/> (sequence 9) sits
/// deliberately off the forward line, after both terminal stages, mirroring
/// <see cref="ResearchProposalWorkflowSeeder"/>'s <see cref="WorkflowStage.ReturnedToPI"/>:
/// ordinary <c>Forward</c>/<c>Approve</c> resolution walks strictly by
/// ascending sequence, so a branch stage spliced into the main line would
/// catch every grant receipt on the happy path too, not just returned ones.
/// It is reachable only via <c>ReturnAsync</c>'s <see cref="ResubmitEntrySequence"/>
/// jump. Its own <c>ForwardOverrideSequence</c> sends the PI's forward back
/// to <see cref="WorkflowStage.WithHODGrantReceipt"/> (sequence 2) -- never
/// back to sequence 1, which would make the PI raise twice -- so a corrected
/// receipt goes through the HOD and the full office chain again rather than
/// skipping straight back to the Dean.
/// </para>
///
/// <para>
/// <strong>Migration note:</strong> this route previously had 7 stages
/// (Draft, WithHODGrantReceipt, WithRnCOfficeGrantReceipt, WithDeanGrantReceipt,
/// Approved, Rejected, ReturnedToPIGrantReceipt) before the DA/Superintendent/
/// DeputyRegistrar split. Because the stage COUNT changed (not just a
/// property on an existing stage), <see cref="SeedAsync"/> uses the
/// rebuild-in-place pattern <see cref="FellowshipWorkflowSeeder"/> already
/// established for the same situation: detect a stage-count or stage-identity
/// mismatch, <c>RemoveRange</c> every existing <see cref="WorkflowStageDefinition"/>
/// row for this definition, and re-add fresh rows from <see cref="Route"/>.
/// No instance-remapping function is added (contrast
/// <c>FellowshipWorkflowSeeder.MigrateExistingInstancesAsync</c>): every
/// <see cref="WorkflowStage.WithRnCOfficeGrantReceipt"/>-era
/// <see cref="WorkflowInstance"/> row existing when this ships is test data
/// being cleaned up separately, and old enum values stay valid forever (per
/// <see cref="WorkflowStage"/>'s own "never delete, never reorder" rule), so
/// nothing crashes if one is left in place -- it simply no longer advances
/// anywhere via the new route.
/// </para>
/// </remarks>
public static class GrantReceiptWorkflowSeeder
{
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn, int? ForwardOverrideSequence)[] Route =
    [
        (1, WorkflowStage.Draft, "", false, false, false, null),                                                 // reused enum value -- see remarks
        (2, WorkflowStage.WithHODGrantReceipt, "HOD", false, false, false, null),                                 // forward-only, deliberately
        (3, WorkflowStage.AssignedToDAGrantReceipt, "RegularStaff", false, true, true, null),
        (4, WorkflowStage.WithSuperintendentGrantReceipt, "Superintendent", false, true, true, null),
        (5, WorkflowStage.WithDeputyRegistrarGrantReceipt, "DeputyRegistrar", false, true, true, null),
        (6, WorkflowStage.WithDeanGrantReceipt, "Dean,Director", true, true, true, null),
        (7, WorkflowStage.Approved, "", false, false, false, null),                                               // terminal
        (8, WorkflowStage.Rejected, "", false, false, false, null),                                               // terminal
        (9, WorkflowStage.ReturnedToPIGrantReceipt, "", false, false, false, 2),                                  // branch stage; resubmit re-entry point, PI-only
    ];

    /// <summary>Sequence of <see cref="WorkflowStage.ReturnedToPIGrantReceipt"/>.</summary>
    public const int ResubmitEntrySequence = 9;

    /// <summary>Idempotent on (RequestType, Phase). Rebuilds stage rows in
    /// place -- never deletes the owning WorkflowDefinition row itself, and
    /// never touches WorkflowStep audit rows -- when the route's shape
    /// (stage count or stage identity at a given sequence) no longer matches
    /// <see cref="Route"/>, matching <see cref="FellowshipWorkflowSeeder"/>'s
    /// own established rebuild pattern for the same situation.</summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .FirstOrDefaultAsync(d => d.RequestType == RequestType.GrantReceipt && d.Phase == WorkflowPhase.Indent, ct);

        if (definition is null)
        {
            definition = new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.GrantReceipt,
                Phase = WorkflowPhase.Indent,
                Name = "Grant Receipt Approval",
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

        var expectedStageCount = Route.Length;
        var actualStageCount = definition.Stages.Count;

        var stagesNeedRebuild = actualStageCount != expectedStageCount;
        if (!stagesNeedRebuild)
        {
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
            db.WorkflowStageDefinitions.RemoveRange(definition.Stages);
            definition.Stages.Clear();

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
                    IsTerminal = stage is WorkflowStage.Approved or WorkflowStage.Rejected,
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
