using API.Application.Documents;
using API.Domain.Enums;

namespace API.Application.Procurement;

/// <summary>
/// Derives which Annexure form applies from GeM availability and estimated cost.
/// Thresholds mirror the legacy system's actual behaviour. Unlike legacy — which
/// trusted a client-submitted mode_of_purchase string — this is computed server-side
/// on every call so the form and its approval routing cannot be spoofed.
/// </summary>
public class ProcurementTierCalculator : IProcurementTierCalculator
{
    private const decimal BiddingThreshold = 2_500_000m;

    public ProcurementTier DetermineTier(GemAvailability gemAvailability, decimal estimatedCost)
    {
        // Handle zero or negative costs gracefully for existing indents that may have been
        // created before validation was in place. Default to the lowest tier.
        if (estimatedCost <= 0m)
        {
            return gemAvailability == GemAvailability.Yes
                ? ProcurementTier.GemUpTo50k
                : ProcurementTier.NonGemUpTo1Lakh;
        }

        // The GeM path has no upper bound: legacy's Annexure 8 covers "above
        // Rs. 1,00,000" with no ceiling. Only the non-GeM path caps at Rs. 25L,
        // above which procurement must go through bidding.
        if (gemAvailability == GemAvailability.Yes)
        {
            return estimatedCost switch
            {
                <= 50_000m => ProcurementTier.GemUpTo50k,
                <= 100_000m => ProcurementTier.Gem50kTo1Lakh,
                _ => ProcurementTier.GemAbove1Lakh,
            };
        }

        if (estimatedCost > BiddingThreshold)
        {
            throw new BiddingTierNotSupportedException(estimatedCost);
        }

        return estimatedCost switch
        {
            <= 100_000m => ProcurementTier.NonGemUpTo1Lakh,
            <= 200_000m => ProcurementTier.NonGem1LakhTo2Lakh,
            _ => ProcurementTier.NonGem2LakhTo25Lakh,
        };
    }
}
