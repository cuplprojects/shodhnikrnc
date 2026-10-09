using API.Domain.Enums;

namespace API.Application.Reporting;

/// <summary>
/// One row per report (BRD Prompt 6 / A10). Every report is scoped the same
/// way every other query in this codebase is: Own for a PI, Department for
/// an HOD, Institute for Dean/R&amp;C office -- resolved internally by
/// <see cref="IReportingService"/> from the requesting user, not passed in
/// by the caller.
/// </summary>
public record NumberOfProjectsRow(ProjectType ProjectType, Guid DepartmentId, string DepartmentName, int Count);

public record GrantSanctionedRow(
    Guid ProjectId, string ProjectTitle, string Agency, DateOnly SanctionDate, decimal TotalSanctioned);

public record ProjectExpenditureRow(
    Guid ProjectId, string ProjectTitle, BudgetHeadName HeadName, int ProjectYear, decimal Amount);

public record ProjectOverheadRow(
    Guid ProjectId, string ProjectTitle, OverheadSubHead SubHead, DateOnly ReceivedDate, decimal Amount);

/// <summary>Phase 10 spec §3a: a manual record, not a workflow -- the report
/// is simply every <c>Refund</c> row in scope.</summary>
public record RefundRow(
    Guid ProjectId, string ProjectTitle, decimal Amount, DateOnly RefundDate, string Reason);

public record StaffCountRow(string Role, Guid DepartmentId, string DepartmentName, int Count);

public record ProjectEquipmentRow(
    Guid ProjectId, string ProjectTitle, string EquipmentName, string Unit, decimal Amount);

public record TransactionDetailRow(
    Guid Id,
    Guid ProjectId,
    string ProjectTitle,
    DateOnly TransactionDate,
    string TransactionRef,
    string PaymentMode,
    string HeadName,
    string ItemName,
    decimal CurrentBalance,
    decimal Amount,
    decimal BalanceAfter,
    string UpdatedBy);
/// <summary>One row per recruitment drive (not per project -- a project can
/// run more than one drive over its life), summarising where its candidates
/// landed in the screening/selection funnel.</summary>
public record RecruitmentFunnelRow(
    Guid ProjectId, string ProjectTitle, string DepartmentName,
    int Applied, int ScreenedEligible, int ScreenedIneligible,
    int Selected, int NotSelected, int Pending, RecruitmentStage LatestStage);
