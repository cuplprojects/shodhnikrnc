using API.Domain.Enums;

namespace API.Application.Fellowship;

/// <summary>
/// A single recorded step in a fellowship claim's workflow history.
/// Returned to the UI so that all parties (fellow, PI, HOD, Dean) can see
/// who acted, what they did, when, and any remarks they left.
/// Remarks on Return steps are especially important: PI must see WHY a
/// claim was returned before they can revise and re-forward it.
/// </summary>
public record WorkflowStepSummary(
    Guid Id,
    WorkflowStage Stage,
    WorkflowAction Action,
    string ActorName,
    string? Remarks,
    DateTimeOffset Timestamp);

/// <summary>
/// Note what is absent: no amounts. Fellowship and HRA are derived from the
/// appointment and the 20% rule, never accepted from the caller -- a fellow must
/// not be able to name their own pay.
/// </summary>
public record RaiseClaimInput(
    int ClaimYear,
    int ClaimMonth,
    bool HraClaimed,
    int LeaveDaysTakenThisMonth,
    int UnauthorisedAbsenceDays,
    string? Remarks,
    string? ClaimPeriod = "21st-20th",
    string? ClaimType = "Claim for Month",
    decimal? FellowshipAmount = null,
    decimal? HraAmount = null);

/// <summary>
/// Edit a rejected fellowship claim to resubmit it. The fellow can update
/// leave days, HRA claim status, and remarks before resubmitting.
/// </summary>
public record EditRejectedClaimInput(
    Guid ClaimId,
    bool HraClaimed,
    int LeaveDaysTakenThisMonth,
    int UnauthorisedAbsenceDays,
    string? Remarks);

/// <summary>
/// The Dean/Director override (spec D1). The reason is required: an unexplained
/// change to someone's pay is not auditable.
/// </summary>
public record OverrideHraInput(
    Guid ClaimId,
    decimal HraAmount,
    string Reason);

/// <summary>The PI's recommended figure, entered rather than computed (spec D2).</summary>
public record RecommendAmountInput(
    Guid ClaimId,
    decimal RecommendedAmount,
    int? LeaveDaysTakenThisMonth,
    int? UnauthorisedAbsenceDays,
    string? Remarks);

public record FellowshipClaimSummary(
    Guid Id,
    Guid FellowAppointmentId,
    Guid WorkflowInstanceId,
    int ClaimYear,
    int ClaimMonth,
    string ClaimPeriod,
    string ClaimType,
    decimal FellowshipAmount,
    decimal HraAmount,
    bool HraClaimed,
    decimal TotalAmount,
    bool HraIsOverridden,
    string? HraOverrideReason,
    decimal? SanctionedHra,
    int LeaveDaysTakenThisMonth,
    int UnauthorisedAbsenceDays,
    decimal? RecommendedAmount,
    string? Remarks,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    string ScholarName,
    string RollNo,
    string DepartmentName,
    string ProjectTitle,
    string PiName,
    Guid ProjectId,
    Guid? PaymentVoucherItemId = null);

/// <summary>
/// The voucher-header fields a DA supplies when turning approved claims into
/// a payment voucher. Amounts are absent on purpose: each line is the claim's
/// own approved total, never a caller-supplied figure.
/// </summary>
public record CreateFellowshipVoucherInput(
    string CoordinatorNameDept,
    string ProjectSanctionNo,
    string PaymentTo,
    string? FundingAgency);


public enum FellowshipClaimBulkAction
{
    Approve,
    Reject,
    Return,
}

public record RaiseLeaveInput(
    LeaveType LeaveType,
    List<DateOnly> Dates,
    List<DateOnly>? OutOfStationDates,
    string? Purpose);

public record LeaveRequestSummary(
    Guid Id,
    Guid FellowAppointmentId,
    Guid WorkflowInstanceId,
    LeaveType LeaveType,
    List<DateOnly> Dates,
    List<DateOnly> OutOfStationDates,
    int DayCount,
    string? Purpose,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    bool HasPendingCancellation = false,
    bool IsCancellation = false);

/// <summary>
/// <paramref name="PendingDays"/> is shown separately because it is counted
/// against the balance: a fellow needs to see why their remaining allowance is
/// lower than approved leave alone would suggest.
/// </summary>
public record LeaveBalance(
    LeaveType LeaveType,
    int ProjectYear,
    int EntitledDays,
    int ConsumedDays,
    int PendingDays,
    int RemainingDays);

public record LeaveRequestDetail(
    Guid Id,
    Guid FellowAppointmentId,
    Guid WorkflowInstanceId,
    string ApplicantName,
    string Designation,
    string DepartmentName,
    string ProjectTitle,
    string PiName,
    LeaveType LeaveType,
    List<DateOnly> Dates,
    List<DateOnly> OutOfStationDates,
    int DayCount,
    string? Purpose,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    bool IsCancellation = false);

