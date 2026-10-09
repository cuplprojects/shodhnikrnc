namespace API.Application.Projects;

public class ReappropriationExceedsSanctionException(string toHeadName, decimal wouldBeTotal, decimal sanctioned)
    : InvalidOperationException(
        $"Cannot re-appropriate into '{toHeadName}': the resulting received total ({wouldBeTotal:F2}) would " +
        $"exceed its sanctioned budget ({sanctioned:F2}).");
