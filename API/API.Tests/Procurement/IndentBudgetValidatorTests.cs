using API.Application.Procurement;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentBudgetValidatorTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly InYearOne = new(2024, 7, 1);

    private static (IndentBudgetValidator Validator, TestProcurementDbContext Db, Guid BudgetHeadId) Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-1",
            SanctionDate = ProjectStart,
            ProjectTitle = "P",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 100_000m,
            Year2Amount = 50_000m,
            Year3Amount = 0m,
            Total = 150_000m,
        });
        db.SaveChanges();

        return (new IndentBudgetValidator(db, new ProjectYearCalculator()), db, budgetHeadId);
    }

    private static (IndentBudgetValidator Validator, TestProcurementDbContext Db, Guid ProjectId, Guid OverheadHeadId)
        CreateWithOverheadHead()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var overheadHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-OH-1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Overhead Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 0m,
            Total = 0m,
        });
        db.SaveChanges();

        return (new IndentBudgetValidator(db, new ProjectYearCalculator()), db, projectId, overheadHeadId);
    }

    private static GrantReceipt ParentReceipt(Guid projectId, Guid overheadHeadId, decimal amount, GrantReceiptStatus status, DateOnly receivedDate) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = projectId,
        BudgetHeadId = overheadHeadId,
        ReceivedDate = receivedDate,
        Amount = amount,
        Type = GrantReceiptType.Head,
        Status = status,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static GrantReceipt SplitReceipt(Guid projectId, Guid overheadHeadId, Guid parentId, OverheadSubHead subHead, decimal amount, DateOnly receivedDate) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = projectId,
        BudgetHeadId = overheadHeadId,
        ReceivedDate = receivedDate,
        Amount = amount,
        Type = GrantReceiptType.OverheadSplit,
        ParentReceiptId = parentId,
        SubHead = subHead,
        // Deliberately left at the entity default (PendingApproval) -- child
        // rows never carry a meaningful Status of their own; only the
        // parent's Status is read for approval.
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static ConsumableIndent Indent(Guid projectId, Guid budgetHeadId, Guid workflowId, decimal cost) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = projectId,
        BudgetHeadId = budgetHeadId,
        WorkflowInstanceId = workflowId,
        Name = "Item",
        TechnicalSpecs = "Spec",
        UnitOfMeasurement = "Nos",
        Quantity = 1,
        Purpose = "Use",
        GemAvailability = GemAvailability.Yes,
        EstimatedCost = cost,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static WorkflowInstance Workflow(Guid id, WorkflowStage stage) => new()
    {
        Id = id,
        RequestType = RequestType.Consumable,
        RequestId = Guid.NewGuid(),
        Phase = WorkflowPhase.Indent,
        CurrentStage = stage,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task GetSnapshotAsync_NoIndentsOrExpenditure_AvailableEqualsSanctioned()
    {
        var (validator, _, headId) = Create();

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Sanctioned.Should().Be(100_000m);
        snapshot.Committed.Should().Be(0m);
        snapshot.Paid.Should().Be(0m);
        snapshot.Available.Should().Be(100_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_UsesTheCorrectProjectYearAmount()
    {
        var (validator, _, headId) = Create();

        var yearTwo = await validator.GetSnapshotAsync(headId, new DateOnly(2025, 7, 1));

        yearTwo.Sanctioned.Should().Be(50_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_ForProjectYear4_ReadsYear4Amount()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-5YR",
            SanctionDate = ProjectStart,
            ProjectTitle = "Five Year Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 60,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 10_000m,
            Year2Amount = 10_000m,
            Year3Amount = 10_000m,
            Year4Amount = 40_000m,
            Year5Amount = 10_000m,
        });
        await db.SaveChangesAsync();

        var validator = new IndentBudgetValidator(db, new ProjectYearCalculator());

        // ProjectStart's financial year starts April 2024 (month >= 4). Year 4
        // is the financial year starting April 2027, so any date from
        // 2027-04-01 through 2028-03-31 falls in project year 4.
        var asOfDateInYear4 = new DateOnly(2027, 7, 1);

        var snapshot = await validator.GetSnapshotAsync(budgetHeadId, asOfDateInYear4);

        snapshot.Sanctioned.Should().Be(40_000m);
    }

    [Fact]
    public async Task EnsureSufficientAsync_WithinBudget_DoesNotThrow()
    {
        var (validator, _, headId) = Create();

        var act = () => validator.EnsureSufficientAsync(headId, InYearOne, 99_000m);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task EnsureSufficientAsync_ExceedsBudget_Throws()
    {
        var (validator, _, headId) = Create();

        var act = () => validator.EnsureSufficientAsync(headId, InYearOne, 100_001m);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task GetSnapshotAsync_NonTerminalIndentCountsAsCommitted()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(Workflow(workflowId, WorkflowStage.Forwarded));
        db.ConsumableIndents.Add(Indent(project.Id, headId, workflowId, 30_000m));
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(30_000m);
        snapshot.Available.Should().Be(70_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_CancelledIndentDoesNotCountAsCommitted()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(Workflow(workflowId, WorkflowStage.Cancelled));
        db.ConsumableIndents.Add(Indent(project.Id, headId, workflowId, 30_000m));
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(0m);
        snapshot.Available.Should().Be(100_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_RejectedIndentDoesNotCountAsCommitted()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(Workflow(workflowId, WorkflowStage.Rejected));
        db.ConsumableIndents.Add(Indent(project.Id, headId, workflowId, 30_000m));
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(0m);
    }

    [Fact]
    public async Task GetSnapshotAsync_ApprovedIndentStillCountsAsCommittedUntilPaid()
    {
        // An approved indent has money promised against it but not yet spent. If it
        // stopped counting at approval, the same rupees could be committed twice
        // between approval and the bill being paid.
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(Workflow(workflowId, WorkflowStage.Approved));
        db.ConsumableIndents.Add(Indent(project.Id, headId, workflowId, 30_000m));
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(30_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_ExpenditureCountsAsPaid()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();

        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SectionType = "consumable",
            TransactionDate = InYearOne,
            Amount = 25_000m,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Paid.Should().Be(25_000m);
        snapshot.Available.Should().Be(75_000m);
    }

    /// <summary>
    /// Whole-branch review finding (Important #4): historical expenditure
    /// backfilled by RnC office staff for a pre-existing project (see
    /// HistoricalExpenditure) is real money already spent against the head --
    /// it must reduce "available to indent" exactly like a live Expenditure
    /// row does.
    /// </summary>
    [Fact]
    public async Task GetSnapshotAsync_HistoricalExpenditureCountsAsPaid()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();

        db.HistoricalExpenditures.Add(new HistoricalExpenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            TransactionDate = InYearOne,
            Amount = 25_000m,
            Description = "Backfilled spend",
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Paid.Should().Be(25_000m);
        snapshot.Available.Should().Be(75_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_ExpenditureFromAnotherProjectYearIsExcluded()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();

        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SectionType = "consumable",
            TransactionDate = new DateOnly(2025, 7, 1),
            Amount = 25_000m,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Paid.Should().Be(0m);
    }

    [Fact]
    public async Task GetSnapshotAsync_PdfSubHead_SanctionedIsApprovedPdfSplitsOnly()
    {
        var (validator, db, projectId, overheadHeadId) = CreateWithOverheadHead();

        var approvedParent = ParentReceipt(projectId, overheadHeadId, 10_000m, GrantReceiptStatus.Approved, InYearOne);
        db.GrantReceipts.Add(approvedParent);
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Pdf, 4_000m, InYearOne));
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Ddf, 2_000m, InYearOne));
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Idf, 4_000m, InYearOne));

        var pendingParent = ParentReceipt(projectId, overheadHeadId, 10_000m, GrantReceiptStatus.PendingApproval, InYearOne);
        db.GrantReceipts.Add(pendingParent);
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, pendingParent.Id, OverheadSubHead.Pdf, 4_000m, InYearOne));
        await db.SaveChangesAsync();

        var snapshot = await validator.GetSnapshotAsync(overheadHeadId, InYearOne, subHead: OverheadSubHead.Pdf);

        snapshot.Sanctioned.Should().Be(4_000m); // only the approved parent's Pdf split
        snapshot.Available.Should().Be(4_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_DdfSubHead_IndependentOfPdfBalance()
    {
        var (validator, db, projectId, overheadHeadId) = CreateWithOverheadHead();

        var approvedParent = ParentReceipt(projectId, overheadHeadId, 10_000m, GrantReceiptStatus.Approved, InYearOne);
        db.GrantReceipts.Add(approvedParent);
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Pdf, 4_000m, InYearOne));
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Ddf, 2_000m, InYearOne));
        await db.SaveChangesAsync();

        var ddfSnapshot = await validator.GetSnapshotAsync(overheadHeadId, InYearOne, subHead: OverheadSubHead.Ddf);

        ddfSnapshot.Sanctioned.Should().Be(2_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_SubHeadNull_UnchangedFromExistingBehavior()
    {
        var (validator, db, headId) = Create();

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Sanctioned.Should().Be(100_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_SubHeadScoped_CommittedSumsOnlyMatchingAllocations()
    {
        var (validator, db, projectId, overheadHeadId) = CreateWithOverheadHead();

        var approvedParent = ParentReceipt(projectId, overheadHeadId, 10_000m, GrantReceiptStatus.Approved, InYearOne);
        db.GrantReceipts.Add(approvedParent);
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Pdf, 8_000m, InYearOne));
        await db.SaveChangesAsync();

        var workflowId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowId, RequestType = RequestType.DynamicIndent, RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.Raised, CreatedAt = DateTimeOffset.UtcNow,
        });
        var indentId = Guid.NewGuid();
        db.Indents.Add(new Indent
        {
            Id = indentId, IndentNumber = "MNIT/RNC/IND/2026-27/9002", IndentType = IndentType.Consumable,
            ProjectId = projectId, BudgetHeadId = overheadHeadId, WorkflowInstanceId = workflowId,
            OwnerUserId = Guid.NewGuid(), Purpose = "Test", CreatedAt = DateTimeOffset.UtcNow,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = overheadHeadId,
            SubHead = OverheadSubHead.Pdf, CommittedAmount = 3_000m, OrderIndex = 0,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = overheadHeadId,
            SubHead = OverheadSubHead.Ddf, CommittedAmount = 1_000m, OrderIndex = 1,
        });
        await db.SaveChangesAsync();

        var pdfSnapshot = await validator.GetSnapshotAsync(overheadHeadId, InYearOne, subHead: OverheadSubHead.Pdf);

        pdfSnapshot.Committed.Should().Be(3_000m); // not 4_000m -- Ddf row excluded
    }

    /// <summary>
    /// Review finding I2: for a subHead snapshot, Paid was previously the
    /// WHOLE project's year Expenditure sum with no BudgetHeadId filter --
    /// harmless imprecision for the normal case (documented, deliberately
    /// deferred), but severe for a sub-head: a small Sanctioned figure (a
    /// sub-head's own receipt splits) against a potentially much larger
    /// unrelated project-wide Paid figure drove Available deeply negative.
    /// Per the design spec's stated fallback, Paid must be treated as 0 for
    /// a subHead snapshot since Expenditure rows carry no SubHead to
    /// attribute them by. This test creates an Expenditure row for the same
    /// project/year (unrelated to the sub-head being queried) and asserts it
    /// does not affect the Pdf snapshot's Available at all.
    /// </summary>
    [Fact]
    public async Task GetSnapshotAsync_SubHeadScoped_PaidIsAlwaysZeroRegardlessOfProjectExpenditure()
    {
        var (validator, db, projectId, overheadHeadId) = CreateWithOverheadHead();

        var approvedParent = ParentReceipt(projectId, overheadHeadId, 10_000m, GrantReceiptStatus.Approved, InYearOne);
        db.GrantReceipts.Add(approvedParent);
        db.GrantReceipts.Add(SplitReceipt(projectId, overheadHeadId, approvedParent.Id, OverheadSubHead.Pdf, 4_000m, InYearOne));

        // A large, unrelated Expenditure row for the SAME project/year -- under
        // the old unscoped behavior this would have driven Available deeply
        // negative for a sub-head whose own Sanctioned figure is only 4,000.
        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            SectionType = "consumable",
            TransactionDate = InYearOne,
            Amount = 500_000m,
        });
        await db.SaveChangesAsync();

        var pdfSnapshot = await validator.GetSnapshotAsync(overheadHeadId, InYearOne, subHead: OverheadSubHead.Pdf);

        pdfSnapshot.Paid.Should().Be(0m);
        pdfSnapshot.Sanctioned.Should().Be(4_000m);
        pdfSnapshot.Available.Should().Be(4_000m);
    }
}
