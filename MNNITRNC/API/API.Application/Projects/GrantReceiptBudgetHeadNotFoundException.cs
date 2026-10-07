namespace API.Application.Projects;

/// <summary>
/// A grant receipt's stored BudgetHeadId does not match any budget head
/// currently on its project -- a stale/orphaned reference (e.g. the
/// project's budget heads were edited/recreated after the receipt was
/// recorded), not something the caller did wrong. Approving/rejecting such
/// a receipt cannot re-check it against a sanctioned amount that no longer
/// resolves, so this is surfaced as a clear error instead of the unhandled
/// InvalidOperationException a raw .First() lookup previously threw.
/// </summary>
public class GrantReceiptBudgetHeadNotFoundException(Guid grantReceiptId, Guid budgetHeadId)
    : InvalidOperationException(
        $"Grant receipt '{grantReceiptId}' references budget head '{budgetHeadId}', which no longer " +
        "exists on this project. This receipt's data needs to be corrected before it can be approved.");
