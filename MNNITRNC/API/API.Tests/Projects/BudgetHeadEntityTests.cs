using API.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class BudgetHeadEntityTests
{
    [Fact]
    public void Year4And5Amount_DefaultToZero()
    {
        var head = new BudgetHead { Id = Guid.NewGuid(), ProjectId = Guid.NewGuid() };

        head.Year4Amount.Should().Be(0m);
        head.Year5Amount.Should().Be(0m);
    }
}
