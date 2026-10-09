using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Scope is compared by value when resolving what a user holds, so its order is
/// load-bearing rather than cosmetic: rearranging the enum would silently
/// narrow or widen every permission in the system.
/// </summary>
public class AccessScopeTests
{
    [Fact]
    public void ScopesAreOrderedNarrowestToWidest()
    {
        ((int)AccessScope.Own).Should().BeLessThan((int)AccessScope.Department);
        ((int)AccessScope.Department).Should().BeLessThan((int)AccessScope.Institute);
    }

    [Theory]
    [InlineData(AccessScope.Own, 0)]
    [InlineData(AccessScope.Department, 1)]
    [InlineData(AccessScope.Institute, 2)]
    public void ScopeValuesArePinned(AccessScope scope, int expected)
    {
        // Persisted as ints. Pinning them means a reordering breaks a test here
        // rather than quietly repointing stored permissions at the wrong scope.
        ((int)scope).Should().Be(expected);
    }

    [Fact]
    public void TheWidestScopeWins()
    {
        // A user who is both an HOD and a Dean sees institute-wide, not the
        // narrower of the two -- otherwise holding an extra role would take
        // access away.
        var held = new[] { AccessScope.Department, AccessScope.Institute, AccessScope.Own };

        held.Max().Should().Be(AccessScope.Institute);
    }

    [Fact]
    public void GrantEffectValuesArePinned()
    {
        ((int)GrantEffect.Grant).Should().Be(0);
        ((int)GrantEffect.Deny).Should().Be(1);
    }
}
