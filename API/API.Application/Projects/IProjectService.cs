using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Projects;

public record CollaboratorInput(Guid? Id, string Institute, string Faculty, bool IsInsideInstitute = false, string? Department = null, string? Designation = null);
public record BudgetHeadInput(
    Guid? Id, BudgetHeadName HeadName, decimal Year1Amount, decimal Year2Amount, decimal Year3Amount,
    decimal Year4Amount = 0m, decimal Year5Amount = 0m, string? CustomLabel = null);
public record SanctionedEquipmentInput(Guid? Id, string Name, string Unit, decimal Amount);
public record SanctionedManpowerPositionInput(Guid? Id, string Designation, int Positions, decimal Stipend, decimal Hra);
public record ReappropriationLineInput(Guid BudgetHeadId, string HeadName, decimal Amount);

public record ReappropriationQueueLineItem(string HeadName, decimal Amount);

public record ReappropriationQueueItem(
    Guid Id,
    Guid ProjectId,
    string ProjectTitle,
    string Reason,
    decimal TotalAmount,
    IReadOnlyList<ReappropriationQueueLineItem> Sources,
    IReadOnlyList<ReappropriationQueueLineItem> Destinations,
    string Status,
    Guid? WorkflowInstanceId,
    string CurrentStage,
    DateTimeOffset CreatedAt);

/// <summary>Which per-receipt chain action a bulk request applies to every listed receipt.</summary>
public enum GrantReceiptBulkAction { Forward, Approve, Reject, Return }

/// <summary>
/// One row in a grant-receipt approval queue (HOD/DA/Superintendent/
/// DeputyRegistrar/Dean). Deliberately
/// project-and-receipt-scoped rather than reusing <c>GrantReceiptResponse</c> --
/// a queue reviewer needs to know which project a receipt belongs to before
/// opening it, which the single-project-scoped response has no reason to carry.
/// </summary>
public record GrantReceiptQueueItem(
    Guid Id,
    Guid ProjectId,
    string ProjectTitle,
    Guid BudgetHeadId,
    DateOnly ReceivedDate,
    decimal Amount,
    GrantReceiptStatus Status,
    Guid? WorkflowInstanceId,
    WorkflowStage? CurrentStage,
    DateTimeOffset CreatedAt);

public record ProjectPendingQueueItem(
    Guid Id,
    string ProjectTitle,
    string SanctionNo,
    string Status,
    Guid? WorkflowInstanceId,
    WorkflowStage? CurrentStage,
    DateTimeOffset CreatedAt);

public interface IProjectService
{
    Task<Project> CreateAsync(
        Guid ownerUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        decimal? overheadPercent = null, CancellationToken ct = default);

    /// <summary>
    /// The owner's own project, or -- read-only -- any project when
    /// <paramref name="requestingUserRoles"/> holds an R&amp;C office role
    /// (Dean, DeputyRegistrar, Superintendent, RegularStaff). They administer
    /// sanctioned grants institute-wide, the same reasoning that gives them
    /// institute-wide sight of proposals and indents; UpdateAsync,
    /// SoftDeleteAsync and RecordGrantReceiptAsync stay owner-only -- viewing
    /// and editing are different questions, and this only answers the first.
    /// Defaults to empty, so every call site that has not opted in keeps
    /// today's strict owner-only behaviour unchanged.
    /// </summary>
    Task<Project?> GetAsync(
        Guid projectId, Guid requestingUserId,
        IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    Task<IReadOnlyList<Project>> ListForOwnerAsync(Guid ownerUserId, CancellationToken ct = default);

    /// <summary>
    /// Kept for callers that genuinely want every project regardless of who
    /// is asking (e.g. background/admin tooling) -- NOT scoped by caller,
    /// so no controller action should call this directly for a normal user
    /// request. <see cref="ListVisibleToAsync"/> is what a project-list
    /// endpoint should call instead.
    /// </summary>
    Task<IReadOnlyList<Project>> ListAllAsync(CancellationToken ct = default);

    /// <summary>
    /// The projects a given user is allowed to see: their own, plus -- like
    /// <see cref="GetAsync"/> -- an HOD's own department and an R&amp;C
    /// office role's every project institute-wide. This is what
    /// ProjectsController.List should call; ListAllAsync is unscoped and
    /// exists for non-user-facing callers only.
    /// </summary>
    Task<IReadOnlyList<Project>> ListVisibleToAsync(
        Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default);

    /// <summary>
    /// Projects visible for Process Bill: matches user's department (by DepartmentId)
    /// as well as projects owned by the user (OwnerUserId), or all projects if R&C office/admin.
    /// </summary>
    Task<IReadOnlyList<Project>> ListForProcessBillAsync(
        Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default);

    /// <summary>
    /// Kept for non-user-facing callers only, same caveat as
    /// <see cref="ListAllAsync"/>: unscoped, so no controller action should
    /// call this for a normal user request -- use the
    /// <paramref name="requestingUserId"/> overload instead.
    /// </summary>
    Task<IReadOnlyList<SanctionedManpowerPosition>> GetManpowerPositionsAsync(Guid projectId, CancellationToken ct = default);

    /// <summary>Scoped exactly like <see cref="GetAsync"/> -- returns empty
    /// (not a thrown exception) when the caller cannot see the project, since
    /// this endpoint is a read of a sub-resource, not the project itself.</summary>
    Task<IReadOnlyList<SanctionedManpowerPosition>> GetManpowerPositionsAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default);

    Task<Project> UpdateAsync(
        Guid projectId, Guid requestingUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        decimal? overheadPercent = null, CancellationToken ct = default);

    Task SoftDeleteAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

    Task SubmitForApprovalAsync(Guid projectId, Guid requestingUserId, string? remarks = null, CancellationToken ct = default);
    Task ForwardProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ApproveProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task RejectProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ReturnProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// <paramref name="transactionReference"/> is the NEFT/RTGS number for the
    /// offline transfer. Recruitment's offer-letter gate keys off it, so a
    /// receipt without one does not count as payment received.
    /// </summary>
    Task<GrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid requestingUserId, Guid budgetHeadId, DateOnly receivedDate, decimal amount,
        IReadOnlyDictionary<OverheadSubHead, decimal>? overheadSplit,
        string? transactionReference = null, PaymentMode? paymentMode = null, string? schemeCode = null,
        int? projectYear = null, string? remarks = null,
        CancellationToken ct = default);

    /// <summary>Mirrors ResearchProposalService.ForwardAsync's shape,
    /// including its PI-only-stage ownership gate: the grant receipt route's
    /// roleless stages (Draft, ReturnedToPIGrantReceipt) have empty
    /// AllowedRoles, so the engine's own role check is a no-op there and
    /// ownership is what actually restricts forwarding to the owning PI.
    /// See ProjectService.GrantReceiptPiOnlyStages for the enforcement.</summary>
    Task ForwardGrantReceiptAsync(Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// The PI who owns the grant receipt's project (the project's
    /// OwnerUserId), or null if the receipt does not exist. Mirrors
    /// <c>IRecruitmentService.GetOwnershipAsync</c>'s shape -- used by
    /// <c>WorkflowController.Get</c> to redact internal grant-receipt-workflow
    /// steps from the PI the same way advertisement and proposal steps are
    /// already redacted from their owners.
    /// </summary>
    Task<Guid?> GetGrantReceiptOwnershipAsync(Guid grantReceiptId, CancellationToken ct = default);

    /// <summary>The WithDeanGrantReceipt-stage terminal approval. Re-checks the
    /// sum ceiling against every OTHER currently-Approved receipt on the same
    /// budget head/year immediately before calling the engine, since other
    /// receipts may have been approved while this one sat in the chain.</summary>
    Task ApproveGrantReceiptAsync(Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    Task RejectGrantReceiptAsync(Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    Task ReturnGrantReceiptAsync(Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Applies the same chain action to every listed grant receipt inside one
    /// database transaction: if any receipt's action fails (wrong stage,
    /// wrong role, already acted on by someone else, etc.), none of them are
    /// applied. Each receipt still goes through the same
    /// Forward/Approve/Reject/ReturnGrantReceiptAsync method used for a
    /// single receipt -- this only adds the all-or-nothing wrapper, no new
    /// authorization or stage logic.
    /// </summary>
    Task BulkActOnGrantReceiptsAsync(
        IReadOnlyCollection<Guid> grantReceiptIds, GrantReceiptBulkAction action,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks,
        CancellationToken ct = default);

    /// <summary>
    /// Grant receipts currently sitting at WithHODGrantReceipt within the
    /// HOD's own department, mirroring
    /// <c>ResearchProposalService.ListForHodAsync</c>'s department-scoped
    /// query-then-filter-by-workflow-instance-stage pattern.
    /// </summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForHodGrantReceiptQueueAsync(
        Guid hodUserId, CancellationToken ct = default);

    /// <summary>
    /// Grant receipts currently at WithRnCOfficeGrantReceipt, institute-wide.
    /// SECURITY: gated by <c>IInstituteWideScopeResolver.IsInstituteWideAsync</c>
    /// exactly like <c>ResearchProposalService.ListForRnCOfficeAsync</c> -- an
    /// office-group caller whose own department is not R&amp;C gets an empty
    /// list, not every department's receipts. [PageAccess] alone does not
    /// enforce this; do not remove this check.
    /// </summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForRnCOfficeGrantReceiptQueueAsync(
        Guid officeUserId, CancellationToken ct = default);

    /// <summary>
    /// Grant receipts currently at WithDeanGrantReceipt, institute-wide. Same
    /// department-scope gate as <see cref="ListForRnCOfficeGrantReceiptQueueAsync"/>
    /// -- a Dean's oversight is seeded at AccessScope.Department in
    /// PageCatalogue like every other queue page, widened to institute-wide
    /// only via R&amp;C department membership, never granted directly.
    /// </summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDeanGrantReceiptQueueAsync(
        Guid deanUserId, CancellationToken ct = default);

    /// <summary>
    /// Grant receipts currently at AssignedToDAGrantReceipt, institute-wide --
    /// mirrors ListForRnCOfficeGrantReceiptQueueAsync's own department-scope
    /// gate and reasoning (any RegularStaff account sits at this stage's
    /// AllowedRoles regardless of department, so "my own department happens
    /// to match" must not be treated as the real visibility rule).
    /// </summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDaGrantReceiptQueueAsync(
        Guid daUserId, CancellationToken ct = default);

    /// <summary>Same department-scope gate as
    /// <see cref="ListForDaGrantReceiptQueueAsync"/>, for the Superintendent stage.</summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForSuperintendentGrantReceiptQueueAsync(
        Guid superintendentUserId, CancellationToken ct = default);

    /// <summary>Same department-scope gate as
    /// <see cref="ListForDaGrantReceiptQueueAsync"/>, for the Deputy Registrar stage.</summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDeputyRegistrarGrantReceiptQueueAsync(
        Guid drUserId, CancellationToken ct = default);

    /// <summary>
    /// Grant receipts currently pending at any stage the caller's own roles
    /// can act on, scoped like the queue methods above but resolving
    /// stage-matching via IWorkflowPendingQueryService.ListPendingInstancesAsync
    /// (multi-stage/multi-role aware) rather than one hardcoded
    /// WorkflowStage per method. Feeds the dashboard's pending-actions panel.
    /// </summary>
    Task<IReadOnlyList<GrantReceiptQueueItem>> ListPendingGrantReceiptsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    /// <summary>
    /// Projects currently pending at any approval workflow stage the caller's own
    /// roles can act on (or owned by the caller when returned/draft/pending revision),
    /// resolving stage-matching via IWorkflowPendingQueryService.ListPendingInstancesAsync.
    /// Feeds the dashboard's pending-actions panel.
    /// </summary>
    Task<IReadOnlyList<ProjectPendingQueueItem>> ListPendingProjectsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);

    Task<OfferLetter> CreateOfferLetterAsync(
        Guid? generatedByUserId, Guid projectId, Guid manpowerId, string candidateName,
        string gender, string parentName, string address, string city, string state,
        string pincode, decimal fellowshipAmount, decimal hraPercentage, DateOnly joiningDate,
        string? filePath = null, CancellationToken ct = default);

    Task<IReadOnlyList<OfferLetter>> GetOfferLettersAsync(
        Guid? projectId = null, Guid? manpowerId = null, CancellationToken ct = default);

    Task<ReappropriationRequest> RaiseReappropriationAsync(
        Guid projectId, Guid requestingUserId, string reason,
        IReadOnlyList<ReappropriationLineInput> sources,
        IReadOnlyList<ReappropriationLineInput> destinations,
        CancellationToken ct = default);

    Task UpdateAndResubmitReappropriationAsync(
        Guid requestId, Guid requestingUserId, string reason,
        IReadOnlyList<ReappropriationLineInput> sources,
        IReadOnlyList<ReappropriationLineInput> destinations,
        string? remarks = null,
        CancellationToken ct = default);

    Task ForwardReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ApproveReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task RejectReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ReturnReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    Task<IReadOnlyList<ReappropriationQueueItem>> ListPendingReappropriationsAsync(Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
    Task<IReadOnlyList<ReappropriationQueueItem>> ListHistoryReappropriationsAsync(Guid userId, CancellationToken ct = default);
    Task<ReappropriationRequest?> GetReappropriationAsync(Guid requestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    /// <summary>
    /// Used only by the proposal-sanction undo path, to decide whether a
    /// just-Sanctioned Project is still genuinely untouched and therefore
    /// safe to hard-delete. Checks both the six tables cascade-deleted with
    /// the Project (GrantReceipts, BudgetReappropriationLogs -- Collaborators,
    /// BudgetHeads, SanctionedEquipment and SanctionedManpowerPositions are
    /// created alongside the Project itself and never signal downstream
    /// activity on their own) and every other table that carries a
    /// <c>ProjectId</c> with no FK/cascade protection at all (ConsumableIndent,
    /// ContingencyIndent, EquipmentIndent, Expenditure, Refund,
    /// RecruitmentRequest, TravelRequest, OfferLetter) -- a hard delete would
    /// otherwise silently orphan those rows, or throw an unhandled database
    /// error where one of them (EquipmentIndent, via SanctionedEquipmentId)
    /// happens to carry its own Restrict-behavior FK elsewhere.
    /// </summary>
    Task<bool> HasAnyDownstreamActivityAsync(Guid projectId, CancellationToken ct = default);

    /// <summary>
    /// Hard-deletes a Project and its cascade-configured child rows
    /// (BudgetHeads, SanctionedEquipment, SanctionedManpowerPositions,
    /// GrantReceipts, BudgetReappropriationLogs -- all already configured
    /// DeleteBehavior.Cascade in ApplicationDbContext, so a plain
    /// db.Projects.Remove(project) fans out correctly with no manual
    /// per-child removal needed). Only called after
    /// HasAnyDownstreamActivityAsync has confirmed the project is genuinely
    /// untouched -- both in those cascaded tables and in every other table
    /// that references it -- this method does not re-check.
    /// </summary>
    /// <param name="requestingUserId">
    /// The actor who triggered the undo (not necessarily the Project's own
    /// OwnerUserId) -- recorded on the audit log entry, mirroring
    /// SoftDeleteAsync's own requestingUserId parameter.
    /// </param>
    Task HardDeleteUntouchedAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

    Task AssignDaAsync(
        Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        Guid newDaUserId, string reason, CancellationToken ct = default);

    Task<IReadOnlyList<ProjectDaAssignmentLog>> GetDaAssignmentHistoryAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        CancellationToken ct = default);
}

