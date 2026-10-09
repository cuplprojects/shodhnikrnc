using System.ComponentModel.DataAnnotations;
using API.Domain.Enums;

namespace API.Contracts.Fellowship;

/// <summary>
/// No amounts: the fellowship and HRA are derived from the appointment and the
/// 20% rule. A fellow must not be able to name their own pay.
/// </summary>
public record RaiseClaimRequestBody(
    [Range(2000, 2100)] int ClaimYear,
    [Range(1, 12)] int ClaimMonth,
    bool HraClaimed,
    [Range(0, 31)] int LeaveDaysTakenThisMonth,
    [Range(0, 31)] int UnauthorisedAbsenceDays,
    [Required] string? Remarks,
    string? ClaimPeriod = "21st-20th",
    string? ClaimType = "Claim for Month",
    decimal? FellowshipAmount = null,
    decimal? HraAmount = null);

public record FellowAppointmentResponse(
    Guid Id,
    Guid SanctionedManpowerPositionId,
    DateOnly JoinedOn,
    DateOnly ValidTill,
    decimal RecommendedStipend,
    bool HasHraSlip);


/// <summary>
/// Edit a rejected fellowship claim to resubmit it.
/// </summary>
public record EditRejectedClaimRequestBody(
    bool HraClaimed,
    [Range(0, 31)] int LeaveDaysTakenThisMonth,
    [Range(0, 31)] int UnauthorisedAbsenceDays,
    string? Remarks);

/// <summary>Dean or Director only, and the reason is required (spec D1).</summary>
public record OverrideHraRequestBody(
    [Range(0, double.MaxValue)] decimal HraAmount,
    [Required] string Reason);

public record RecommendAmountRequestBody(
    [Range(0, double.MaxValue)] decimal RecommendedAmount,
    [Range(0, 31)] int? LeaveDaysTakenThisMonth,
    [Range(0, 31)] int? UnauthorisedAbsenceDays,
    string? Remarks);

public record ApprovalRequestBody(string? Remarks);

public record RejectionRequestBody(
    [Required] string Remarks);

public record ReturnRequestBody(
    [Required] string Remarks);

public record WithdrawRequestBody(
    string? Remarks);

public record RaiseLeaveRequestBody(
    LeaveType LeaveType,
    List<DateOnly> Dates,
    List<DateOnly>? OutOfStationDates,
    [Required] string? Purpose);
