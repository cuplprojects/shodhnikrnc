using System.Reflection;
using API.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// LeaveController.ListAll (GET api/leave-requests) previously carried a bare
/// [Authorize] with no role restriction at all -- any signed-in user could
/// see every leave request institute-wide, unscoped by department. This
/// codebase has no WebApplicationFactory-based integration test fixture
/// anywhere (confirmed by searching for "*ControllerAuthorizationTests.cs" and
/// similar -- none exists; every controller-adjacent test in this repo is a
/// plain unit test), so per the task brief this uses the simpler, equally
/// decisive substitute: assert the [Authorize(Roles=...)] attribute on the
/// action carries exactly the role list PageCatalogue.cs's hod.leaves grant
/// already declares. A role outside that list (e.g. "Fellow" or "Applicant")
/// is provably excluded by construction once the attribute lists an explicit,
/// closed role set -- ASP.NET's role-based authorization refuses any role not
/// named in Roles, which is what the pre-fix bare [Authorize] never did.
/// </summary>
public class LeaveControllerAuthorizationTests
{
    private const string ExpectedRoles =
        "Faculty,HOD,RegularStaff,Superintendent,DeputyRegistrar,Dean,Director,SuperAdmin";

    private static AuthorizeAttribute GetListAllAuthorizeAttribute()
    {
        var method = typeof(LeaveController).GetMethod(nameof(LeaveController.ListAll))
            ?? throw new InvalidOperationException("LeaveController.ListAll was not found.");

        return method.GetCustomAttribute<AuthorizeAttribute>()
            ?? throw new InvalidOperationException(
                "LeaveController.ListAll no longer carries an [Authorize] attribute.");
    }

    [Fact]
    public void ListAllIsRestrictedToTheHodLeavesRoleList()
    {
        // This is the fix under test: today's code (before this task) carried
        // a bare [Authorize] with Roles == null, which lets ANY authenticated
        // role through -- including "Fellow" or "Applicant", neither of which
        // belongs on an institute-wide leave-request queue. Asserting the
        // exact role string is what proves those roles are now excluded.
        var attribute = GetListAllAuthorizeAttribute();

        attribute.Roles.Should().Be(ExpectedRoles);
    }

    [Theory]
    [InlineData("Fellow")]
    [InlineData("Applicant")]
    public void ARoleOutsideTheAllowedListIsNotAmongTheAllowedRoles(string outsideRole)
    {
        // Restates the same fact per-role, in the shape the brief's
        // "ListAllRejectsARoleOutsideTheAllowedList" scenario asks for: a role
        // outside {Faculty, HOD, RegularStaff, Superintendent,
        // DeputyRegistrar, Dean, Director, SuperAdmin} must not appear in the
        // attribute's role list -- ASP.NET's RolesAuthorizationRequirement
        // 403s any principal holding none of the listed roles, so this is
        // exactly what stands between "Fellow" and a 200 from this endpoint.
        var attribute = GetListAllAuthorizeAttribute();
        var allowedRoles = attribute.Roles!.Split(',');

        allowedRoles.Should().NotContain(outsideRole);
    }

    [Fact]
    public void TodaysGapWouldHaveLetAnyRoleThrough()
    {
        // Documents the gap this task fixes: a bare [Authorize] (Roles is
        // null/empty) imposes no role restriction whatsoever -- every
        // authenticated user, regardless of role, passes. This test fails
        // against the pre-fix controller (Roles is null there) and passes
        // once ListAll carries the explicit role list, which is the
        // observable difference between the vulnerable and fixed code.
        var attribute = GetListAllAuthorizeAttribute();

        attribute.Roles.Should().NotBeNullOrEmpty(
            "a bare [Authorize] with no Roles imposes no restriction at all, " +
            "which was the real, pre-existing access-control gap.");
    }
}
