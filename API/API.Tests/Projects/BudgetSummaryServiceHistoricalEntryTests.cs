using API.Application.Audit;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class BudgetSummaryServiceHistoricalEntryTests
{
    private static (HistoricalEntryService HistoricalService, BudgetSummaryService SummaryService, TestProjectsDbContext Db) CreateServices()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var yearCalculator = new ProjectYearCalculator();
        var historicalService = new HistoricalEntryService(db, yearCalculator, new AuditService(db));
        var summaryService = new BudgetSummaryService(db, yearCalculator);
        return (historicalService, summaryService, db);
    }

    private static (Project Project, BudgetHead Travel) SampleProjectWithTravelHead()
    {
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-HIST-SUM",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "Historical Entry Budget Summary Test",
            StartDate = new DateOnly(2024, 6, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var travel = new BudgetHead
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringTravel,
            Year1Amount = 20_000m,
            Year2Amount = 20_000m,
            Year3Amount = 20_000m,
        };
        project.BudgetHeads.Add(travel);
        return (project, travel);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_HistoricalEntries_FoldIntoAvailableForTheirYear()
    {
        var (historicalService, summaryService, db) = CreateServices();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        // Year 1 (2024-06-01 .. 2025-05-31): 15,000 historical received, 8,000 historical spent.
        await historicalService.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 15_000m, new DateOnly(2024, 7, 1), "Year 1 backfill");
        await historicalService.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 8_000m, "Year 1 backfill", new DateOnly(2024, 8, 1));

        var summary = await summaryService.GetBudgetSummaryAsync(project.Id);

        var year1Line = summary.Lines.Single(l => l.HeadName == BudgetHeadName.RecurringTravel && l.ProjectYear == 1);
        year1Line.GrantReceived.Should().Be(15_000m);
        year1Line.Spent.Should().Be(8_000m);
        year1Line.Available.Should().Be(7_000m);

        // No other year for this head should be affected.
        foreach (var otherYear in summary.Lines.Where(l => l.HeadName == BudgetHeadName.RecurringTravel && l.ProjectYear != 1))
        {
            otherYear.GrantReceived.Should().Be(0m);
            otherYear.Spent.Should().Be(0m);
        }
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_DeletedHistoricalEntry_NoLongerCounted()
    {
        var (historicalService, summaryService, db) = CreateServices();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var expenditure = await historicalService.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 8_000m, "will be deleted", new DateOnly(2024, 8, 1));

        var beforeDelete = await summaryService.GetBudgetSummaryAsync(project.Id);
        beforeDelete.Lines.Single(l => l.ProjectYear == 1).Spent.Should().Be(8_000m);

        await historicalService.DeleteExpenditureAsync(expenditure.Id, Guid.NewGuid());

        var afterDelete = await summaryService.GetBudgetSummaryAsync(project.Id);
        afterDelete.Lines.Single(l => l.ProjectYear == 1).Spent.Should().Be(0m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_LiveAndHistoricalEntries_BothCountTowardTheSameTotals()
    {
        var (historicalService, summaryService, db) = CreateServices();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = travel.Id,
            Type = GrantReceiptType.Head, Status = GrantReceiptStatus.Approved,
            ReceivedDate = new DateOnly(2024, 7, 1), Amount = 5_000m,
        });
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(), ProjectId = project.Id, SectionType = "travel",
            BudgetHeadId = travel.Id, TransactionDate = new DateOnly(2024, 8, 1), Amount = 2_000m,
        });
        await db.SaveChangesAsync();

        await historicalService.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 10_000m, new DateOnly(2024, 7, 5), "backfill");
        await historicalService.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 3_000m, "backfill", new DateOnly(2024, 8, 5));

        var summary = await summaryService.GetBudgetSummaryAsync(project.Id);

        var year1Line = summary.Lines.Single(l => l.HeadName == BudgetHeadName.RecurringTravel && l.ProjectYear == 1);
        year1Line.GrantReceived.Should().Be(15_000m); // 5,000 live + 10,000 historical
        year1Line.Spent.Should().Be(5_000m);          // 2,000 live + 3,000 historical
        year1Line.Available.Should().Be(10_000m);
    }
}
