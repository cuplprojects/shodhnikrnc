using System.Reflection;
using API.Application.Access;
using API.Authorization;
using API.Controllers;
using FluentAssertions;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Final review finding 3: the spec required a test proving the
/// <c>[PageAccess("admin.users.manage")]</c> gate on the new admin-users
/// screen actually rejects a caller without that grant. This codebase has no
/// WebApplicationFactory-based integration test fixture anywhere -- confirmed
/// by the search <c>API.Tests.Fellowship.LeaveControllerAuthorizationTests</c>
/// already documents (searching for "*ControllerAuthorizationTests.cs" and
/// similar finds none; every controller-adjacent test in this repo is a plain
/// unit test) -- so, following that exact precedent, this uses the same
/// substitute: assert the actions carry <c>[PageAccess("admin.users.manage")]</c>,
/// which resolves to the ASP.NET policy "page:admin.users.manage".
/// PageCatalogue.cs seeds admin.users.manage to SuperAdmin alone, so any role
/// outside {SuperAdmin} is provably excluded by construction once the policy
/// name matches -- PageAccessPolicyProvider/PageAccessHandler (see
/// API/API/Authorization/PageAccessPolicy.cs) refuse any caller PageAccessDecision
/// does not report as holding this exact key, which is what a bare/missing
/// attribute would never do.
/// </summary>
public class AdminUsersControllerAuthorizationTests
{
    private const string ExpectedPolicy = PageAccessAttribute.PolicyPrefix + "admin.users.manage";

    private static PageAccessAttribute GetPageAccessAttribute(string methodName)
    {
        var method = typeof(AdminUsersController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"AdminUsersController.{methodName} was not found.");

        return method.GetCustomAttribute<PageAccessAttribute>()
            ?? throw new InvalidOperationException(
                $"AdminUsersController.{methodName} no longer carries a [PageAccess] attribute.");
    }

    [Theory]
    [InlineData(nameof(AdminUsersController.GetAll))]
    [InlineData(nameof(AdminUsersController.SetEmployeeId))]
    public void ActionsAreGatedOnTheAdminUsersManagePage(string methodName)
    {
        // This is the fix under test: a caller who does not hold
        // admin.users.manage (seeded to SuperAdmin alone) must be refused by
        // the policy this attribute wires up. Asserting the exact policy name
        // is what proves that gate is actually attached to the endpoint the
        // route-collision fix (finding 1) moved to
        // api/admin/user-management -- a missing or misspelled attribute
        // would compile fine but leave the action reachable by anyone
        // authenticated.
        var attribute = GetPageAccessAttribute(methodName);

        attribute.Policy.Should().Be(ExpectedPolicy);
    }

    [Fact]
    public void TheControllerCarriesNoBroaderClassLevelAuthorizeThatWouldMaskAMissingActionGate()
    {
        // Guards against a future edit that removes the per-action
        // [PageAccess] and relies on a bare class-level [Authorize] instead --
        // exactly the gap LeaveControllerAuthorizationTests documents for
        // LeaveController.ListAll (a bare [Authorize] with no Roles/Policy
        // imposes no real restriction). AdminUsersController carries
        // [Authorize] at the class level only to require an authenticated
        // principal; the actual page check must come from each action's own
        // [PageAccess].
        var classAuthorize = typeof(AdminUsersController)
            .GetCustomAttribute<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>();

        classAuthorize.Should().NotBeNull();
        classAuthorize!.Policy.Should().BeNull(
            "the class-level [Authorize] must stay a bare authentication check; " +
            "the real admin.users.manage gate belongs on each action's [PageAccess], " +
            "not smuggled in as a class-level policy that could silently cover a future " +
            "ungated action.");
    }
}
