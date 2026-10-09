namespace API.Application.Procurement;

/// <summary>
/// The Non-GeM Rs.2L-25L procurement band's indent has not yet had all three
/// Market Committee steps (formed, notice issued, comparative statement
/// signed) recorded, so it cannot proceed past the Dean/R&C (ForwardedDR)
/// stage.
/// </summary>
public class MarketCommitteeProcessIncompleteException(Guid indentId)
    : InvalidOperationException(
        $"Indent '{indentId}' requires its Market Committee process (formed, notice issued, comparative statement signed) to be fully recorded before it can be approved or forwarded past the Dean/R&C stage.");
