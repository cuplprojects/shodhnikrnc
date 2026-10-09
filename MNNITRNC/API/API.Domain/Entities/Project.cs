using API.Domain.Enums;

namespace API.Domain.Entities;

public class Project
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }

    /// <summary>
    /// The owner's department at the time the project was created, snapshotted
    /// rather than resolved live through <c>ApplicationUser.DepartmentId</c>.
    /// </summary>
    /// <remarks>
    /// Mirrors <c>ResearchProposal.DepartmentId</c> (Phase 9) for the same
    /// reason: department-scoped reports must not silently reassign a PI's
    /// past projects to a different department just because the PI
    /// transferred since. Existing rows, which predate this column, are
    /// backfilled from the owner's department at migration time -- a
    /// one-time approximation, not a perfect reconstruction of history that
    /// was never recorded.
    /// </remarks>
    public Guid DepartmentId { get; set; }

    public ProjectType ProjectType { get; set; }
    public required string SanctionNo { get; set; }
    public DateOnly SanctionDate { get; set; }
    public required string ProjectTitle { get; set; }
    public DateOnly StartDate { get; set; }
    public required string Agency { get; set; }
    public int DurationMonths { get; set; }
    public decimal TotalSanctioned { get; set; }

    /// <summary>Blended overhead rate applied on top of every non-RecurringOverhead
    /// budget head's Total to compute TotalAmount. Null means 0% (no overhead
    /// applied) -- distinguishing "never set" from "explicitly zero" is not
    /// needed since both behave identically today.</summary>
    public decimal? OverheadPercent { get; set; }

    /// <summary>(sum of every BudgetHead.Total where HeadName != RecurringOverhead) * (1 + OverheadPercent/100)
    /// + (Total of any RecurringOverhead row, if one exists). Recomputed by ProjectService
    /// whenever BudgetHeads or OverheadPercent change. Persisted, not derived at read time.
    /// Distinct from TotalSanctioned, which stays the manually-entered sanctioned figure.</summary>
    public decimal TotalAmount { get; set; }

    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
    public Guid? WorkflowInstanceId { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// The project's permanent Dealing Assistant (a RegularStaff-role
    /// user), set by ProjectService.AssignDaAsync (Superintendent/Dean
    /// only). Null until the first assignment. Every request raised
    /// against this project from this point forward has its
    /// WorkflowInstance.AssignedToUserId pre-populated from this value at
    /// raise time -- reassigning here only affects requests raised
    /// afterward; it never touches an already-raised instance's own
    /// AssignedToUserId. See DaAssignmentLogs for the full history.
    /// </summary>
    public Guid? CurrentDaUserId { get; set; }

    public ICollection<Collaborator> Collaborators { get; set; } = new List<Collaborator>();
    public ICollection<BudgetHead> BudgetHeads { get; set; } = new List<BudgetHead>();
    public ICollection<SanctionedEquipment> SanctionedEquipment { get; set; } = new List<SanctionedEquipment>();
    public ICollection<SanctionedManpowerPosition> SanctionedManpowerPositions { get; set; } = new List<SanctionedManpowerPosition>();
    public ICollection<GrantReceipt> GrantReceipts { get; set; } = new List<GrantReceipt>();
    public ICollection<HistoricalGrantReceipt> HistoricalGrantReceipts { get; set; } = new List<HistoricalGrantReceipt>();
    public ICollection<BudgetReappropriationLog> BudgetReappropriationLogs { get; set; } = new List<BudgetReappropriationLog>();
    public ICollection<ProjectDaAssignmentLog> DaAssignmentLogs { get; set; } = new List<ProjectDaAssignmentLog>();
    public ICollection<ReappropriationRequest> ReappropriationRequests { get; set; } = new List<ReappropriationRequest>();
}
