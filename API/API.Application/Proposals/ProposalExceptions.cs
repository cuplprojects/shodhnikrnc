namespace API.Application.Proposals;

public class ProposalNotFoundException(Guid proposalId)
    : Exception($"Research proposal '{proposalId}' was not found.");

/// <summary>
/// A PI with no department cannot create a proposal: the HOD approval stage is
/// department-scoped, and there is nowhere to route a proposal from a PI who
/// belongs to none.
/// </summary>
public class PiHasNoDepartmentException(Guid userId)
    : Exception($"User '{userId}' has no department and cannot raise a research proposal.");

/// <summary>
/// Thrown by any transition that requires a specific <see cref="Domain.Enums.ProposalStatus"/>
/// and finds the proposal in a different one -- submitting a proposal twice,
/// recording a sanction on one that was never sent to the agency, and so on.
/// </summary>
public class InvalidProposalStatusException(Guid proposalId, string action, string requiredStatus, string actualStatus)
    : Exception($"Cannot {action} proposal '{proposalId}': requires status '{requiredStatus}', found '{actualStatus}'.");

/// <summary>
/// Only the owning PI may act on their own draft or resubmit their own returned
/// proposal.
/// </summary>
public class NotTheProposalOwnerException(Guid proposalId)
    : Exception($"Only the owning PI may act on proposal '{proposalId}'.");
