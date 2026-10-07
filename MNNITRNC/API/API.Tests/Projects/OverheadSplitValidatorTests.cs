using API.Application.Projects;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class OverheadSplitValidatorTests
{
    private readonly OverheadSplitValidator _validator = new();

    [Fact]
    public void Validate_ExactMatchingSplit_ReturnsSuccess()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
            [OverheadSubHead.Ddf] = 2000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_SplitDoesNotSumToOverheadAmount_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
            [OverheadSubHead.Ddf] = 1000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
        result.ErrorMessage.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Validate_SumMatchesButRatioWrong_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 5000m,
            [OverheadSubHead.Pdf] = 3000m,
            [OverheadSubHead.Ddf] = 2000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_MissingSubHead_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_RoundedAmountsWithinTolerance_ReturnsSuccess()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 3333.33m,
            [OverheadSubHead.Pdf] = 3333.33m,
            [OverheadSubHead.Ddf] = 1666.67m,
        };

        var result = _validator.Validate(8333.33m, split);

        result.IsValid.Should().BeTrue();
    }
}
