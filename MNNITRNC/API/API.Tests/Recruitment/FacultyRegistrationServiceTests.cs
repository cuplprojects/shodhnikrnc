using API.Application.Access;
using API.Application.Recruitment;
using API.Domain.Entities;
using API.Infrastructure.Persistence;
using API.Infrastructure.Recruitment;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

public class FacultyRegistrationServiceTests
{
    private class TestUserDepartmentProvider(UserManager<ApplicationUser> userManager) : IUserDepartmentProvider
    {
        public async Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default)
        {
            var user = await userManager.FindByIdAsync(userId.ToString());
            return user?.DepartmentId;
        }
    }

    private static (FacultyRegistrationService svc, ApplicationDbContext db, UserManager<ApplicationUser> um, RoleManager<IdentityRole<Guid>> rm)
        BuildService()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);

        var userStore = new UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>(db);
        var userManager = new UserManager<ApplicationUser>(
            userStore, null!, new PasswordHasher<ApplicationUser>(), [], [],
            new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!, null!);

        var roleStore = new RoleStore<IdentityRole<Guid>, ApplicationDbContext, Guid>(db);
        var roleManager = new RoleManager<IdentityRole<Guid>>(
            roleStore, [], new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!);

        var userDepartment = new TestUserDepartmentProvider(userManager);
        var svc = new FacultyRegistrationService(userManager, db, userDepartment);
        return (svc, db, userManager, roleManager);
    }

    [Fact]
    public async Task RegisterAsync_CreatesUserInPendingRole()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptId, Code = "CS", Name = "Computer Science", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));

        var result = await svc.RegisterAsync(new FacultyRegistrationInput("New PI", "newpi@test.edu", "Password1!", deptId));

        Assert.Equal(RegistrationOutcome.Created, result.Outcome);
        var user = await um.FindByEmailAsync("newpi@test.edu");
        Assert.NotNull(user);
        Assert.True(user!.IsActive);
        Assert.True(await um.IsInRoleAsync(user, "Pending"));
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ReturnsAlreadyRegistered()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptId, Code = "CS", Name = "Computer Science", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await svc.RegisterAsync(new FacultyRegistrationInput("First", "dup@test.edu", "Password1!", deptId));

        var result = await svc.RegisterAsync(new FacultyRegistrationInput("Second", "dup@test.edu", "Password1!", deptId));

        Assert.Equal(RegistrationOutcome.AlreadyRegistered, result.Outcome);
    }

    [Fact]
    public async Task ApproveAsync_SwapsPendingForFaculty_WhenCallerIsOffice()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("Faculty"));
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi@test.edu", Email = "pi@test.edu", FullName = "PI", IsActive = true };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");
        var officeCallerId = Guid.NewGuid();

        await svc.ApproveAsync(user.Id, officeCallerId, ["RegularStaff"]);

        Assert.False(await um.IsInRoleAsync(user, "Pending"));
        Assert.True(await um.IsInRoleAsync(user, "Faculty"));
    }

    [Fact]
    public async Task ApproveAsync_SwapsPendingForFaculty_WhenHodCallerOwnsSameDepartment()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptId, Code = "CS", Name = "CS", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("Faculty"));
        await rm.CreateAsync(new IdentityRole<Guid>("HOD"));
        var hod = new ApplicationUser { Id = Guid.NewGuid(), UserName = "hod3@test.edu", Email = "hod3@test.edu", FullName = "HOD", IsActive = true, DepartmentId = deptId };
        await um.CreateAsync(hod);
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi3@test.edu", Email = "pi3@test.edu", FullName = "PI Three", IsActive = true, DepartmentId = deptId };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");

        await svc.ApproveAsync(user.Id, hod.Id, ["HOD"]);

        Assert.True(await um.IsInRoleAsync(user, "Faculty"));
    }

    [Fact]
    public async Task ApproveAsync_ThrowsWhenHodCallerTargetsAnotherDepartment()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptA, Code = "CS", Name = "CS", IsInstituteWide = false });
        db.Departments.Add(new Department { Id = deptB, Code = "EE", Name = "EE", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("Faculty"));
        await rm.CreateAsync(new IdentityRole<Guid>("HOD"));
        var hod = new ApplicationUser { Id = Guid.NewGuid(), UserName = "hod4@test.edu", Email = "hod4@test.edu", FullName = "HOD", IsActive = true, DepartmentId = deptA };
        await um.CreateAsync(hod);
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi4@test.edu", Email = "pi4@test.edu", FullName = "PI Four", IsActive = true, DepartmentId = deptB };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");

        await Assert.ThrowsAsync<ReviewerCannotActOutsideOwnDepartmentException>(
            () => svc.ApproveAsync(user.Id, hod.Id, ["HOD"]));

        Assert.True(await um.IsInRoleAsync(user, "Pending"), "a refused approval must not change the target's role");
    }

    [Fact]
    public async Task RejectAsync_DeactivatesAccount()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi2@test.edu", Email = "pi2@test.edu", FullName = "PI Two", IsActive = true };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");
        var officeCallerId = Guid.NewGuid();

        await svc.RejectAsync(user.Id, officeCallerId, ["RegularStaff"]);

        var reloaded = await um.FindByIdAsync(user.Id.ToString());
        Assert.False(reloaded!.IsActive);
        Assert.True(await um.IsInRoleAsync(reloaded, "Pending"));
    }

    [Fact]
    public async Task RejectAsync_ThrowsWhenHodCallerTargetsAnotherDepartment()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptA, Code = "CS", Name = "CS", IsInstituteWide = false });
        db.Departments.Add(new Department { Id = deptB, Code = "EE", Name = "EE", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("HOD"));
        var hod = new ApplicationUser { Id = Guid.NewGuid(), UserName = "hod5@test.edu", Email = "hod5@test.edu", FullName = "HOD", IsActive = true, DepartmentId = deptA };
        await um.CreateAsync(hod);
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi5@test.edu", Email = "pi5@test.edu", FullName = "PI Five", IsActive = true, DepartmentId = deptB };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");

        await Assert.ThrowsAsync<ReviewerCannotActOutsideOwnDepartmentException>(
            () => svc.RejectAsync(user.Id, hod.Id, ["HOD"]));

        var reloaded = await um.FindByIdAsync(user.Id.ToString());
        Assert.True(reloaded!.IsActive, "a refused rejection must not change the target's IsActive");
    }

    [Fact]
    public async Task ApproveAsync_DoesNotResurrectAPreviouslyRejectedAccount_WithoutExplicitReReview()
    {
        // RejectAsync deliberately leaves the Pending role in place, so a rejected
        // account is still technically "approvable" by role shape alone. This test
        // documents the actual (intended) behaviour: Approve after Reject DOES
        // reactivate -- an HOD/Office reviewer re-opening a rejected row and clicking
        // Approve is a valid change-of-mind action, not a bug. What must never happen
        // is a rejected row silently vanishing from nobody's queue while still being
        // approvable by guessing a GUID -- that's covered by the queue-draining test
        // below (ListPendingFacultyRegistrationsAsync_ExcludesRejectedAccounts) and by
        // the department-scoping tests above, which apply equally whether the target
        // was ever rejected or not.
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("Faculty"));
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "pi6@test.edu", Email = "pi6@test.edu", FullName = "PI Six", IsActive = true };
        await um.CreateAsync(user);
        await um.AddToRoleAsync(user, "Pending");
        var officeCallerId = Guid.NewGuid();

        await svc.RejectAsync(user.Id, officeCallerId, ["RegularStaff"]);
        await svc.ApproveAsync(user.Id, officeCallerId, ["RegularStaff"]);

        var reloaded = await um.FindByIdAsync(user.Id.ToString());
        Assert.True(reloaded!.IsActive);
        Assert.True(await um.IsInRoleAsync(reloaded, "Faculty"));
    }

    [Fact]
    public async Task RegisterAsync_UnknownDepartment_Throws()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RegisterAsync(new FacultyRegistrationInput("Nobody", "nobody@test.edu", "Password1!", Guid.NewGuid())));

        Assert.Null(await um.FindByEmailAsync("nobody@test.edu"));
    }

    [Fact]
    public async Task ListPendingFacultyRegistrationsAsync_HodSeesOnlyOwnDepartment()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptA, Code = "CS", Name = "CS", IsInstituteWide = false });
        db.Departments.Add(new Department { Id = deptB, Code = "EE", Name = "EE", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("HOD"));

        var hod = new ApplicationUser { Id = Guid.NewGuid(), UserName = "hod@test.edu", Email = "hod@test.edu", FullName = "HOD", IsActive = true, DepartmentId = deptA };
        await um.CreateAsync(hod);
        await um.AddToRoleAsync(hod, "HOD");

        var piInA = new ApplicationUser { Id = Guid.NewGuid(), UserName = "piA@test.edu", Email = "piA@test.edu", FullName = "PI A", IsActive = true, DepartmentId = deptA };
        await um.CreateAsync(piInA);
        await um.AddToRoleAsync(piInA, "Pending");

        var piInB = new ApplicationUser { Id = Guid.NewGuid(), UserName = "piB@test.edu", Email = "piB@test.edu", FullName = "PI B", IsActive = true, DepartmentId = deptB };
        await um.CreateAsync(piInB);
        await um.AddToRoleAsync(piInB, "Pending");

        var result = await svc.ListPendingFacultyRegistrationsAsync(hod.Id, ["HOD"]);

        Assert.Single(result);
        Assert.Equal("PI A", result[0].FullName);
    }

    [Fact]
    public async Task ListPendingFacultyRegistrationsAsync_OfficeSeesEveryDepartment()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptA, Code = "CS", Name = "CS", IsInstituteWide = false });
        db.Departments.Add(new Department { Id = deptB, Code = "EE", Name = "EE", IsInstituteWide = false });
        await db.SaveChangesAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("RegularStaff"));

        var officeUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "clerk@test.edu", Email = "clerk@test.edu", FullName = "Clerk", IsActive = true };
        await um.CreateAsync(officeUser);
        await um.AddToRoleAsync(officeUser, "RegularStaff");

        var piInA = new ApplicationUser { Id = Guid.NewGuid(), UserName = "piA2@test.edu", Email = "piA2@test.edu", FullName = "PI A2", IsActive = true, DepartmentId = deptA };
        await um.CreateAsync(piInA);
        await um.AddToRoleAsync(piInA, "Pending");

        var piInB = new ApplicationUser { Id = Guid.NewGuid(), UserName = "piB2@test.edu", Email = "piB2@test.edu", FullName = "PI B2", IsActive = true, DepartmentId = deptB };
        await um.CreateAsync(piInB);
        await um.AddToRoleAsync(piInB, "Pending");

        var result = await svc.ListPendingFacultyRegistrationsAsync(officeUser.Id, ["RegularStaff"]);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task ListPendingFacultyRegistrationsAsync_ExcludesRejectedAccounts()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("RegularStaff"));
        var officeUser = new ApplicationUser { Id = Guid.NewGuid(), UserName = "clerk3@test.edu", Email = "clerk3@test.edu", FullName = "Clerk Three", IsActive = true };
        await um.CreateAsync(officeUser);
        await um.AddToRoleAsync(officeUser, "RegularStaff");

        var toReject = new ApplicationUser { Id = Guid.NewGuid(), UserName = "rejectme@test.edu", Email = "rejectme@test.edu", FullName = "Reject Me", IsActive = true };
        await um.CreateAsync(toReject);
        await um.AddToRoleAsync(toReject, "Pending");
        await svc.RejectAsync(toReject.Id, officeUser.Id, ["RegularStaff"]);

        var stillPending = new ApplicationUser { Id = Guid.NewGuid(), UserName = "stillpending@test.edu", Email = "stillpending@test.edu", FullName = "Still Pending", IsActive = true };
        await um.CreateAsync(stillPending);
        await um.AddToRoleAsync(stillPending, "Pending");

        var result = await svc.ListPendingFacultyRegistrationsAsync(officeUser.Id, ["RegularStaff"]);

        Assert.Single(result);
        Assert.Equal("Still Pending", result[0].FullName);
    }

    [Fact]
    public async Task ListPendingFacultyRegistrationsAsync_HodWithNoDepartment_Throws()
    {
        var (svc, db, um, rm) = BuildService();
        await db.Database.EnsureCreatedAsync();
        await rm.CreateAsync(new IdentityRole<Guid>("Pending"));
        await rm.CreateAsync(new IdentityRole<Guid>("HOD"));
        var hod = new ApplicationUser { Id = Guid.NewGuid(), UserName = "hodnodept@test.edu", Email = "hodnodept@test.edu", FullName = "HOD No Dept", IsActive = true };
        await um.CreateAsync(hod);
        await um.AddToRoleAsync(hod, "HOD");

        await Assert.ThrowsAsync<ReviewerHasNoDepartmentException>(
            () => svc.ListPendingFacultyRegistrationsAsync(hod.Id, ["HOD"]));
    }
}
