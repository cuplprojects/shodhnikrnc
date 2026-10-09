using API.Application.Procurement;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Procurement;

public class CommitteeMembersJsonTests
{
    [Fact]
    public void Parse_RoleSentAsItsEnumName_Binds()
    {
        // The regression this class exists for: JsonSerializerDefaults.Web gives
        // camelCase property matching but not enum-name binding, so the roster the
        // UI sends was rejected with a 400 until the converter was added.
        var members = CommitteeMembersJson.Parse(
            """[{"name":"Prof. R Verma","role":"Chairperson"}]""");

        members.Should().ContainSingle();
        members[0].Name.Should().Be("Prof. R Verma");
        members[0].Role.Should().Be(CommitteeMemberRole.Chairperson);
    }

    [Fact]
    public void Parse_EveryRole_Binds()
    {
        foreach (var role in Enum.GetValues<CommitteeMemberRole>())
        {
            var members = CommitteeMembersJson.Parse($$"""[{"name":"X","role":"{{role}}"}]""");
            members.Should().ContainSingle().Which.Role.Should().Be(role);
        }
    }

    [Fact]
    public void Parse_MultipleMembers_PreservesOrder()
    {
        var members = CommitteeMembersJson.Parse(
            """[{"name":"A","role":"Chairperson"},{"name":"B","role":"FacultyMember"}]""");

        members.Should().HaveCount(2);
        members[0].Name.Should().Be("A");
        members[1].Role.Should().Be(CommitteeMemberRole.FacultyMember);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Parse_NothingSupplied_ReturnsEmpty(string? json)
    {
        CommitteeMembersJson.Parse(json).Should().BeEmpty();
    }

    [Fact]
    public void Parse_EmptyArray_ReturnsEmpty()
    {
        CommitteeMembersJson.Parse("[]").Should().BeEmpty();
    }

    [Fact]
    public void Parse_Malformed_ThrowsArgumentException()
    {
        var act = () => CommitteeMembersJson.Parse("{not json");

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Parse_UnknownRole_ThrowsArgumentException()
    {
        var act = () => CommitteeMembersJson.Parse("""[{"name":"X","role":"NotARole"}]""");

        act.Should().Throw<ArgumentException>();
    }
}
