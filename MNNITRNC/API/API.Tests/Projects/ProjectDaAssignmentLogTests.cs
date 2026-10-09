using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class ProjectDaAssignmentLogTests
{
    [Fact]
    public async Task CanPersist_FirstAssignmentAndReassignment_BothRowsQueryable()
    {
        var options = new DbContextOptionsBuilder<API.Tests.Procurement.TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new API.Tests.Procurement.TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var firstDaUserId = Guid.NewGuid();
        var secondDaUserId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DA-1",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "DA Assignment Test Project",
            StartDate = new DateOnly(2024, 6, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
            CurrentDaUserId = secondDaUserId,
        });
        db.ProjectDaAssignmentLogs.Add(new ProjectDaAssignmentLog
        {
            Id = Guid.NewGuid(), ProjectId = projectId,
            FromUserId = null, FromUserName = null,
            ToUserId = firstDaUserId, ToUserName = "First DA",
            Reason = "Initial assignment",
            PerformedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
        });
        db.ProjectDaAssignmentLogs.Add(new ProjectDaAssignmentLog
        {
            Id = Guid.NewGuid(), ProjectId = projectId,
            FromUserId = firstDaUserId, FromUserName = "First DA",
            ToUserId = secondDaUserId, ToUserName = "Second DA",
            Reason = "First DA on leave",
            PerformedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();

        var logs = await db.ProjectDaAssignmentLogs
            .Where(l => l.ProjectId == projectId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        logs.Should().HaveCount(2);
        logs[0].ToUserId.Should().Be(secondDaUserId);
        logs[0].FromUserId.Should().Be(firstDaUserId);
        logs[1].FromUserId.Should().BeNull();

        var project = await db.Projects.FirstAsync(p => p.Id == projectId);
        project.CurrentDaUserId.Should().Be(secondDaUserId);
    }
}
