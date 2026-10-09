using API.Application.Access;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// The decision behind <c>[PageAccess("key")]</c>, which replaces
/// <c>[Authorize(Roles = "Faculty")]</c>. The cases that matter are the ones an
/// attribute could not get wrong: a missing identity, a malformed one, and a
/// page the caller does not hold.
/// </summary>
public class PageAccessDecisionTests
{
    private static readonly Guid UserId = Guid.NewGuid();

    private sealed class FakeAccess(params string[] allowedKeys) : IPageAccessService
    {
        public Task<IReadOnlyList<AccessiblePage>> GetPagesForUserAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<AccessiblePage>>(
                allowedKeys.Select(k => new AccessiblePage(
                    k, k, "/" + k, "m", "M", "G", true, AccessScope.Own, 1, 1)).ToList());

        public Task<bool> CanAccessAsync(Guid userId, string pageKey, CancellationToken ct = default) =>
            Task.FromResult(allowedKeys.Contains(pageKey));

        public Task<AccessScope?> GetScopeAsync(Guid userId, string pageKey, CancellationToken ct = default) =>
            Task.FromResult<AccessScope?>(allowedKeys.Contains(pageKey) ? AccessScope.Own : null);
    }

    private static PageAccessDecision Decision(params string[] allowed) =>
        new(new FakeAccess(allowed));

    [Fact]
    public async Task ACallerHoldingThePageIsAllowed()
    {
        var allowed = await Decision("projects.list")
            .IsAllowedAsync(UserId.ToString(), "projects.list");

        allowed.Should().BeTrue();
    }

    [Fact]
    public async Task ACallerWithoutThePageIsRefused()
    {
        var allowed = await Decision("fellowship.claims")
            .IsAllowedAsync(UserId.ToString(), "projects.list");

        allowed.Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-guid")]
    public async Task AnAbsentOrMalformedSubjectIsRefused(string? subject)
    {
        // Fails closed. Succeeding here would make the check bypassable by
        // presenting no identity at all, which is precisely the failure an
        // [Authorize] attribute cannot have.
        var allowed = await Decision("projects.list").IsAllowedAsync(subject, "projects.list");

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task HoldingNoPagesAtAllIsRefused()
    {
        var allowed = await Decision().IsAllowedAsync(UserId.ToString(), "projects.list");

        allowed.Should().BeFalse();
    }
}
