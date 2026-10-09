using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Procurement;

public class MarketCommitteeProcessTests
{
    [Fact]
    public void IsComplete_TrueOnlyWhenAllThreeStepsAreRecorded()
    {
        var process = new MarketCommitteeProcess { Id = Guid.NewGuid(), IndentType = IndentType.Consumable, IndentId = Guid.NewGuid() };
        process.IsComplete.Should().BeFalse();

        process.CommitteeFormedOn = DateOnly.FromDateTime(DateTime.UtcNow);
        process.IsComplete.Should().BeFalse();

        process.NoticeIssuedOn = DateOnly.FromDateTime(DateTime.UtcNow);
        process.IsComplete.Should().BeFalse();

        process.ComparativeStatementSignedOn = DateOnly.FromDateTime(DateTime.UtcNow);
        process.IsComplete.Should().BeTrue();
    }
}
