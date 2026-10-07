using API.Application.Access;
using API.Domain.Entities;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Extracted (Phase 10) from what had become a copy-pasted check in
/// PageAccessService and ResearchProposalService.ListForRnCOfficeAsync.
/// Both existing consumers' own test suites still pass unmodified after the
/// refactor -- this file is the resolver's own direct coverage.
/// </summary>
public class InstituteWideScopeResolverTests
{
    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task IsInstituteWideAsync_UserInAnInstituteWideDepartment_ReturnsTrue()
    {
        var db = CreateDb();
        var departmentId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = departmentId, Code = "RNC", Name = "R&C", IsInstituteWide = true });
        await db.SaveChangesAsync();
        var resolver = new InstituteWideScopeResolver(db, new FakeDepartment(departmentId));

        (await resolver.IsInstituteWideAsync(Guid.NewGuid())).Should().BeTrue();
    }

    [Fact]
    public async Task IsInstituteWideAsync_UserInAnOrdinaryDepartment_ReturnsFalse()
    {
        var db = CreateDb();
        var departmentId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = departmentId, Code = "CSE", Name = "Computer Science", IsInstituteWide = false });
        await db.SaveChangesAsync();
        var resolver = new InstituteWideScopeResolver(db, new FakeDepartment(departmentId));

        (await resolver.IsInstituteWideAsync(Guid.NewGuid())).Should().BeFalse();
    }

    [Fact]
    public async Task IsInstituteWideAsync_UserWithNoDepartment_ReturnsFalse_NotAnError()
    {
        var db = CreateDb();
        var resolver = new InstituteWideScopeResolver(db, new FakeDepartment(null));

        (await resolver.IsInstituteWideAsync(Guid.NewGuid())).Should().BeFalse();
    }

    [Fact]
    public async Task IsInstituteWideAsync_IgnoresDepartmentIsActive()
    {
        // IsActive says whether a department is current, not who may see
        // what -- conflating them would silently narrow everyone in a
        // department deactivated for an unrelated reason.
        var db = CreateDb();
        var departmentId = Guid.NewGuid();
        db.Departments.Add(new Department
        {
            Id = departmentId, Code = "RNC", Name = "R&C", IsInstituteWide = true, IsActive = false,
        });
        await db.SaveChangesAsync();
        var resolver = new InstituteWideScopeResolver(db, new FakeDepartment(departmentId));

        (await resolver.IsInstituteWideAsync(Guid.NewGuid())).Should().BeTrue();
    }
}
