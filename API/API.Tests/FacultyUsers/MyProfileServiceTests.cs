using API.Application.Common;
using API.Application.FacultyUsers;
using API.Domain.Entities;
using API.Tests.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.FacultyUsers;

public class MyProfileServiceTests
{
    private sealed record Fixture(TestProcurementDbContext Db, MyProfileService Service, Guid UserId);

    private static async Task<Fixture> CreateAsync(string fullName = "Prof Test", string email = "prof@test.local")
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = email, Email = email, FullName = fullName };
        (await userManager.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();

        var service = new MyProfileService(db, userManager);
        return new Fixture(db, service, user.Id);
    }

    [Fact]
    public async Task GetAsync_WithNoProfileYet_ReturnsIncomplete()
    {
        var f = await CreateAsync();

        var result = await f.Service.GetAsync(f.UserId);

        result.IsComplete.Should().BeFalse();
        result.Designation.Should().BeNullOrEmpty();
        result.Department.Should().BeNullOrEmpty();
        result.Email.Should().Be("prof@test.local");
    }

    [Fact]
    public async Task SaveAsync_ThenGetAsync_ReturnsWhatWasSaved()
    {
        var f = await CreateAsync();

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            Designation: "Professor",
            Department: "Computer Science & Engineering",
            Gender: "Male",
            Qualification: "Ph.D.",
            JoiningDate: new DateOnly(2020, 1, 1),
            ResearchArea: "Distributed Systems",
            Photo: null,
            EmployeeId: null,
            PrimaryBankName: "Test Bank",
            PrimaryBankAccountNo: "0000000000",
            PrimaryBankIfsc: "TEST0000001",
            SecondaryBankName: null,
            SecondaryBankAccountNo: null,
            SecondaryBankIfsc: null));

        var result = await f.Service.GetAsync(f.UserId);

        result.IsComplete.Should().BeTrue();
        result.Designation.Should().Be("Professor");
        result.Department.Should().Be("Computer Science & Engineering");
        result.Gender.Should().Be("Male");
        result.Qualification.Should().Be("Ph.D.");
        result.JoiningDate.Should().Be(new DateOnly(2020, 1, 1));
        result.ResearchArea.Should().Be("Distributed Systems");
    }

    [Fact]
    public async Task SaveAsync_CalledTwice_UpdatesTheSameRowRatherThanCreatingASecondOne()
    {
        var f = await CreateAsync();

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            "Assistant Professor", "Physics", "Female", "Ph.D.", null, null, null, null, "Test Bank", "0000000000", "TEST0000001", null, null, null));
        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            "Associate Professor", "Physics", "Female", "Ph.D.", null, null, null, null, "Test Bank", "0000000000", "TEST0000001", null, null, null));

        (await f.Db.FacultyProfiles.CountAsync(p => p.ApplicationUserId == f.UserId)).Should().Be(1);
        var profile = await f.Db.FacultyProfiles.SingleAsync(p => p.ApplicationUserId == f.UserId);
        profile.Designation.Should().Be("Associate Professor");
    }

    [Fact]
    public async Task SaveAsync_WithUnlinkedLegacyRowSharingTheSameUserId_AdoptsItInsteadOfColliding()
    {
        var f = await CreateAsync();

        // Simulates a legacy, admin-created FacultyProfile row whose free-text
        // UserId happens to equal this account's own GUID as a string, but
        // which was never linked via ApplicationUserId (e.g. skipped by the
        // one-time backfill due to an in-run collision).
        f.Db.FacultyProfiles.Add(new FacultyProfile
        {
            UserId = f.UserId.ToString(),
            ApplicationUserId = null,
            Name = "Legacy Admin-Entered Name",
        });
        await f.Db.SaveChangesAsync();

        var act = async () => await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            "Professor", "Electronics & Communication Engineering", "Male", "Ph.D.", null, null, null, null, "Test Bank", "0000000000", "TEST0000001", null, null, null));

        await act.Should().NotThrowAsync();

        (await f.Db.FacultyProfiles.CountAsync(p => p.UserId == f.UserId.ToString())).Should().Be(1);
        var profile = await f.Db.FacultyProfiles.SingleAsync(p => p.UserId == f.UserId.ToString());
        profile.ApplicationUserId.Should().Be(f.UserId);
        profile.Designation.Should().Be("Professor");
    }

    [Fact]
    public async Task SaveAsync_SetsNameFromTheAccountsFullNameNotFromInput()
    {
        var f = await CreateAsync(fullName: "Dr. Real Name");

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            "Professor", "Chemistry", "Male", "Ph.D.", null, null, null, null, "Test Bank", "0000000000", "TEST0000001", null, null, null));

        var profile = await f.Db.FacultyProfiles.SingleAsync(p => p.ApplicationUserId == f.UserId);
        profile.Name.Should().Be("Dr. Real Name");
    }

    [Fact]
    public async Task SaveAsync_WithEmployeeId_PersistsItOnApplicationUser_NotFacultyProfile()
    {
        var f = await CreateAsync();

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            Designation: "Professor",
            Department: "CSE",
            Gender: null,
            Qualification: null,
            JoiningDate: null,
            ResearchArea: null,
            Photo: null,
            EmployeeId: "EMP1234",
            PrimaryBankName: "Test Bank",
            PrimaryBankAccountNo: "0000000000",
            PrimaryBankIfsc: "TEST0000001",
            SecondaryBankName: null,
            SecondaryBankAccountNo: null,
            SecondaryBankIfsc: null));

        var reloaded = await f.Service.GetAsync(f.UserId);
        reloaded.EmployeeId.Should().Be("EMP1234");
    }

    [Fact]
    public async Task SaveAsync_WithNullEmployeeId_LeavesItNull()
    {
        var f = await CreateAsync();

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            Designation: "Professor",
            Department: "CSE",
            Gender: null,
            Qualification: null,
            JoiningDate: null,
            ResearchArea: null,
            Photo: null,
            EmployeeId: null,
            PrimaryBankName: "Test Bank",
            PrimaryBankAccountNo: "0000000000",
            PrimaryBankIfsc: "TEST0000001",
            SecondaryBankName: null,
            SecondaryBankAccountNo: null,
            SecondaryBankIfsc: null));

        var reloaded = await f.Service.GetAsync(f.UserId);
        reloaded.EmployeeId.Should().BeNull();
    }

    [Fact]
    public async Task SaveAsync_WithNullEmployeeId_DoesNotWipeAnExistingAdminAssignedValue()
    {
        var f = await CreateAsync();

        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            Designation: "Professor",
            Department: "CSE",
            Gender: null,
            Qualification: null,
            JoiningDate: null,
            ResearchArea: null,
            Photo: null,
            EmployeeId: "EMP1",
            PrimaryBankName: "Test Bank",
            PrimaryBankAccountNo: "0000000000",
            PrimaryBankIfsc: "TEST0000001",
            SecondaryBankName: null,
            SecondaryBankAccountNo: null,
            SecondaryBankIfsc: null));

        // A later save that omits/nulls EmployeeId (e.g. an older cached
        // frontend build, or a partial API consumer) must not silently clear
        // a value already set -- only an explicit non-null value (including
        // an explicit empty string) may change it.
        await f.Service.SaveAsync(f.UserId, new SaveMyProfileRequest(
            Designation: "Professor",
            Department: "CSE",
            Gender: null,
            Qualification: null,
            JoiningDate: null,
            ResearchArea: null,
            Photo: null,
            EmployeeId: null,
            PrimaryBankName: "Test Bank",
            PrimaryBankAccountNo: "0000000000",
            PrimaryBankIfsc: "TEST0000001",
            SecondaryBankName: null,
            SecondaryBankAccountNo: null,
            SecondaryBankIfsc: null));

        var reloaded = await f.Service.GetAsync(f.UserId);
        reloaded.EmployeeId.Should().Be("EMP1");
    }
}
