using API.Domain.Enums;

namespace API.Application.Fellowship;

public class FellowAppointmentNotFoundException(Guid userId)
    : Exception($"User '{userId}' has no fellow appointment.");

/// <summary>
/// The gate Phase 5 established: a fellow gains access to the fellowship and
/// leave modules only once their ID card has been issued.
/// </summary>
public class IdCardNotIssuedException(Guid appointmentId)
    : InvalidOperationException(
        $"Fellow appointment '{appointmentId}' has no ID card issued yet. " +
        "The fellowship and leave modules become available once the ID card is issued.");

public class DuplicateClaimException(int year, int month)
    : InvalidOperationException(
        $"A fellowship claim for {year}-{month:D2} already exists for this fellow.");

/// <summary>BRD A3: the HRA slip is mandatory to claim the HRA component.</summary>
public class HraSlipRequiredException()
    : InvalidOperationException(
        "An HRA slip must be uploaded before the HRA component can be claimed.");

public class ClaimOutsideTenureException(int year, int month)
    : InvalidOperationException(
        $"{year}-{month:D2} falls outside this fellow's appointment period.");

public class FellowshipClaimNotFoundException(Guid claimId)
    : Exception($"Fellowship claim '{claimId}' was not found.");

public class ClaimAlreadyVoucheredException(Guid claimId)
    : InvalidOperationException(
        $"Fellowship claim '{claimId}' has already been included in a payment voucher.");

public class ClaimNotApprovedForVoucherException(Guid claimId, WorkflowStage actualStage)
    : InvalidOperationException(
        $"Fellowship claim '{claimId}' cannot be vouchered: it is at stage " +
        $"'{actualStage}', not Approved.");

/// <summary>
/// A claim selected for a voucher costs more than its own project's
/// RecurringManpower head has left (Approved grant receipts minus recorded
/// expenditure, less earlier claims in the same voucher). A client-correctable
/// validation failure, distinct from data-integrity InvalidOperationExceptions.
/// </summary>
public class InsufficientManpowerBudgetException(
    Guid claimId, Guid projectId, decimal amount, decimal available)
    : InvalidOperationException(
        $"Claim '{claimId}' is for ₹{amount:N2}, but the available manpower budget " +
        $"balance for project '{projectId}' is only ₹{available:N2}.");

/// <summary>
/// A claim selected for a voucher belongs to a project with no
/// RecurringManpower budget head to charge it to.
/// </summary>
public class ManpowerHeadNotConfiguredException(Guid projectId)
    : InvalidOperationException(
        $"Project '{projectId}' has no RecurringManpower budget head configured.");

/// <summary>
/// The HRA override is a pay-affecting privilege reserved to the Dean or
/// Director (spec D1).
/// </summary>
public class HraOverrideNotPermittedException()
    : UnauthorizedAccessException(
        "Only a Dean or Director may override the HRA on a fellowship claim.");

public class HraOverrideAfterApprovalException(Guid claimId)
    : InvalidOperationException(
        $"Fellowship claim '{claimId}' has already been approved. Changing a settled " +
        "amount requires a fresh claim rather than an edit.");

public class LeaveRequestNotFoundException(Guid leaveRequestId)
    : Exception($"Leave request '{leaveRequestId}' was not found.");

/// <summary>
/// BRD A6: a leave request cannot exceed the remaining entitlement. Remaining
/// counts pending requests as well as approved ones, so two requests that each
/// fit individually cannot together overrun the allowance.
/// </summary>
public class InsufficientLeaveBalanceException(
    LeaveType leaveType, int requested, int remaining)
    : InvalidOperationException(
        $"{requested} day(s) of {leaveType} leave requested but only {remaining} " +
        "remain for this project year, counting leave already approved and pending.");

public class LeaveOutsideTenureException()
    : InvalidOperationException(
        "The leave dates fall outside this fellow's appointment period.");

public class SpecialLeavePurposeRequiredException()
    : InvalidOperationException(
        "Special leave is for conference participation and requires a stated purpose.");
