using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class HistoricalEntryEntityTests
{
    private static TestProjectsDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Project SampleProject() => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = Guid.NewGuid(),
        DepartmentId = Guid.NewGuid(),
        ProjectType = ProjectType.TypeIResearch,
        SanctionNo = "SAN-HIST-1",
        SanctionDate = new DateOnly(2024, 6, 1),
        ProjectTitle = "Historical Entry Entity Test",
        StartDate = new DateOnly(2024, 6, 1),
        Agency = "DST",
        DurationMonths = 36,
        TotalSanctioned = 1_000_000m,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task HistoricalExpenditure_PersistsAgainstAnExistingProject()
    {
        var db = CreateDb();
        var project = SampleProject();
        var headId = Guid.NewGuid();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        db.HistoricalExpenditures.Add(new HistoricalExpenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            Amount = 12_000m,
            Description = "Year 1 travel, recorded from offline register",
            TransactionDate = new DateOnly(2024, 8, 1),
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var reloaded = await db.HistoricalExpenditures.SingleAsync(h => h.ProjectId == project.Id);
        reloaded.Amount.Should().Be(12_000m);
        reloaded.BudgetHeadId.Should().Be(headId);
    }

    [Fact]
    public async Task HistoricalGrantReceipt_PersistsAndIsReachableViaProjectNavigation()
    {
        var db = CreateDb();
        var project = SampleProject();
        var headId = Guid.NewGuid();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        db.HistoricalGrantReceipts.Add(new HistoricalGrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            Amount = 20_000m,
            ReceivedDate = new DateOnly(2024, 7, 1),
            Remarks = "Year 1 travel receipt, recorded from offline register",
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var reloaded = await db.Projects
            .Include(p => p.HistoricalGrantReceipts)
            .SingleAsync(p => p.Id == project.Id);
        reloaded.HistoricalGrantReceipts.Should().ContainSingle(h => h.Amount == 20_000m);
    }
}
