using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentBudgetHeadAllocationTests
{
    [Fact]
    public async Task CanPersist_TwoAllocationsForSameIndent_OneNormalOneSubHead()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var overheadHeadId = Guid.NewGuid();
        var indentId = Guid.NewGuid();

        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId, ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 100_000m, Total = 100_000m,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId, ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 0m, Total = 0m,
        });
        db.Indents.Add(new Indent
        {
            Id = indentId,
            IndentNumber = "MNIT/RNC/IND/2026-27/9001",
            IndentType = IndentType.Consumable,
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            WorkflowInstanceId = Guid.NewGuid(),
            OwnerUserId = Guid.NewGuid(),
            Purpose = "Test",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = budgetHeadId,
            SubHead = null, CommittedAmount = 6_000m, OrderIndex = 0,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = overheadHeadId,
            SubHead = OverheadSubHead.Pdf, CommittedAmount = 4_000m, OrderIndex = 1,
        });

        await db.SaveChangesAsync();

        var saved = await db.IndentBudgetHeadAllocations
            .Where(a => a.IndentId == indentId)
            .OrderBy(a => a.OrderIndex)
            .ToListAsync();

        saved.Should().HaveCount(2);
        saved[0].SubHead.Should().BeNull();
        saved[1].SubHead.Should().Be(OverheadSubHead.Pdf);
        saved[1].BudgetHeadId.Should().Be(overheadHeadId);
    }
}
