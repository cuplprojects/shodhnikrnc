namespace API.Application.Projects;

public class ReappropriationExceedsReceivedException(string fromHeadName, decimal amount, decimal available)
    : InvalidOperationException(
        $"Cannot re-appropriate {amount:F2} out of '{fromHeadName}': only {available:F2} has actually been " +
        "received into this head so far.");
