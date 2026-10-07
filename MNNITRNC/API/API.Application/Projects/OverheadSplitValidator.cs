using API.Domain.Enums;

namespace API.Application.Projects;

public class OverheadSplitValidator : IOverheadSplitValidator
{
    private static readonly IReadOnlyDictionary<OverheadSubHead, decimal> ExpectedRatios = new Dictionary<OverheadSubHead, decimal>
    {
        [OverheadSubHead.Idf] = 0.40m,
        [OverheadSubHead.Pdf] = 0.40m,
        [OverheadSubHead.Ddf] = 0.20m,
    };

    public OverheadSplitValidationResult Validate(decimal overheadAmount, IReadOnlyDictionary<OverheadSubHead, decimal> submittedSplit)
    {
        foreach (var subHead in ExpectedRatios.Keys)
        {
            if (!submittedSplit.ContainsKey(subHead))
            {
                return OverheadSplitValidationResult.Failure(
                    $"Missing required overhead sub-head '{subHead}'.");
            }
        }

        var submittedTotal = submittedSplit.Values.Sum();
        if (Math.Round(submittedTotal, 2) != Math.Round(overheadAmount, 2))
        {
            return OverheadSplitValidationResult.Failure(
                $"Overhead split totals {submittedTotal:F2} but must equal the overhead amount {overheadAmount:F2}.");
        }

        foreach (var (subHead, ratio) in ExpectedRatios)
        {
            var expectedAmount = Math.Round(overheadAmount * ratio, 2);
            var submittedAmount = Math.Round(submittedSplit[subHead], 2);

            if (expectedAmount != submittedAmount)
            {
                return OverheadSplitValidationResult.Failure(
                    $"Overhead sub-head '{subHead}' must be {expectedAmount:F2} ({ratio:P0} of {overheadAmount:F2}) but was {submittedAmount:F2}.");
            }
        }

        return OverheadSplitValidationResult.Success();
    }
}
