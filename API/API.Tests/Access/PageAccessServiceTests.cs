using API.Application.Access;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Resolution: deny beats grant beats role, and the widest scope a user holds
/// wins. Everything downstream -- the sidebar, the route guard, the API policy
/// -- reads this, so a mistake here is a mistake everywhere.
/// </summary>
public class PageAccessServiceTests
{
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid FacultyRole = Guid.NewGuid();
    private static readonly Guid DeanRole = Guid.NewGuid();

    private sealed class FakeUserRoles(params Guid[] roleIds) : IUserRoleProvider
    {
        public Task<IReadOnlyCollection<Guid>> GetRoleIdsAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyCollection<Guid>>(roleIds);
    }

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    /// <summary>Two pages in one module, enough to tell "some" from "all".</summary>
    private static async Task<(Guid ListId, Guid EditId)> SeedPagesAsync(TestDbContext db)
    {
        var module = new Module
        {
            Id = Guid.NewGuid(), Key = "projects", Name = "Projects", Group = "Faculty",
        };
        var list = new Page
        {
            Id = Guid.NewGuid(), ModuleId = module.Id, Key = "projects.list",
            Name = "Projects", Route = "/projects",
        };
        var edit = new Page
        {
            Id = Guid.NewGuid(), ModuleId = module.Id, Key = "projects.edit",
            Name = "Edit", Route = "/projects/:id/edit",
        };
        module.Pages.Add(list);
        module.Pages.Add(edit);
        db.Modules.Add(module);
        await db.SaveChangesAsync();
        return (list.Id, edit.Id);
    }

    /// <summary>
    /// No department: these tests are about role and grant resolution, and the
    /// R&amp;C widening is covered by DepartmentScopeTests. A user with no
    /// department is never widened, so scopes here are exactly what was granted.
    /// </summary>
    private sealed class NoDepartment : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<Guid?>(null);
    }

    private static PageAccessService Service(TestDbContext db, params Guid[] roles) =>
        new(db, new FakeUserRoles(roles), new InstituteWideScopeResolver(db, new NoDepartment()));

    // ---- role access --------------------------------------------------------

    [Fact]
    public async Task AUserWithNoRolesReachesNothing()
    {
        var db = CreateDb();
        await SeedPagesAsync(db);

        var pages = await Service(db).GetPagesForUserAsync(UserId);

        pages.Should().BeEmpty();
    }

    [Fact]
    public async Task RoleAccessIsTheUnionAcrossRoles()
    {
        var db = CreateDb();
        var (list, edit) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        db.RolePageAccess.Add(new RolePageAccess { RoleId = DeanRole, PageId = edit, Scope = AccessScope.Institute });
        await db.SaveChangesAsync();

        var pages = await Service(db, FacultyRole, DeanRole).GetPagesForUserAsync(UserId);

        pages.Select(p => p.PageKey).Should().BeEquivalentTo(["projects.list", "projects.edit"]);
    }

    [Fact]
    public async Task TheWidestScopeAcrossRolesWins()
    {
        // Someone who is both an HOD and a Dean sees institute-wide. Taking the
        // narrower would mean gaining a role took access away.
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Department });
        db.RolePageAccess.Add(new RolePageAccess { RoleId = DeanRole, PageId = list, Scope = AccessScope.Institute });
        await db.SaveChangesAsync();

        var scope = await Service(db, FacultyRole, DeanRole).GetScopeAsync(UserId, "projects.list");

        scope.Should().Be(AccessScope.Institute);
    }

    // ---- user grants --------------------------------------------------------

    [Fact]
    public async Task AnExplicitGrantAddsAPageNoRoleGives()
    {
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.UserPageGrants.Add(new UserPageGrant
        {
            UserId = UserId, PageId = list, Effect = GrantEffect.Grant,
            Scope = AccessScope.Own, Reason = "covering while on leave",
            GrantedByUserId = Guid.NewGuid(), GrantedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var pages = await Service(db).GetPagesForUserAsync(UserId);

        pages.Select(p => p.PageKey).Should().Equal("projects.list");
    }

    [Fact]
    public async Task AnExplicitDenyOverridesARoleThatGrantsIt()
    {
        // The point of deny: revoking one person's access must not mean editing
        // a role and taking it from everyone else who holds it.
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        db.UserPageGrants.Add(new UserPageGrant
        {
            UserId = UserId, PageId = list, Effect = GrantEffect.Deny,
            Reason = "under investigation",
            GrantedByUserId = Guid.NewGuid(), GrantedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = Service(db, FacultyRole);

        (await service.GetPagesForUserAsync(UserId)).Should().BeEmpty();
        (await service.CanAccessAsync(UserId, "projects.list")).Should().BeFalse();
    }

    [Fact]
    public async Task AGrantWidensTheScopeARoleGives()
    {
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        db.UserPageGrants.Add(new UserPageGrant
        {
            UserId = UserId, PageId = list, Effect = GrantEffect.Grant,
            Scope = AccessScope.Institute, Reason = "acting head",
            GrantedByUserId = Guid.NewGuid(), GrantedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var scope = await Service(db, FacultyRole).GetScopeAsync(UserId, "projects.list");

        scope.Should().Be(AccessScope.Institute);
    }

    [Fact]
    public async Task ADenyOnOnePageLeavesTheOthers()
    {
        var db = CreateDb();
        var (list, edit) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = edit, Scope = AccessScope.Own });
        db.UserPageGrants.Add(new UserPageGrant
        {
            UserId = UserId, PageId = edit, Effect = GrantEffect.Deny,
            Reason = "read-only for now",
            GrantedByUserId = Guid.NewGuid(), GrantedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var pages = await Service(db, FacultyRole).GetPagesForUserAsync(UserId);

        pages.Select(p => p.PageKey).Should().Equal("projects.list");
    }

    // ---- lookups ------------------------------------------------------------

    [Fact]
    public async Task CanAccessIsFalseForAnUnknownPage()
    {
        var db = CreateDb();
        await SeedPagesAsync(db);

        (await Service(db, FacultyRole).CanAccessAsync(UserId, "nope.missing"))
            .Should().BeFalse();
    }

    [Fact]
    public async Task ScopeForAPageTheUserCannotReachIsNull()
    {
        // Distinguishable from Own, which would otherwise read as "allowed, but
        // narrowly" for a page they cannot open at all.
        var db = CreateDb();
        await SeedPagesAsync(db);

        (await Service(db, FacultyRole).GetScopeAsync(UserId, "projects.list"))
            .Should().BeNull();
    }

    [Fact]
    public async Task ThePageCarriesItsRouteAndModuleForTheSidebarAndGuard()
    {
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        await db.SaveChangesAsync();

        var page = (await Service(db, FacultyRole).GetPagesForUserAsync(UserId)).Single();

        page.Route.Should().Be("/projects");
        page.ModuleKey.Should().Be("projects");
        page.IsNavigable.Should().BeTrue();
        page.Scope.Should().Be(AccessScope.Own);
    }

    [Fact]
    public async Task ResultsAreCachedForTheServiceLifetime()
    {
        // Scoped per request: one request checks access repeatedly -- sidebar,
        // guard, policy -- and should not re-query for each.
        var db = CreateDb();
        var (list, _) = await SeedPagesAsync(db);
        db.RolePageAccess.Add(new RolePageAccess { RoleId = FacultyRole, PageId = list, Scope = AccessScope.Own });
        await db.SaveChangesAsync();

        var service = Service(db, FacultyRole);
        await service.GetPagesForUserAsync(UserId);

        db.RolePageAccess.RemoveRange(db.RolePageAccess);
        await db.SaveChangesAsync();

        (await service.GetPagesForUserAsync(UserId)).Should().HaveCount(1);
    }
}
