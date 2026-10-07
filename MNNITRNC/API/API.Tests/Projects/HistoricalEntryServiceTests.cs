using API.Application.Audit;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class HistoricalEntryServiceTests
{
    private static (HistoricalEntryService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var service = new HistoricalEntryService(db, new ProjectYearCalculator(), new AuditService(db));
        return (service, db);
    }

    private static (Project Project, BudgetHead Travel) SampleProjectWithTravelHead()
    {
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-HIST-SVC",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "Historical Entry Service Test",
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
    public async Task RecordExpenditureAsync_CreatesARowAndAuditLogsIt()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var recordedBy = Guid.NewGuid();

        var expenditure = await service.RecordExpenditureAsync(
            project.Id, recordedBy, travel.Id, 12_000m, "Year 1 travel, from offline register", new DateOnly(2024, 8, 1));

        expenditure.ProjectId.Should().Be(project.Id);
        expenditure.Amount.Should().Be(12_000m);
        (await db.HistoricalExpenditures.FindAsync(expenditure.Id)).Should().NotBeNull();

        var entry = db.AuditLogs.Single();
        entry.Action.Should().Be("HistoricalExpenditureRecorded");
        entry.ActorUserId.Should().Be(recordedBy);
    }

    [Fact]
    public async Task RecordExpenditureAsync_NoCeilingCheck_LargeAmountSucceeds()
    {
        // Nothing else in this codebase caps spending against sanctioned/
        // received amounts -- Available can already go negative today, so
        // historical expenditure does not invent a new rule that live
        // expenditure never had.
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var act = () => service.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 500_000m, "Far exceeds sanctioned travel", new DateOnly(2024, 8, 1));

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task RecordExpenditureAsync_UnknownProject_ThrowsProjectNotFound()
    {
        var (service, _) = CreateService();

        var act = () => service.RecordExpenditureAsync(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1000m, "desc", new DateOnly(2024, 8, 1));

        await act.Should().ThrowAsync<ProjectNotFoundException>();
    }

    [Fact]
    public async Task RecordExpenditureAsync_BudgetHeadNotOnProject_ThrowsArgumentException()
    {
        var (service, db) = CreateService();
        var (project, _) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var act = () => service.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), Guid.NewGuid(), 1000m, "desc", new DateOnly(2024, 8, 1));

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RecordExpenditureAsync_DateBeforeProjectStart_ThrowsArgumentException()
    {
        // Caught at write time (via IProjectYearCalculator.GetProjectYear,
        // which throws ArgumentException itself for a date before
        // StartDate), not left to surface later as an exception from
        // BudgetSummaryService when it tries to resolve this row's year.
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead(); // StartDate = 2024-06-01
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var act = () => service.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 1000m, "desc", new DateOnly(2024, 1, 1));

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_DateBeforeProjectStart_ThrowsArgumentException()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead(); // StartDate = 2024-06-01
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 1000m, new DateOnly(2024, 1, 1), null);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_CreatesARowAndAuditLogsIt()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var recordedBy = Guid.NewGuid();

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, recordedBy, travel.Id, 15_000m, new DateOnly(2024, 7, 1), "Year 1 travel receipt");

        receipt.ProjectId.Should().Be(project.Id);
        receipt.Amount.Should().Be(15_000m);
        (await db.HistoricalGrantReceipts.FindAsync(receipt.Id)).Should().NotBeNull();

        var entry = db.AuditLogs.Single();
        entry.Action.Should().Be("HistoricalGrantReceiptRecorded");
        entry.ActorUserId.Should().Be(recordedBy);
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ExceedsSanctionAgainstLiveReceipts_Throws()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = travel.Id,
            Type = GrantReceiptType.Head, Status = GrantReceiptStatus.Approved,
            ReceivedDate = new DateOnly(2024, 7, 1), Amount = 18_000m,
        });
        await db.SaveChangesAsync();

        // Year 1 sanctioned = 20,000; 18,000 already Approved live; +3,000
        // historical would total 21,000 > 20,000 sanctioned.
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 3_000m, new DateOnly(2024, 7, 15), null);

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ExceedsSanctionAgainstExistingHistorical_Throws()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        await service.RecordGrantReceiptAsync(project.Id, Guid.NewGuid(), travel.Id, 18_000m, new DateOnly(2024, 7, 1), null);

        // Another 3,000 historical on top of the 18,000 already-historical
        // total = 21,000 > 20,000 sanctioned for Year 1.
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 3_000m, new DateOnly(2024, 7, 15), null);

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    [Fact]
    public async Task DeleteExpenditureAsync_RemovesTheRowAndAuditLogsItsContentsFirst()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var expenditure = await service.RecordExpenditureAsync(
            project.Id, Guid.NewGuid(), travel.Id, 5_000m, "typo, wrong amount", new DateOnly(2024, 8, 1));
        var deletedBy = Guid.NewGuid();

        await service.DeleteExpenditureAsync(expenditure.Id, deletedBy);

        (await db.HistoricalExpenditures.FindAsync(expenditure.Id)).Should().BeNull();
        var deleteEntry = db.AuditLogs.Single(a => a.Action == "HistoricalExpenditureDeleted");
        deleteEntry.ActorUserId.Should().Be(deletedBy);
        deleteEntry.Detail.Should().Contain("5000").And.Contain(travel.Id.ToString());
    }

    [Fact]
    public async Task DeleteGrantReceiptAsync_RemovesTheRow()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, Guid.NewGuid(), travel.Id, 5_000m, new DateOnly(2024, 7, 1), "typo, wrong amount");

        await service.DeleteGrantReceiptAsync(receipt.Id, Guid.NewGuid());

        (await db.HistoricalGrantReceipts.FindAsync(receipt.Id)).Should().BeNull();
    }

    [Fact]
    public async Task ListForProjectAsync_ReturnsBothListsForTheProjectOnly()
    {
        var (service, db) = CreateService();
        var (project, travel) = SampleProjectWithTravelHead();
        var (otherProject, otherTravel) = SampleProjectWithTravelHead();
        db.Projects.AddRange(project, otherProject);
        await db.SaveChangesAsync();

        await service.RecordExpenditureAsync(project.Id, Guid.NewGuid(), travel.Id, 1_000m, "mine", new DateOnly(2024, 8, 1));
        await service.RecordExpenditureAsync(otherProject.Id, Guid.NewGuid(), otherTravel.Id, 2_000m, "not mine", new DateOnly(2024, 8, 1));
        await service.RecordGrantReceiptAsync(project.Id, Guid.NewGuid(), travel.Id, 3_000m, new DateOnly(2024, 7, 1), "mine");

        var result = await service.ListForProjectAsync(project.Id);

        result.Expenditures.Should().ContainSingle(e => e.Description == "mine");
        result.GrantReceipts.Should().ContainSingle(g => g.Remarks == "mine");
    }
}
