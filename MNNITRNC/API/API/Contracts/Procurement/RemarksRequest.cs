namespace API.Contracts.Procurement;

/// <summary>
/// Request body for indent chain-action endpoints (forward/approve/reject/return).
/// A local equivalent of ProposalsController's ProposalActionRequestBody and
/// ProjectsController's GrantReceiptActionRequestBody -- each module defines
/// its own copy in its own contracts namespace.
/// </summary>
public record RemarksRequest(string? Remarks);
