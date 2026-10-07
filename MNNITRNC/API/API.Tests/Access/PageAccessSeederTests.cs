using API.Application.Access;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// The seed has to reproduce today's visibility exactly. Anything here that
/// disagrees with <c>Sidebar.jsx</c> is a bug in the seed, not a test to relax.
/// </summary>
public class PageAccessSeederTests
{
    private static readonly string[] AllRoles =
    [
        "Faculty", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean",
        "Applicant", "Fellow", "Director", "SuperAdmin", "HOD", "Library",
    ];

    private static Dictionary<string, Guid> RoleIds() =>
        AllRoles.ToDictionary(r => r, _ => Guid.NewGuid());

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<(TestDbContext Db, Dictionary<string, Guid> Roles)> SeededAsync()
    {
        var db = CreateDb();
        var roles = RoleIds();
        await PageAccessSeeder.SeedAsync(db, roles);
        return (db, roles);
    }

    /// <summary>The page keys a role can reach.</summary>
    private static async Task<List<string>> PagesForAsync(
        TestDbContext db, Dictionary<string, Guid> roles, string role) =>
        await db.RolePageAccess
            .Where(a => a.RoleId == roles[role])
            .Join(db.Pages, a => a.PageId, p => p.Id, (_, p) => p.Key)
            .OrderBy(k => k)
            .ToListAsync();

    [Fact]
    public async Task EveryCatalogueModuleAndPageIsSeeded()
    {
        var (db, _) = await SeededAsync();

        db.Modules.Should().HaveCount(PageCatalogue.Modules.Length);
        db.Pages.Should().HaveCount(PageCatalogue.Modules.Sum(m => m.Pages.Length));
    }

    [Fact]
    public async Task ANewPageAddedToAnAlreadySeededModuleIsStillSeeded()
    {
        // Reproduces a real gap: on a live database, "reports" already
        // existed from Phase 10 when an 8th report page was added to
        // PageCatalogue. SeedAsync's module loop skips a module outright
        // once its key exists (it exists to keep the seed idempotent, not to
        // freeze a module's page list), so a page added to the catalogue
        // after go-live must still appear the next time the app starts.
        var db = CreateDb();
        var roles = RoleIds();

        // Simulate "reports" already existing from an earlier deploy, with
        // one fewer page than the catalogue defines today.
        var reportsCatalogue = PageCatalogue.Modules.Single(m => m.Key == "reports");
        var missingPageKey = reportsCatalogue.Pages[^1].Key;

        var module = new API.Domain.Entities.Module
        {
            Id = Guid.NewGuid(),
            Key = reportsCatalogue.Key,
            Name = reportsCatalogue.Name,
            Group = reportsCatalogue.Group,
            DisplayOrder = 1,
        };
        db.Modules.Add(module);

        var pageOrder = 0;
        foreach (var pageSeed in reportsCatalogue.Pages.Where(p => p.Key != missingPageKey))
        {
            pageOrder++;
            db.Pages.Add(new API.Domain.Entities.Page
            {
                Id = Guid.NewGuid(),
                ModuleId = module.Id,
                Key = pageSeed.Key,
                Name = pageSeed.Name,
                Route = pageSeed.Route,
                IsNavigable = pageSeed.IsNavigable,
                DisplayOrder = pageOrder,
            });
        }
        await db.SaveChangesAsync();

        await PageAccessSeeder.SeedAsync(db, roles);

        (await db.Pages.Select(p => p.Key).ToListAsync())
            .Should().Contain(missingPageKey, "a page added to the catalogue after go-live must still get seeded");
    }

    [Fact]
    public async Task TheSeedIsIdempotent()
    {
        var (db, roles) = await SeededAsync();
        var modules = db.Modules.Count();
        var pages = db.Pages.Count();
        var access = db.RolePageAccess.Count();

        await PageAccessSeeder.SeedAsync(db, roles);

        db.Modules.Count().Should().Be(modules);
        db.Pages.Count().Should().Be(pages);
        db.RolePageAccess.Count().Should().Be(access);
    }

    [Fact]
    public async Task PageKeysAndRoutesAreUnique()
    {
        // Route uniqueness matters most: the guard resolves a location to a
        // page, so a duplicate would make access non-deterministic.
        var (db, _) = await SeededAsync();

        (await db.Pages.Select(p => p.Key).ToListAsync()).Should().OnlyHaveUniqueItems();
        (await db.Pages.Select(p => p.Route).ToListAsync()).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task FacultySeesTheSidebarLinksItSeesToday()
    {
        var (db, roles) = await SeededAsync();

        var pages = await PagesForAsync(db, roles, "Faculty");

        pages.Should().Contain(
        [
            "projects.list", "expenditure.details", "expenditure.add-grant",
            "project-types.type1", "project-types.type5",
        ]);
        pages.Should().NotContain("queues.assigned", "faculty is not office staff");
        pages.Should().NotContain("fellowship.claims", "faculty is not a fellow");
    }

    [Fact]
    public async Task ProjectsNewIsOfficeOnly_NotFaculty()
    {
        // A project should normally come from a sanctioned research
        // proposal (ProposalAgencyActions' "Record sanction" action), not
        // this manual form -- Faculty create through /proposals/new
        // instead. Manual creation is a fallback for legacy/offline-
        // sanctioned projects, restricted to the R&C office roles.
        var (db, roles) = await SeededAsync();

        (await PagesForAsync(db, roles, "Faculty"))
            .Should().NotContain("projects.new", "a PI creates a proposal, not a project, directly");

        (await PagesForAsync(db, roles, "RegularStaff"))
            .Should().Contain("projects.new");
    }

    [Fact]
    public async Task FellowSeesFellowshipAndLeaveOnly()
    {
        var (db, roles) = await SeededAsync();

        var pages = await PagesForAsync(db, roles, "Fellow");

        pages.Should().Contain(["fellowship.claims", "leave.requests", "travel.requests", "applications.mine"]);
        pages.Should().NotContain("projects.list", "a fellow is not a PI");
    }

    [Fact]
    public async Task AssignedRequestsStaysRegularStaffOnly()
    {
        // The asymmetry in the sidebar today: Assigned Requests is
        // isRegularStaff while the other three queues are isOffice. Tidying it
        // would be a visibility change disguised as a seed.
        var (db, roles) = await SeededAsync();

        (await PagesForAsync(db, roles, "RegularStaff")).Should().Contain("queues.assigned");
        (await PagesForAsync(db, roles, "Dean")).Should().NotContain("queues.assigned");
        (await PagesForAsync(db, roles, "Superintendent")).Should().NotContain("queues.assigned");
    }

    [Fact]
    public async Task OfficeRolesSeeTheOtherQueues()
    {
        var (db, roles) = await SeededAsync();

        foreach (var role in new[] { "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff" })
        {
            (await PagesForAsync(db, roles, role))
                .Should().Contain("queues.processed", $"{role} is office staff");
        }
    }

    [Fact]
    public async Task DirectorIsNotAnOfficeRoleForThesePages()
    {
        // The pre-Phase-8 sidebar's isOffice was
        // isDean || isDeputyRegistrar || isSuperintendent || isRegularStaff --
        // it did not include Director. An earlier version of the catalogue did,
        // which would have handed the Director ten office pages they never had.
        // Whether they should have them is a real question, but it is a
        // configuration change to make deliberately, not one to seed in.
        //
        // content.announcements is the deliberate exception:
        // AnnouncementsController.ManageRoles already granted Director this
        // write API before the page/[PageAccess] gate existed, so excluding
        // Director here would have silently taken that access away rather
        // than reproduced it.
        var (db, roles) = await SeededAsync();

        var pages = await PagesForAsync(db, roles, "Director");

        pages.Should().NotContain("queues.processed");
        pages.Should().NotContain("payments.update");
        pages.Should().Contain("content.announcements");
    }

    [Fact]
    public async Task OnlySuperAdminReachesTheAdminPages()
    {
        var (db, roles) = await SeededAsync();

        (await PagesForAsync(db, roles, "SuperAdmin"))
            .Should().Contain(["workflow-config.routes", "access-config.roles"]);

        foreach (var role in new[] { "Dean", "Director", "Faculty" })
        {
            (await PagesForAsync(db, roles, role))
                .Should().NotContain("access-config.roles",
                    $"{role} decides requests, it does not configure who decides");
        }
    }

    [Fact]
    public async Task HodIsSeededWithNoModuleAccessBeyondTheUniversalPagesAndItsOwnQueue()
    {
        // Nothing in the shipped (pre-Phase-9) application was HOD-gated, so
        // granting it a module here would have invented behaviour rather than
        // preserved it. Phase 9's research proposal chain was the first
        // genuinely HOD-gated feature -- ProposalsController.ListForHod is
        // itself [Authorize(Roles = "HOD")] -- so the HOD role reaches its
        // own department queue and the proposal detail page it needs to act
        // on what that queue lists. Phase 10's reporting dashboard is the
        // second: an HOD legitimately needs their department's reports, the
        // same reasoning that gave them the proposal queue. Everything else
        // remains absent, preserving the rest of this test's original
        // guarantee.
        //
        // It also gets the universal pages -- dashboard and profile -- because
        // "everyone signed in" includes an HOD, and a role that can sign in but
        // reach nothing at all would be a broken account rather than a narrow
        // one. That is the rule the first version of this test got wrong.
        var (db, roles) = await SeededAsync();

        var pages = await PagesForAsync(db, roles, "HOD");

        // An HOD also reaches Projects, Procurement, Travel and Recruitment
        // now -- ProjectService.GetAsync (and the sibling pages) widen to an
        // HOD's own department, not just their own records, the same
        // department-visibility rule the proposal queue above already gave
        // them (see PageCatalogue's projects.*/procurement.*/travel.*/
        // recruitment.* entries). The seven hod.* pages are the newest
        // addition: frontend-only mockups (no API behind them yet) that
        // shipped hardcoded as visible to every role before being
        // registered here -- see PageCatalogue's "hod" module.
        // noc.requests/id-card.requests/payment.voucher are the newest
        // additions -- real, API-backed features (NocRequestsController,
        // PaymentVouchersController), granted to Fellow/Faculty/HOD/Office
        // alike since each of those roles legitimately raises or acts on
        // one of these requests. process-bill.list and
        // recruitment.applications are two more genuinely new features
        // (Process Bill page granted to Everyone; Candidate Applications
        // granted alongside recruitment.detail to the same Faculty/HOD/Dean/
        // SuperAdmin/ComputerCentre/Office set) -- see PageCatalogue's
        // procurement and recruitment modules.
        // faculty-registrations.review is the newest addition: the Faculty
        // self-registration review queue, granted to HOD (department-scoped)
        // alongside the Office roles -- see PageCatalogue's
        // faculty-registration module.
        // hod.travels is granted to HOD alongside Office/Director/SuperAdmin --
        // an HOD approves their own department's travel requests, the same
        // department-visibility rule as hod.indents/hod.joining above.
        // medical-facility.requests is granted to HOD alongside
        // Fellow/Applicant/Candidate/Faculty/Office, the same shape as its
        // sibling experience-certificate.requests -- see PageCatalogue's
        // leave module.
        pages.Should().BeEquivalentTo([
            "dashboard.home", "dashboard.profile",
            "proposals-hod.queue", "proposals.detail",
            "reports.number-of-projects", "reports.grant-sanctioned", "reports.project-expenditure",
            "reports.project-overhead", "reports.refunds", "reports.staff-count", "reports.project-equipment",
            "reports.recruitment-funnel",
            "projects.list", "projects.detail",
            "procurement.list", "procurement.detail", "process-bill.list",
            "process-bill.form", "process-bill.travel-form", "process-bill.travel-form-alt",
            "travel.detail",
            "recruitment.list", "recruitment.detail", "recruitment.applications",
            "hod.dashboard", "hod.consultancy", "hod.fellowships", "hod.leaves",
            "hod.indents", "hod.travels", "hod.joining", "hod.overhead",
            "noc.requests", "experience-certificate.requests", "medical-facility.requests",
            "id-card.requests", "payment.voucher", "noting.page",
            "grant-receipts-hod.queue",
            "faculty-registrations.review",
            "projects.reappropriations-queue",
        ]);
    }

    [Fact]
    public async Task EveryoneReachesTheDashboard()
    {
        var (db, roles) = await SeededAsync();

        foreach (var role in AllRoles)
        {
            (await PagesForAsync(db, roles, role))
                .Should().Contain("dashboard.home", $"{role} signs in and lands somewhere");
        }
    }

    [Fact]
    public async Task FacultyPagesAreOwnScopedAndOfficePagesDepartmentScoped()
    {
        // Faculty pages are Own -- a PI sees their own work. Office pages seed
        // at Department, not Institute directly: PageAccessService is what
        // widens Department to Institute for R&C staff. Seeding Institute here
        // would make every Dean institute-wide regardless of where they work,
        // which is the bug DepartmentScopeTests exists to prevent.
        //
        // projects.list, hod.leaves, hod.travels, recruitment.list,
        // recruitment.detail, recruitment.applications and process-bill.list
        // are the deliberate exceptions: each is a page shared across
        // Faculty/HOD/every office role at once, each holding a genuinely
        // different real scope, so the single catalogue-level AccessScope is
        // informational only for them -- exactly the precedent
        // ReportingService's reports.* pages already set (see
        // IReportingService's doc comment). hod.leaves' and hod.travels'
        // actual per-caller authorization is each controller's own
        // [Authorize(Roles=...)]/[PageAccess] attributes, not this seeded
        // value. recruitment.list/.detail/.applications are
        // [PageAccess]-gated per action in RecruitmentController, most of
        // which stay Faculty-only via recruitment.pi-manage/dean-review
        // regardless of these pages' own Institute scope. process-bill.list
        // is granted to Everyone at Institute scope for the same reason.
        var (db, roles) = await SeededAsync();

        var facultyExceptions = new[] { "projects.list", "hod.leaves", "hod.travels", "recruitment.list", "recruitment.detail", "recruitment.applications", "process-bill.list", "process-bill.form", "process-bill.travel-form", "process-bill.travel-form-alt" };
        var facultyScopes = await db.RolePageAccess
            .Where(a => a.RoleId == roles["Faculty"])
            .Join(db.Pages, a => a.PageId, p => p.Id, (a, p) => new { p.Key, a.Scope })
            .Where(x => !facultyExceptions.Contains(x.Key))
            .Select(x => x.Scope)
            .Distinct()
            .ToListAsync();

        facultyScopes.Should().Equal(AccessScope.Own);

        var deanQueue = await db.RolePageAccess
            .Where(a => a.RoleId == roles["Dean"])
            .Join(db.Pages, a => a.PageId, p => p.Id, (a, p) => new { p.Key, a.Scope })
            .FirstAsync(x => x.Key == "queues.processed");

        deanQueue.Scope.Should().Be(AccessScope.Department);
    }

    [Fact]
    public void HistoricalEntriesPage_IsSeededToTheOfficeRoles()
    {
        var page = PageCatalogue.Modules
            .SelectMany(m => m.Pages)
            .Single(p => p.Key == "projects.historical-entries");

        page.Roles.Should().BeEquivalentTo(PageCatalogue.Office);
        page.Route.Should().Be("/projects/historical-entries");
        page.IsNavigable.Should().BeTrue();
    }

    [Fact]
    public async Task NonNavigablePagesAreStillPermissioned()
    {
        // 40 routes against 24 links: detail pages have no sidebar entry but
        // still need guarding, which is why pages key off routes.
        var (db, roles) = await SeededAsync();

        var pages = await PagesForAsync(db, roles, "Faculty");

        pages.Should().Contain(["projects.edit", "procurement.detail", "travel.detail"]);
        (await db.Pages.Where(p => !p.IsNavigable).CountAsync())
            .Should().BeGreaterThan(0);
    }
}
