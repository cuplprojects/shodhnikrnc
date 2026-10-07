using API.Application.Projects;
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record GrantReceiptResponse(
    Guid Id,
    Guid BudgetHeadId,
    DateOnly ReceivedDate,
    decimal Amount,
    GrantReceiptType Type,
    Guid? ParentReceiptId,
    OverheadSubHead? SubHead,
    string? TransactionReference = null,
    PaymentMode? PaymentMode = null,
    string? SchemeCode = null,
    // Added so a PI's own receipts list (ProjectDetailPage.jsx) can show
    // whether a receipt is still PendingApproval or has actually landed as
    // Approved/Rejected -- previously omitted entirely, which meant a PI had
    // no way to tell a submitted-but-unapproved receipt from a confirmed one.
    GrantReceiptStatus Status = GrantReceiptStatus.PendingApproval,
    Guid? WorkflowInstanceId = null,
    string? Remarks = null);

/// <summary>
/// Body for the grant-receipt approval chain's Forward/Approve/Reject/Return
/// actions. A local equivalent of ProposalsController's
/// ProposalActionRequestBody and RecruitmentController's RemarksRequestBody
/// -- neither is reused here, matching how each of those two controllers
/// already defines its own copy in its own contracts namespace rather than
/// sharing one across modules.
/// </summary>
public record GrantReceiptActionRequestBody(string? Remarks);

/// <summary>
/// Body for the bulk chain-action endpoint: the same action applied to every
/// listed receipt, sharing one remarks value across the whole batch.
/// </summary>
public record GrantReceiptBulkActionRequestBody(
    IReadOnlyCollection<Guid> ReceiptIds, GrantReceiptBulkAction Action, string? Remarks);
