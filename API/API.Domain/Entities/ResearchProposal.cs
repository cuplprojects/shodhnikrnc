using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A research proposal, BRD Prompt 1 / §A1 -- what precedes a Project. Phase 2
/// built the post-sanction half of Prompt 1 (Project, BudgetHead, GrantReceipt);
/// this is the pre-sanction half.
/// </summary>
/// <remarks>
/// <see cref="ProjectId"/> is set only when <see cref="Status"/> reaches
/// <see cref="ProposalStatus.Sanctioned"/>. Internal approval
/// (<see cref="ProposalStatus.Approved"/>) does not create a Project: it means
/// the institute endorses submitting the proposal, not that funding is
/// committed. <see cref="Project"/> itself requires a sanction number and a
/// sanctioned amount, neither of which exists before the agency responds, so
/// there is nothing to construct one from before then.
/// </remarks>
public class ResearchProposal
{
    public Guid Id { get; set; }

    /// <summary>The PI.</summary>
    public Guid OwnerUserId { get; set; }

    /// <summary>
    /// The PI's department at the time of creation, snapshotted rather than
    /// resolved live through <c>ApplicationUser.DepartmentId</c>.
    /// </summary>
    /// <remarks>
    /// The HOD approval stage is department-scoped against this column, not
    /// against the PI's current department: a PI transferring departments after
    /// submission must not silently move an in-flight proposal into a different
    /// HOD's queue mid-approval.
    /// </remarks>
    public Guid DepartmentId { get; set; }

    public required string Title { get; set; }
    
    public ProposalType ProposalType { get; set; }
    
    public required string Agency { get; set; }
    public string? AdvertisementReference { get; set; }

    public decimal ProposedAmount { get; set; }

    /// <summary>Mandatory per the BRD: the budget copy must carry an overhead column.</summary>
    public decimal OverheadAmount { get; set; }

    /// <summary>
    /// The single percentage the PI enters once, applied to the sum of every
    /// ProposalBudgetLine where IncludeInOverhead is true. Replaces the old
    /// per-line ProposalBudgetLine.OverheadPercent (client request,
    /// 2026-09-15) -- existing proposals migrate to 0 here (no backfill from
    /// their old per-line values; confirmed with the client).
    /// </summary>
    public decimal OverheadPercent { get; set; }

    /// <summary>ProposedAmount + OverheadAmount, recomputed by ResearchProposalService.ComputeAmounts
    /// every time BudgetLines change (create and update). Persisted, not derived at read time.</summary>
    public decimal TotalAmount { get; set; }

    public int DurationMonths { get; set; }

    public ProposalStatus Status { get; set; } = ProposalStatus.Draft;

    /// <summary>
    /// Null while <see cref="ProposalStatus.Draft"/>. Set when
    /// <c>SubmitForApprovalAsync</c> raises the workflow instance.
    /// </summary>
    public Guid? WorkflowInstanceId { get; set; }

    public DateOnly? SubmittedToAgencyOn { get; set; }
    public DateOnly? AgencyDecisionOn { get; set; }

    /// <summary>Set only when <see cref="Status"/> reaches <see cref="ProposalStatus.Sanctioned"/>.</summary>
    public Guid? ProjectId { get; set; }

    /// <summary>
    /// Who recorded the sanction (set alongside <see cref="ProjectId"/> in
    /// RecordSanctionAsync). RecordSanctionAsync never calls
    /// IWorkflowEngineService.AppendStep -- it is a direct field mutation, not
    /// an engine transition -- so there is no WorkflowStep row to read an
    /// actor off of when undoing a Sanction. This field is that record,
    /// letting UndoLastActionAsync's Sanction branch enforce the same
    /// "only the original actor may undo" rule every other undo path gets
    /// from the engine's own ActorUserId check.
    /// </summary>
    public Guid? SanctionedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    /// <summary>
    /// Optimistic concurrency token, incremented by the application on every
    /// save (see ResearchProposalService's SaveWithConcurrencyCheckAsync)
    /// rather than database-generated: SubmitForApprovalAsync reads, mutates,
    /// and saves this row across two separate SaveChangesAsync calls (one
    /// inside IWorkflowEngineService.RaiseAsync, one of its own) with no lock
    /// held in between, so two requests racing on the same still-Draft
    /// proposal (a double-click, a retried request) can each pass the Draft
    /// check and each save -- without this, the second save silently
    /// overwrites whatever the first one set (WorkflowInstanceId included)
    /// with its own stale in-memory copy. This turns that into a
    /// DbUpdateConcurrencyException the caller must handle, instead of a
    /// proposal permanently stuck at UnderApproval with no workflow instance
    /// -- unable to ever show a Forward button, since nothing governs it.
    /// </summary>
    public int ConcurrencyVersion { get; set; }

    public ICollection<ProposalBudgetLine> BudgetLines { get; set; } = new List<ProposalBudgetLine>();
    public ICollection<ProposalEquipment> Equipment { get; set; } = new List<ProposalEquipment>();
    public ICollection<ProposalManpowerPosition> Manpower { get; set; } = new List<ProposalManpowerPosition>();
    public ICollection<ProposalCoPi> CoPis { get; set; } = new List<ProposalCoPi>();
}
