using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

/// <summary>
/// GetBudgetSummaryAsync's "spent" figure used to come exclusively from a
/// hardcoded BudgetHeadName -&gt; free-text SectionType dictionary that only
/// covered 4 of the 7 BudgetHeadName values -- RecurringOverhead,
/// RecurringFieldCharges and RecurringManpower were silently never matched,
/// so "Spent" for those heads always read 0 regardless of real expenditure.
/// Phase 10 adds Expenditure.BudgetHeadId; these tests are what proves the
/// service actually uses it instead of (or in addition to) the old string
/// match.
/// </summary>
public class BudgetSummaryServiceTests
{
    private static (BudgetSummaryService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var service = new BudgetSummaryService(db, new ProjectYearCalculator());
        return (service, db);
    }

    private static Project SampleProject(Guid headId, BudgetHeadName headName)
    {
        var project = new Project
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
            CreatedAt = DateTimeOffset.UtcNow,
        };
        project.BudgetHeads.Add(new BudgetHead
        {
            Id = headId,
            ProjectId = project.Id,
            HeadName = headName,
            Year1Amount = 100_000m,
            Year2Amount = 0m,
            Year3Amount = 0m,
            Total = 100_000m,
        });
        return project;
    }

    [Theory]
    [InlineData(BudgetHeadName.RecurringOverhead)]
    [InlineData(BudgetHeadName.RecurringFieldCharges)]
    [InlineData(BudgetHeadName.RecurringManpower)]
    public async Task GetBudgetSummaryAsync_ExpenditureLinkedByBudgetHeadId_IsCountedForEveryHead(BudgetHeadName headName)
    {
        // These three heads had no entry at all in the old hardcoded
        // SectionType dictionary -- BudgetHeadId must not depend on it.
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var project = SampleProject(headId, headName);
        db.Projects.Add(project);
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            SectionType = "irrelevant-legacy-text",
            TransactionDate = new DateOnly(2024, 7, 1),
            Amount = 25_000m,
        });
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Lines.Single(l => l.ProjectYear == 1).Spent.Should().Be(25_000m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_ExpenditureWithNoBudgetHeadId_FallsBackToSectionTypeMatch()
    {
        // Legacy rows that predate the column: SectionType matching must
        // still work, unchanged, for the heads it always covered.
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var project = SampleProject(headId, BudgetHeadName.RecurringConsumable);
        db.Projects.Add(project);
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = null,
            SectionType = "consumable",
            TransactionDate = new DateOnly(2024, 7, 1),
            Amount = 15_000m,
        });
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Lines.Single(l => l.ProjectYear == 1).Spent.Should().Be(15_000m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_ExpenditureForADifferentBudgetHead_IsNotCounted()
    {
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var otherHeadId = Guid.NewGuid();
        var project = SampleProject(headId, BudgetHeadName.RecurringOverhead);
        db.Projects.Add(project);
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = otherHeadId,
            SectionType = "irrelevant",
            TransactionDate = new DateOnly(2024, 7, 1),
            Amount = 25_000m,
        });
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Lines.Single(l => l.ProjectYear == 1).Spent.Should().Be(0m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_IncludesYear4AndYear5Rows()
    {
        var (service, db) = CreateService();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-5YR",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "Five Year Project",
            StartDate = new DateOnly(2024, 6, 1),
            Agency = "DST",
            DurationMonths = 60,
            TotalSanctioned = 500_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        project.BudgetHeads.Add(new BudgetHead
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 100_000m,
            Year2Amount = 100_000m,
            Year3Amount = 100_000m,
            Year4Amount = 100_000m,
            Year5Amount = 100_000m,
            Total = 500_000m,
        });
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Lines.Should().Contain(l => l.ProjectYear == 4 && l.Sanctioned == 100_000m);
        summary.Lines.Should().Contain(l => l.ProjectYear == 5 && l.Sanctioned == 100_000m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_HeadWithReappropriation_IncludesItInReappropriationsList()
    {
        var (service, db) = CreateService();
        var fromHeadId = Guid.NewGuid();
        var toHeadId = Guid.NewGuid();
        var project = SampleProject(fromHeadId, BudgetHeadName.RecurringConsumable);
        project.BudgetHeads.Add(new BudgetHead
        {
            Id = toHeadId,
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 50_000m,
            Total = 50_000m,
        });
        project.BudgetReappropriationLogs.Add(new BudgetReappropriationLog
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            FromHeadId = fromHeadId,
            FromHeadName = nameof(BudgetHeadName.RecurringConsumable),
            ToHeadId = toHeadId,
            ToHeadName = nameof(BudgetHeadName.RecurringContingency),
            Amount = 20_000m,
            Reason = "Shift funds to contingency",
            PerformedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Reappropriations.Should().ContainSingle(r => r.HeadName == BudgetHeadName.RecurringContingency && r.NetReappropriated == 20_000m);
        summary.Reappropriations.Should().ContainSingle(r => r.HeadName == BudgetHeadName.RecurringConsumable && r.NetReappropriated == -20_000m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_HeadWithNoReappropriation_OmittedFromReappropriationsList()
    {
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var project = SampleProject(headId, BudgetHeadName.RecurringConsumable);
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Reappropriations.Should().BeEmpty();
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_PerYearLinesUnaffectedByReappropriation()
    {
        // The Year 1-5 GrantReceived figures must keep reflecting only real
        // GrantReceipt rows, untouched by any reappropriation adjustment.
        var (service, db) = CreateService();
        var fromHeadId = Guid.NewGuid();
        var toHeadId = Guid.NewGuid();
        var project = SampleProject(fromHeadId, BudgetHeadName.RecurringConsumable);
        project.BudgetHeads.Add(new BudgetHead
        {
            Id = toHeadId,
            ProjectId = project.Id,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 50_000m,
            Total = 50_000m,
        });
        project.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = fromHeadId,
            Type = GrantReceiptType.Head,
            ReceivedDate = new DateOnly(2024, 7, 1),
            Amount = 80_000m,
            Status = GrantReceiptStatus.Approved,
        });
        project.BudgetReappropriationLogs.Add(new BudgetReappropriationLog
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            FromHeadId = fromHeadId,
            FromHeadName = nameof(BudgetHeadName.RecurringConsumable),
            ToHeadId = toHeadId,
            ToHeadName = nameof(BudgetHeadName.RecurringContingency),
            Amount = 20_000m,
            Reason = "Shift funds to contingency",
            PerformedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        // GrantReceived for the "from" head's Year1 line must remain exactly
        // the real GrantReceipt sum (80,000), NOT reduced by the 20,000
        // reappropriated out.
        summary.Lines.Single(l => l.HeadName == BudgetHeadName.RecurringConsumable && l.ProjectYear == 1)
            .GrantReceived.Should().Be(80_000m);

        // The "to" head received no real GrantReceipt rows, so its GrantReceived
        // must stay 0 even though it was the reappropriation's beneficiary.
        summary.Lines.Single(l => l.HeadName == BudgetHeadName.RecurringContingency && l.ProjectYear == 1)
            .GrantReceived.Should().Be(0m);
    }

    /// <summary>
    /// Task 5 regression: a GrantReceipt still awaiting approval must not
    /// count as received money -- only Approved rows may feed GrantReceived.
    /// A row's mere existence stopped being sufficient once the receipt
    /// approval chain (Task 1) landed.
    /// </summary>
    [Fact]
    public async Task GetBudgetSummaryAsync_PendingApprovalReceipt_ExcludedFromGrantReceived_ApprovedReceipt_Included()
    {
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var project = SampleProject(headId, BudgetHeadName.RecurringConsumable);
        project.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            Type = GrantReceiptType.Head,
            ReceivedDate = new DateOnly(2024, 7, 1),
            Amount = 30_000m,
            Status = GrantReceiptStatus.PendingApproval,
        });
        project.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            Type = GrantReceiptType.Head,
            ReceivedDate = new DateOnly(2024, 7, 1),
            Amount = 50_000m,
            Status = GrantReceiptStatus.Approved,
        });
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        // Only the Approved 50,000 counts; the PendingApproval 30,000 must not.
        summary.Lines.Single(l => l.ProjectYear == 1).GrantReceived.Should().Be(50_000m);
    }

    [Fact]
    public async Task GetBudgetSummaryAsync_OtherHead_CarriesCustomLabelThrough()
    {
        var (service, db) = CreateService();
        var headId = Guid.NewGuid();
        var project = SampleProject(headId, BudgetHeadName.Other);
        project.BudgetHeads.Single(h => h.Id == headId).CustomLabel = "Publication Charges";
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var summary = await service.GetBudgetSummaryAsync(project.Id);

        summary.Lines.First().CustomLabel.Should().Be("Publication Charges");
    }
}
