using API.Application.Access;
using API.Domain.Entities;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Xunit;

namespace API.Tests.Access;

public class AdminUsersServiceTests
{
    private sealed record Fixture(UserManager<ApplicationUser> Users, AdminUsersService Service)
    {
        public async Task<ApplicationUser> CreateUserAsync(string email, string fullName, string? employeeId)
        {
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                FullName = fullName,
                EmployeeId = employeeId,
            };
            (await Users.CreateAsync(user, "Password@123")).Succeeded.Should().BeTrue();
            return user;
        }
    }

    private static Task<Fixture> CreateAsync()
    {
        var (userManager, _, _) = ApplicantAccountTestHarness.Create();
        var service = new AdminUsersService(userManager);
        return Task.FromResult(new Fixture(userManager, service));
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEveryUser_WithEmployeeIdAndActiveStatus()
    {
        var f = await CreateAsync();
        await f.CreateUserAsync("a@example.com", "Alice", employeeId: "EMP1");
        await f.CreateUserAsync("b@example.com", "Bob", employeeId: null);

        var result = await f.Service.GetAllAsync();

        result.Should().Contain(u => u.FullName == "Alice" && u.EmployeeId == "EMP1");
        result.Should().Contain(u => u.FullName == "Bob" && u.EmployeeId == null);
    }

    [Fact]
    public async Task SetEmployeeIdAsync_UpdatesTheUsersEmployeeId()
    {
        var f = await CreateAsync();
        var user = await f.CreateUserAsync("c@example.com", "Carol", employeeId: null);

        await f.Service.SetEmployeeIdAsync(user.Id, "EMP99");

        var reloaded = await f.Service.GetAllAsync();
        reloaded.Should().Contain(u => u.Id == user.Id && u.EmployeeId == "EMP99");
    }

    [Fact]
    public async Task SetEmployeeIdAsync_WithUnknownUserId_Throws()
    {
        var f = await CreateAsync();

        var act = async () => await f.Service.SetEmployeeIdAsync(Guid.NewGuid(), "EMP1");

        await act.Should().ThrowAsync<ArgumentException>();
    }
}
