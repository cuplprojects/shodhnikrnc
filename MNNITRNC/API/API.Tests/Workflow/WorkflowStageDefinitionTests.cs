using API.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// AllowedRoles is stored as a delimited string, so parsing it is the one place
/// a stage definition can quietly get authorization wrong: a stray space around
/// a role name would mean the engine compares "Dean" against " Dean" and refuses
/// a Dean.
/// </summary>
public class WorkflowStageDefinitionTests
{
    private static WorkflowStageDefinition StageWith(string allowedRoles) =>
        new() { AllowedRoles = allowedRoles };

    [Fact]
    public void AllowedRoleList_SplitsOnCommas()
    {
        StageWith("Dean,Director").AllowedRoleList()
            .Should().Equal("Dean", "Director");
    }

    [Fact]
    public void AllowedRoleList_TrimsSurroundingWhitespace()
    {
        StageWith("Dean, Director , Superintendent").AllowedRoleList()
            .Should().Equal("Dean", "Director", "Superintendent");
    }

    [Fact]
    public void AllowedRoleList_DropsEmptyEntriesFromStrayCommas()
    {
        StageWith("Dean,,Director,").AllowedRoleList()
            .Should().Equal("Dean", "Director");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void AllowedRoleList_IsEmptyWhenNoRolesAreSet(string allowedRoles)
    {
        // The initial stage belongs to whoever raised the request, not to a role.
        StageWith(allowedRoles).AllowedRoleList().Should().BeEmpty();
    }
}
