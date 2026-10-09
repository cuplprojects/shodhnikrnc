using API.Application.Access;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Institute-wide sight comes from belonging to R&amp;C, not from role rank.
///
/// A Dean of Civil Engineering sees Civil Engineering; the same Dean role held
/// by someone in R&amp;C sees every department. Getting this backwards -- granting
/// Institute to office roles directly, as the first version did -- makes every
/// Dean institute-wide regardless of where they work.
/// </summary>
public class DepartmentScopeTests
{
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid DeanRole = Guid.NewGuid();

    private sealed class FakeUserRoles(params Guid[] roleIds) : IUserRoleProvider
    {
        public Task<IReadOnlyCollection<Guid>> GetRoleIdsAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<Guid>>(roleIds);
    }

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    /// <summary>A page the Dean role reaches at Department scope, plus two departments.</summary>
    private static async Task<(Guid PageId, Guid Civil, Guid Rnc)> SeedAsync(TestDbContext db)
    {
        var module = new Module { Id = Guid.NewGuid(), Key = "queues", Name = "Queues", Group = "Office" };
        var page = new Page
        {
            Id = Guid.NewGuid(), ModuleId = module.Id, Key = "queues.processed",
            Name = "Processed", Route = "/processed-requests",
        };
        module.Pages.Add(page);
        db.Modules.Add(module);

        var civil = new Department { Id = Guid.NewGuid(), Code = "CE", Name = "Civil Engineering" };
        var rnc = new Department
        {
            Id = Guid.NewGuid(), Code = "RNC", Name = "Research & Consultancy",
            IsInstituteWide = true,
        };
        db.Departments.Add(civil);
        db.Departments.Add(rnc);

        db.RolePageAccess.Add(new RolePageAccess
        {
            RoleId = DeanRole, PageId = page.Id, Scope = AccessScope.Department,
        });

        await db.SaveChangesAsync();
        return (page.Id, civil.Id, rnc.Id);
    }

    private static PageAccessService Service(TestDbContext db, Guid? departmentId) =>
        new(db, new FakeUserRoles(DeanRole), new InstituteWideScopeResolver(db, new FakeDepartment(departmentId)));

    [Fact]
    public async Task ADeanOfAnAcademicDepartmentIsScopedToIt()
    {
        var db = CreateDb();
        var (_, civil, _) = await SeedAsync(db);

        var scope = await Service(db, civil).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Department);
    }

    [Fact]
    public async Task TheSameRoleHeldInRncSeesInstituteWide()
    {
        var db = CreateDb();
        var (_, _, rnc) = await SeedAsync(db);

        var scope = await Service(db, rnc).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Institute);
    }

    [Fact]
    public async Task AUserWithNoDepartmentIsNotWidened()
    {
        // Nothing to widen from, and inventing institute-wide access for someone
        // with no department would be the most dangerous possible default.
        var db = CreateDb();
        await SeedAsync(db);

        var scope = await Service(db, null).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Department);
    }

    [Fact]
    public async Task OwnScopeIsNotWidenedByRncMembership()
    {
        // Own means "rows this user owns". Widening it to Institute because they
        // work in R&C would hand them everyone's personal claims, which is not
        // what a department-wide view means.
        var db = CreateDb();
        var (pageId, _, rnc) = await SeedAsync(db);
        var access = await db.RolePageAccess.SingleAsync(a => a.PageId == pageId);
        access.Scope = AccessScope.Own;
        await db.SaveChangesAsync();

        var scope = await Service(db, rnc).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Own);
    }

    [Fact]
    public async Task AnExplicitInstituteGrantStillWins()
    {
        var db = CreateDb();
        var (pageId, civil, _) = await SeedAsync(db);
        var access = await db.RolePageAccess.SingleAsync(a => a.PageId == pageId);
        access.Scope = AccessScope.Institute;
        await db.SaveChangesAsync();

        var scope = await Service(db, civil).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Institute);
    }

    [Fact]
    public async Task AnInactiveInstituteWideDepartmentStillWidens()
    {
        // IsActive is about whether a department is current, not about access.
        // Conflating them would silently narrow everyone in a department that
        // someone deactivated for an unrelated reason.
        var db = CreateDb();
        var (_, _, rnc) = await SeedAsync(db);
        var department = await db.Departments.SingleAsync(d => d.Id == rnc);
        department.IsActive = false;
        await db.SaveChangesAsync();

        var scope = await Service(db, rnc).GetScopeAsync(UserId, "queues.processed");

        scope.Should().Be(AccessScope.Institute);
    }
}
