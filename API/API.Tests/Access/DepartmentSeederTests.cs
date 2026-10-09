using API.Application.Access;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

public class DepartmentSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task SeedsTheDepartmentList()
    {
        var db = CreateDb();

        await DepartmentSeeder.SeedAsync(db);

        db.Departments.Should().HaveCount(DepartmentSeeder.Departments.Length);
    }

    [Fact]
    public async Task TheSeedIsIdempotent()
    {
        var db = CreateDb();
        await DepartmentSeeder.SeedAsync(db);
        var first = db.Departments.Count();

        await DepartmentSeeder.SeedAsync(db);

        db.Departments.Count().Should().Be(first);
    }

    [Fact]
    public async Task DoesNotOverwriteARenamedDepartment()
    {
        // An operator renaming a department must not have it reset on the next
        // startup; the seed is keyed on Code, not Name.
        var db = CreateDb();
        await DepartmentSeeder.SeedAsync(db);
        var csed = await db.Departments.SingleAsync(d => d.Code == "CSED");
        csed.Name = "Computer Science & Engineering (Renamed)";
        await db.SaveChangesAsync();

        await DepartmentSeeder.SeedAsync(db);

        (await db.Departments.SingleAsync(d => d.Code == "CSED"))
            .Name.Should().Be("Computer Science & Engineering (Renamed)");
    }

    [Fact]
    public async Task NamesMatchTheFormThatPopulatesTheFreeTextColumn()
    {
        // CreateFacultyUser.jsx offers exactly these 14 names (Phase 10), and
        // it is what has been writing FacultyProfile.Department. If the seed
        // diverged, the backfill would silently match nothing.
        var db = CreateDb();
        await DepartmentSeeder.SeedAsync(db);

        var names = await db.Departments.Select(d => d.Name).ToListAsync();

        // R&C is not on the free-text list -- it seeds no faculty, so no profile
        // could ever carry that text -- and is asserted separately below.
        names.Should().Contain(
        [
            "Electronics Engineering",
            "Humanities & Social Sciences",
            "School of Management Studies",
            "Computer Science & Engineering",
            "Biotechnology",
            "Electrical Engineering",
            "Civil Engineering",
            "Chemical Engineering",
            "Chemistry",
            "Physics",
            "Mathematics",
            "GIS Cell",
            "Applied Mechanics",
            "Mechanical Engineering",
        ]);
    }

    [Fact]
    public async Task SeedsTheRncDepartmentAsInstituteWide()
    {
        var db = CreateDb();

        await DepartmentSeeder.SeedAsync(db);

        var rnc = await db.Departments.SingleAsync(d => d.Code == DepartmentSeeder.RncCode);
        rnc.IsInstituteWide.Should().BeTrue();
    }

    [Fact]
    public async Task CodesAreUnique()
    {
        var db = CreateDb();
        await DepartmentSeeder.SeedAsync(db);

        var codes = await db.Departments.Select(d => d.Code).ToListAsync();

        codes.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void LegacyCodeRemap_EveryNewCodeExistsInTheCurrentDepartmentList()
    {
        // A remap target that does not exist in Departments would silently
        // leave a legacy department un-migrated (DbSeeder's
        // MigrateAwayFromLegacyDepartmentsAsync skips a code it cannot
        // find), stranding whoever was pointed at the retired row.
        var currentCodes = DepartmentSeeder.Departments.Select(d => d.Code).ToHashSet();

        DepartmentSeeder.LegacyCodeRemap.Select(r => r.NewCode)
            .Should().OnlyContain(newCode => currentCodes.Contains(newCode));
    }

    [Fact]
    public void LegacyCodeRemap_NoOldCodeIsAlsoACurrentCode()
    {
        // If a retired code collided with a real one, DepartmentSeeder's own
        // idempotent insert would treat the legacy row as already seeded and
        // never let the new one exist under that code.
        var currentCodes = DepartmentSeeder.Departments.Select(d => d.Code).ToHashSet();

        DepartmentSeeder.LegacyCodeRemap.Select(r => r.OldCode)
            .Should().NotContain(oldCode => currentCodes.Contains(oldCode));
    }

    [Fact]
    public async Task DepartmentsHaveNoHeadUntilOneIsAssigned()
    {
        // A vacancy is the honest default: inventing a head would be worse than
        // recording that there is not one.
        var db = CreateDb();

        await DepartmentSeeder.SeedAsync(db);

        db.Departments.Should().OnlyContain(d => d.HeadUserId == null);
    }
}
