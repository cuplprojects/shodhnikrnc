using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

/// <summary>
/// Seeds the approval route that <see cref="WorkflowEngineService"/> currently
/// hardcodes, one definition per (RequestType, Phase).
/// </summary>
/// <remarks>
/// Phase 7 changes where the route lives, not what it is, so this reproduces
/// today's chain exactly. It lives in Application rather than in the web
/// project's DbSeeder because the route is application logic and needs to be
/// reachable from tests -- the test project references Application but not the
/// web host.
/// </remarks>
public static class WorkflowDefinitionSeeder
{
    /// <summary>
    /// The shipped route. CanApprove/CanReject are true only at ForwardedDR and
    /// Director, because ApproveAsync and RejectAsync both call
    /// RequireDecisionStage, whose set is exactly those two.
    /// </summary>
    /// <remarks>
    /// Superintendent and DeputyRegistrar appear on the Reject attribute but
    /// cannot reach a stage where the engine permits rejection, so they are not
    /// granted it here. This records what ships, not what the attribute implies.
    /// </remarks>
    /// <summary>
    /// CanReturn mirrors CanReject at every stage here: Task A2 backfills this
    /// generic route's new CanReturn column to reproduce ReturnAsync's prior
    /// CanReject-gated behavior exactly, since only Research Proposal's route
    /// (seeded separately) narrows the two apart.
    /// </summary>
    /// <remarks>
    /// The four office-escalation stages (SignedCopyUploaded, Assigned,
    /// Forwarded, ForwardedOSRC) used to share one five-role group --
    /// RegularStaff, Superintendent, DeputyRegistrar, HOD, Dean -- because
    /// Forward was a single action behind a single [Authorize(Roles = ...)]
    /// attribute that could not tell which stage it was forwarding from. Now
    /// that the engine reads AllowedRoles per stage from this table (rather
    /// than a compile-time attribute), that limitation no longer applies, so
    /// the 2026-09-09 indent-workflow-and-role-scoping plan narrows each stage
    /// to the one role actually meant to act there, mirroring the scoping
    /// ResearchProposalWorkflowSeeder already ships for its own route: HOD
    /// verifies and uploads the signed copy's onward assignment, RegularStaff
    /// (dealing assistant) assigns it into the office, Superintendent forwards
    /// it on, and DeputyRegistrar forwards it to the Dean/Director decision
    /// stage. This closes the gap where e.g. a Dean could act at a stage meant
    /// for RegularStaff only.
    /// </remarks>
    public static readonly (int Sequence, WorkflowStage Stage, string Roles, bool CanApprove, bool CanReject, bool CanReturn)[] ShippedRoute =
    [
        (1, WorkflowStage.Raised, "", false, true, false),                    // the raiser's own stage
        (2, WorkflowStage.SignedCopyUploaded, "HOD", false, true, true),
        (3, WorkflowStage.Assigned, "RegularStaff", false, true, true),
        (4, WorkflowStage.Forwarded, "Superintendent", false, true, true),
        (5, WorkflowStage.ForwardedOSRC, "DeputyRegistrar", false, true, false),
        (6, WorkflowStage.ForwardedDR, "Dean,Director", true, true, true),
        (7, WorkflowStage.Director, "Director", true, true, true),
    ];

    /// <summary>
    /// Builds the shipped route for a pair, as an unsaved entity graph.
    /// </summary>
    /// <remarks>
    /// Shared by the seeder and by <see cref="WorkflowDefinitionService"/>'s
    /// fallback for an unconfigured pair, so there is one definition of "the
    /// route as it ships" rather than two that can drift apart.
    /// </remarks>
    public static WorkflowDefinition BuildShippedRoute(RequestType requestType, WorkflowPhase phase)
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = requestType,
            Phase = phase,
            Name = $"{requestType} ({phase}) — office escalation",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var (sequence, stage, roles, canApprove, canReject, canReturn) in ShippedRoute)
        {
            definition.Stages.Add(new WorkflowStageDefinition
            {
                Id = Guid.NewGuid(),
                WorkflowDefinitionId = definition.Id,
                Sequence = sequence,
                Stage = stage,
                AllowedRoles = roles,
                IsInitial = sequence == 1,
                IsTerminal = false,
                CanApprove = canApprove,
                CanReject = canReject,
                CanReturn = canReturn,
            });
        }

        return definition;
    }

    /// <summary>
    /// Inserts one definition per (RequestType, Phase) that does not already have
    /// one, and updates existing definitions so roles match the shipped route.
    /// </summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        // Every request type raises an Indent workflow and gets the shipped
        // office-escalation route -- except ResearchProposal, which has its own
        // eight-stage BRD Prompt 1 chain seeded separately by
        // ResearchProposalWorkflowSeeder; FellowshipClaim, which has its own
        // three-stage BRD A3 chain seeded separately by FellowshipWorkflowSeeder;
        // Advertisement, which has its own five-stage PI -> RnC office ->
        // Computer Centre chain seeded separately by AdvertisementWorkflowSeeder;
        // and GrantReceipt, which has its own seven-stage PI -> HOD -> RnC office
        // -> Dean chain seeded separately by GrantReceiptWorkflowSeeder; and
        // ScreeningCommittee/SelectionCommittee, which have their own short
        // PI<->Dean chains seeded separately by ScreeningCommitteeWorkflowSeeder/
        // SelectionCommitteeWorkflowSeeder.
        // Falling through to this generic seeder would give them the wrong route
        // silently: the first version of Task 3 caught exactly that, before any
        // proposal ever existed to be misrouted. The failure is worse than a
        // duplicate -- DbSeeder runs this seeder first, so the dedicated seeder
        // would then find a definition already present and take its "update
        // existing" branch, which reconciles roles and flags by Sequence but
        // never rewrites Stage. The route would keep the generic stage names
        // permanently, with the specialised roles stamped onto the wrong stages.
        // ScreeningCommittee/SelectionCommittee hit this for real (2026-09-23):
        // this seeder ran first every startup and kept re-backfilling the
        // generic 7-stage route onto their definition rows before the dedicated
        // seeders got a chance to run, so a screening/selection approval always
        // failed with "requires one of: ForwardedDR, Director".
        //
        // Travel additionally raises a Bill workflow when the claim is submitted
        // (TravelRequestService.SubmitBillAsync); that is the only second phase
        // in use today.
        var routes = Enum.GetValues<RequestType>()
            .Where(t => t != RequestType.ResearchProposal
                     && t != RequestType.FellowshipClaim
                     && t != RequestType.Advertisement
                     && t != RequestType.GrantReceipt
                     && t != RequestType.Consumable
                     && t != RequestType.Equipment
                     && t != RequestType.Contingency
                     && t != RequestType.DynamicIndent
                     && t != RequestType.ProjectUpdate
                     && t != RequestType.Reappropriation
                     && t != RequestType.ScreeningCommittee
                     && t != RequestType.SelectionCommittee)
            .Select(t => (RequestType: t, Phase: WorkflowPhase.Indent))
            .ToList();

        var existingDefinitions = await db.WorkflowDefinitions
            .Include(d => d.Stages)
            .ToListAsync(ct);

        var seen = existingDefinitions.Select(d => (d.RequestType, d.Phase)).ToHashSet();

        var added = false;
        foreach (var (requestType, phase) in routes)
        {
            if (!seen.Add((requestType, phase)))
            {
                continue;
            }

            db.WorkflowDefinitions.Add(BuildShippedRoute(requestType, phase));
            added = true;
        }

        // To avoid unique constraint violations on IX_WorkflowStageDefinitions_WorkflowDefinitionId_Sequence
        // when sequences are swapped (e.g. 2 -> 3 and 3 -> 2), we first shift all existing sequences
        // by a large offset, save, and then apply the final sequences.
        foreach (var def in existingDefinitions)
        {
            if (def.RequestType is RequestType.ResearchProposal or RequestType.FellowshipClaim or RequestType.Advertisement or RequestType.GrantReceipt
                or RequestType.Consumable or RequestType.Equipment or RequestType.Contingency or RequestType.DynamicIndent or RequestType.Reappropriation or RequestType.ScreeningCommittee or RequestType.SelectionCommittee or RequestType.ProjectUpdate) continue;

            foreach (var stage in def.Stages)
            {
                stage.Sequence += 1000;
            }
        }
        await db.SaveChangesAsync(ct);

        // Backfill existing DB stage allowed roles, flags, and missing stages
        // from ShippedRoute.
        foreach (var def in existingDefinitions)
        {
            if (def.RequestType is RequestType.ResearchProposal or RequestType.FellowshipClaim or RequestType.Advertisement or RequestType.GrantReceipt
                or RequestType.Consumable or RequestType.Equipment or RequestType.Contingency or RequestType.DynamicIndent
                or RequestType.ScreeningCommittee or RequestType.SelectionCommittee or RequestType.ProjectUpdate
                || (def.RequestType == RequestType.Travel && def.Phase == WorkflowPhase.Bill))
            {
                continue;
            }

            var existingStageNames = def.Stages.Select(s => s.Stage).ToHashSet();
            foreach (var (sequence, stage, roles, canApprove, canReject, canReturn) in ShippedRoute)
            {
                if (!existingStageNames.Contains(stage))
                {
                    def.Stages.Add(new WorkflowStageDefinition
                    {
                        Id = Guid.NewGuid(),
                        WorkflowDefinitionId = def.Id,
                        Sequence = sequence,
                        Stage = stage,
                        AllowedRoles = roles,
                        IsInitial = sequence == 1,
                        IsTerminal = false,
                        CanApprove = canApprove,
                        CanReject = canReject,
                        CanReturn = canReturn,
                    });
                    added = true;
                }
                else
                {
                    var existingStage = def.Stages.First(s => s.Stage == stage);
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
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Suppress optimistic concurrency exceptions if rows were concurrently
            // updated. DbSeeder.SeedAsync runs every seeder against one shared
            // IApplicationDbContext, so a failed SaveChangesAsync here leaves its
            // half-applied entities dirty in the change tracker -- the next
            // seeder's own SaveChangesAsync would then try to flush them too and
            // fail the same way for an unrelated reason. ChangeTracker.Clear()
            // detaches everything so this seeder's own failure stays contained to
            // this seeder (discovered 2026-09-23: this exact leak was breaking
            // ScreeningCommitteeWorkflowSeeder's unrelated SaveChangesAsync call
            // immediately after). IApplicationDbContext doesn't expose
            // ChangeTracker, so this reaches it via the concrete DbContext when
            // there is one; a test fake with no real change tracker has nothing
            // to clear.
            (db as DbContext)?.ChangeTracker.Clear();
        }
    }
}
