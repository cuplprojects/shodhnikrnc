namespace API.Application.Projects;

/// <summary>
/// A grant receipt can never push a budget head's received-to-date, for the
/// year it lands in, past what was actually sanctioned for that head/year --
/// confirmed live, four retried receipts on the same head landed on the same
/// day and quadrupled the received total to 4x the sanctioned amount with
/// nothing rejecting it.
/// </summary>
public class GrantReceiptExceedsSanctionException(
    decimal attemptedTotal, decimal sanctioned, int projectYear = 0)
    : InvalidOperationException(
        $"Recording this receipt would bring the budget head's total received to " +
        $"{attemptedTotal:0.##}, exceeding the overall sanctioned amount of {sanctioned:0.##} for this budget head.");
