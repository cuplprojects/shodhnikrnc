using API.Application.Documents;
using API.Application.Procurement;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Procurement;

public class ProcurementTierCalculatorTests
{
    private readonly ProcurementTierCalculator _calculator = new();

    [Theory]
    [InlineData(1, ProcurementTier.GemUpTo50k)]
    [InlineData(50_000, ProcurementTier.GemUpTo50k)]
    [InlineData(50_001, ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(100_000, ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(100_001, ProcurementTier.GemAbove1Lakh)]
    [InlineData(5_000_000, ProcurementTier.GemAbove1Lakh)]
    public void DetermineTier_Gem_MapsCostToCorrectAnnexure(decimal cost, ProcurementTier expected)
    {
        _calculator.DetermineTier(GemAvailability.Yes, cost).Should().Be(expected);
    }

    [Theory]
    [InlineData(1, ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(100_000, ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(100_001, ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(200_000, ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(200_001, ProcurementTier.NonGem2LakhTo25Lakh)]
    [InlineData(2_500_000, ProcurementTier.NonGem2LakhTo25Lakh)]
    public void DetermineTier_NonGem_MapsCostToCorrectAnnexure(decimal cost, ProcurementTier expected)
    {
        _calculator.DetermineTier(GemAvailability.No, cost).Should().Be(expected);
    }

    [Fact]
    public void DetermineTier_NonGemAboveBiddingThreshold_Throws()
    {
        var act = () => _calculator.DetermineTier(GemAvailability.No, 2_500_001m);

        act.Should().Throw<BiddingTierNotSupportedException>();
    }

    [Theory]
    [InlineData(GemAvailability.Yes, ProcurementTier.GemUpTo50k)]
    [InlineData(GemAvailability.No, ProcurementTier.NonGemUpTo1Lakh)]
    public void DetermineTier_ZeroOrNegativeCost_FallsBackToLowestTier(GemAvailability gemAvailability, ProcurementTier expected)
    {
        // Renamed from DetermineTier_ZeroOrNegativeCost_Throws: the
        // implementation deliberately falls back to the lowest tier for
        // zero/negative cost (existing indents created before validation was
        // in place), rather than throwing -- see ProcurementTierCalculator's
        // own comment on this behavior.
        _calculator.DetermineTier(gemAvailability, 0m).Should().Be(expected);
        _calculator.DetermineTier(gemAvailability, -1m).Should().Be(expected);
    }
}
