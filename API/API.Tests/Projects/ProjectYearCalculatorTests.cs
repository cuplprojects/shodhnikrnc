using API.Application.Projects;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class ProjectYearCalculatorTests
{
    private readonly ProjectYearCalculator _calculator = new();

    [Fact]
    public void GetProjectYear_SameFinancialYearAsStart_ReturnsYear1()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2024, 11, 1);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(1);
    }

    [Fact]
    public void GetProjectYear_NextFinancialYear_ReturnsYear2()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2025, 4, 2);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(2);
    }

    [Fact]
    public void GetProjectYear_StartInMarch_TransactionInAprilSameCalendarYear_ReturnsYear2()
    {
        var start = new DateOnly(2024, 3, 20);
        var transaction = new DateOnly(2024, 4, 5);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(2);
    }

    [Fact]
    public void GetProjectYear_ThreeFinancialYearsLater_ReturnsYear4()
    {
        var start = new DateOnly(2022, 5, 1);
        var transaction = new DateOnly(2025, 5, 1);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(4);
    }

    [Fact]
    public void GetProjectYear_TransactionBeforeStart_Throws()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2024, 1, 1);

        var act = () => _calculator.GetProjectYear(start, transaction);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void GetProjectYear_SameDate_ReturnsYear1()
    {
        var date = new DateOnly(2024, 6, 15);

        var year = _calculator.GetProjectYear(date, date);

        year.Should().Be(1);
    }
}
