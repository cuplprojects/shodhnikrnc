using API.Application.Audit;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

/// <summary>
/// A manual record, not a workflow -- the BRD names "Refund Reports" as a
/// report over data, with no refund-initiation approval chain to model
/// (Phase 10 spec §3a). RefundService is deliberately thin.
/// </summary>
public class RefundServiceTests
{
    private static (RefundService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var service = new RefundService(db, new AuditService(db));
        return (service, db);
    }

    private static Project SampleProject(bool isDeleted = false) => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = Guid.NewGuid(),
        DepartmentId = Guid.NewGuid(),
        ProjectType = ProjectType.TypeIResearch,
        SanctionNo = "SAN-001",
        SanctionDate = new DateOnly(2024, 6, 1),
        ProjectTitle = "Sample Project",
        StartDate = new DateOnly(2024, 6, 1),
        Agency = "DST",
        DurationMonths = 36,
        TotalSanctioned = 1_000_000m,
        IsDeleted = isDeleted,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task RecordAsync_WritesAnAuditLogRow()
    {
        var (service, db) = CreateService();
        var project = SampleProject();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var recordedBy = Guid.NewGuid();

        await service.RecordAsync(project.Id, recordedBy, 15_000m, new DateOnly(2026, 1, 15), "reason");

        var entry = db.AuditLogs.Single();
        entry.EntityType.Should().Be(nameof(Project));
        entry.EntityId.Should().Be(project.Id);
        entry.Action.Should().Be("RefundRecorded");
        entry.ActorUserId.Should().Be(recordedBy);
    }

    [Fact]
    public async Task RecordAsync_CreatesARefundAgainstAnExistingProject()
    {
        var (service, db) = CreateService();
        var project = SampleProject();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var recordedBy = Guid.NewGuid();

        var refund = await service.RecordAsync(
            project.Id, recordedBy, 15_000m, new DateOnly(2026, 1, 15), "Unspent grant balance returned to DST");

        refund.ProjectId.Should().Be(project.Id);
        refund.Amount.Should().Be(15_000m);
        refund.RecordedByUserId.Should().Be(recordedBy);
        (await db.Refunds.FindAsync(refund.Id)).Should().NotBeNull();
    }

    [Fact]
    public async Task RecordAsync_UnknownProject_ThrowsProjectNotFound()
    {
        var (service, _) = CreateService();

        var act = () => service.RecordAsync(
            Guid.NewGuid(), Guid.NewGuid(), 1000m, new DateOnly(2026, 1, 1), "reason");

        await act.Should().ThrowAsync<ProjectNotFoundException>();
    }

    [Fact]
    public async Task RecordAsync_SoftDeletedProject_ThrowsProjectNotFound()
    {
        // A deleted project is not a valid target for a new financial record
        // -- the same "not found" treatment GetAsync gives a deleted project.
        var (service, db) = CreateService();
        var project = SampleProject(isDeleted: true);
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var act = () => service.RecordAsync(
            project.Id, Guid.NewGuid(), 1000m, new DateOnly(2026, 1, 1), "reason");

        await act.Should().ThrowAsync<ProjectNotFoundException>();
    }

    [Fact]
    public async Task ListForProjectAsync_ReturnsOnlyThatProjectsRefunds_NewestFirst()
    {
        var (service, db) = CreateService();
        var project = SampleProject();
        var otherProject = SampleProject();
        db.Projects.AddRange(project, otherProject);
        await db.SaveChangesAsync();

        await service.RecordAsync(project.Id, Guid.NewGuid(), 1000m, new DateOnly(2026, 1, 1), "first");
        await service.RecordAsync(project.Id, Guid.NewGuid(), 2000m, new DateOnly(2026, 3, 1), "second, later");
        await service.RecordAsync(otherProject.Id, Guid.NewGuid(), 500m, new DateOnly(2026, 2, 1), "different project");

        var refunds = await service.ListForProjectAsync(project.Id);

        refunds.Should().HaveCount(2);
        refunds.Select(r => r.Reason).Should().Equal("second, later", "first");
    }
}
