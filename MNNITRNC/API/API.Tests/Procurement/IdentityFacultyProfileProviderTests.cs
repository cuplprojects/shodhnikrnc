using API.Domain.Entities;
using API.Infrastructure.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IdentityFacultyProfileProviderTests
{
    [Fact]
    public async Task GetAsync_WithNoLinkedProfile_ReturnsFullNameWithBlankDesignationAndDepartment()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "faculty1@test.local", Email = "faculty1@test.local", FullName = "Faculty Member One" };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();

        var provider = new IdentityFacultyProfileProvider(userManager, db);

        var info = await provider.GetAsync(user.Id);

        info.Name.Should().Be("Faculty Member One");
        info.Designation.Should().BeEmpty();
        info.Department.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsync_WithLinkedProfile_ReturnsRealDesignationAndDepartment()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "prof1@test.local", Email = "prof1@test.local", FullName = "Prof One" };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();
        db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = user.Id.ToString(),
            ApplicationUserId = user.Id,
            Name = "Prof One",
            Designation = "Professor",
            Department = "Physics",
        });
        await db.SaveChangesAsync();

        var provider = new IdentityFacultyProfileProvider(userManager, db);

        var info = await provider.GetAsync(user.Id);

        info.Name.Should().Be("Prof One");
        info.Designation.Should().Be("Professor");
        info.Department.Should().Be("Physics");
    }
}
