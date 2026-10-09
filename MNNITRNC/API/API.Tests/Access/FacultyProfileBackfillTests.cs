using API.Application.Common;
using API.Domain.Entities;
using API.Tests.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

public class FacultyProfileBackfillTests
{
    [Fact]
    public async Task Backfill_LinksProfileWhoseUserIdParsesAsARealAccountId()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "prof1@example.com",
            Email = "prof1@example.com",
            FullName = "Prof One",
            EmailConfirmed = true,
            IsActive = true,
        };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();

        db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = user.Id.ToString(),
            Name = "Prof One",
            Department = "Computer Science & Engineering",
            Designation = "Professor",
        });
        await db.SaveChangesAsync();

        await InvokeBackfillAsync(db, userManager);

        var profile = await db.FacultyProfiles.SingleAsync();
        profile.ApplicationUserId.Should().Be(user.Id);
    }

    [Fact]
    public async Task Backfill_LeavesNonGuidUserIdUnlinked()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = "EMP1234", // a real admin-typed Employee ID, not a GUID
            Name = "Prof Two",
        });
        await db.SaveChangesAsync();

        await InvokeBackfillAsync(db, userManager);

        var profile = await db.FacultyProfiles.SingleAsync();
        profile.ApplicationUserId.Should().BeNull();
    }

    [Fact]
    public async Task Backfill_LinksOnlyOneProfileWhenTwoUserIdsCollideOnTheSameRealAccount()
    {
        // Simulates dirty legacy data: two admin-typed Employee ID free-text
        // values that happen to coincide and both parse as the same real
        // account's GUID. SaveChangesAsync is deferred until after the whole
        // loop, so the DB-only "already linked" check cannot see the first
        // iteration's in-memory assignment -- without an in-run guard, both
        // rows would be assigned the same ApplicationUserId and the final
        // SaveChangesAsync would throw a unique-constraint violation instead
        // of skipping the second collider.
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "prof3@example.com",
            Email = "prof3@example.com",
            FullName = "Prof Three",
            EmailConfirmed = true,
            IsActive = true,
        };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();

        // FacultyProfile.UserId is the primary key, so the two colliding rows
        // must have distinct UserId strings -- but Guid.TryParse accepts more
        // than one textual format for the same GUID value ("D" with dashes and
        // "N" without), so two different free-text Employee IDs can still
        // parse to the identical ApplicationUser id. That is exactly the real
        // scenario this guards against: two distinct legacy strings resolving
        // to one account.
        db.FacultyProfiles.AddRange(
            new FacultyProfile
            {
                UserId = user.Id.ToString("D"),
                Name = "Prof Three (row A)",
                Department = "Computer Science & Engineering",
                Designation = "Professor",
            },
            new FacultyProfile
            {
                UserId = user.Id.ToString("N"),
                Name = "Prof Three (row B, colliding)",
                Department = "Computer Science & Engineering",
                Designation = "Professor",
            });
        await db.SaveChangesAsync();

        await InvokeBackfillAsync(db, userManager);

        var profiles = await db.FacultyProfiles.ToListAsync();
        profiles.Should().HaveCount(2);
        profiles.Count(p => p.ApplicationUserId == user.Id).Should().Be(1);
        profiles.Count(p => p.ApplicationUserId == null).Should().Be(1);
    }

    // BackfillFacultyProfileApplicationUserIdsAsync is private on DbSeeder --
    // reflection-invoke it directly rather than running the whole seeder
    // (which seeds roles, workflows, etc. this test doesn't need). Confirm
    // the actual method's exact declared name and parameter types by reading
    // DbSeeder.cs before writing this call, in case Step 5's implementation
    // needed adjustment.
    private static async Task InvokeBackfillAsync(IApplicationDbContext db, Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> userManager)
    {
        var method = typeof(API.Seed.DbSeeder).GetMethod(
            "BackfillFacultyProfileApplicationUserIdsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)
            ?? throw new InvalidOperationException("BackfillFacultyProfileApplicationUserIdsAsync not found -- check Step 5's exact method name.");

        await (Task)method.Invoke(null, [db, userManager])!;
    }
}
