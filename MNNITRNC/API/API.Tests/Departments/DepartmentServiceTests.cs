using API.Application.Departments;
using API.Tests.Projects;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Departments;

public class DepartmentServiceTests
{
    private static (DepartmentService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        return (new DepartmentService(db), db);
    }

    [Fact]
    public async Task CreateAsync_AddsAnActiveDepartment()
    {
        var (service, _) = CreateService();

        var result = await service.CreateAsync(new CreateDepartmentRequest("CSED", "Computer Science & Engineering", false));

        result.Code.Should().Be("CSED");
        result.Name.Should().Be("Computer Science & Engineering");
        result.IsActive.Should().BeTrue();
        result.IsInstituteWide.Should().BeFalse();
        result.HeadUserId.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_DuplicateCodeCaseInsensitive_Throws()
    {
        var (service, _) = CreateService();
        await service.CreateAsync(new CreateDepartmentRequest("RNC", "Research & Consultancy", true));

        var act = () => service.CreateAsync(new CreateDepartmentRequest("rnc", "Duplicate", false));

        await act.Should().ThrowAsync<DepartmentCodeAlreadyExistsException>();
    }

    [Fact]
    public async Task CreateAsync_BlankCode_ThrowsArgumentException()
    {
        var (service, _) = CreateService();

        var act = () => service.CreateAsync(new CreateDepartmentRequest("   ", "Some Name", false));

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateAsync_BlankName_ThrowsArgumentException()
    {
        var (service, _) = CreateService();

        var act = () => service.CreateAsync(new CreateDepartmentRequest("XYZ", "  ", false));

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ListActiveAsync_ExcludesDeactivatedDepartments()
    {
        var (service, _) = CreateService();
        var active = await service.CreateAsync(new CreateDepartmentRequest("MED", "Mechanical Engineering", false));
        var toDeactivate = await service.CreateAsync(new CreateDepartmentRequest("OLD", "Old Department", false));
        await service.UpdateAsync(
            toDeactivate.Id, new UpdateDepartmentRequest("OLD", "Old Department", null, false, false));

        var result = await service.ListActiveAsync();

        result.Should().ContainSingle(d => d.Id == active.Id);
        result.Should().NotContain(d => d.Id == toDeactivate.Id);
    }

    [Fact]
    public async Task ListAllAsync_IncludesDeactivatedDepartments()
    {
        var (service, _) = CreateService();
        var department = await service.CreateAsync(new CreateDepartmentRequest("EED", "Electrical Engineering", false));
        await service.UpdateAsync(
            department.Id, new UpdateDepartmentRequest("EED", "Electrical Engineering", null, false, false));

        var result = await service.ListAllAsync();

        result.Should().ContainSingle(d => d.Id == department.Id && !d.IsActive);
    }

    [Fact]
    public async Task UpdateAsync_UnknownId_Throws()
    {
        var (service, _) = CreateService();

        var act = () => service.UpdateAsync(
            Guid.NewGuid(), new UpdateDepartmentRequest("X", "X", null, false, true));

        await act.Should().ThrowAsync<DepartmentNotFoundException>();
    }

    [Fact]
    public async Task UpdateAsync_RenamingCodeToAnotherDepartmentsExistingCode_Throws()
    {
        var (service, _) = CreateService();
        await service.CreateAsync(new CreateDepartmentRequest("CED", "Civil Engineering", false));
        var other = await service.CreateAsync(new CreateDepartmentRequest("ChED", "Chemical Engineering", false));

        var act = () => service.UpdateAsync(
            other.Id, new UpdateDepartmentRequest("CED", "Chemical Engineering", null, false, true));

        await act.Should().ThrowAsync<DepartmentCodeAlreadyExistsException>();
    }

    [Fact]
    public async Task UpdateAsync_CanSetHeadUserIdAndInstituteWide()
    {
        var (service, _) = CreateService();
        var department = await service.CreateAsync(new CreateDepartmentRequest("RNC", "Research & Consultancy", false));
        var headUserId = Guid.NewGuid();

        var result = await service.UpdateAsync(
            department.Id, new UpdateDepartmentRequest("RNC", "Research & Consultancy", headUserId, true, true));

        result.HeadUserId.Should().Be(headUserId);
        result.IsInstituteWide.Should().BeTrue();
    }
}
