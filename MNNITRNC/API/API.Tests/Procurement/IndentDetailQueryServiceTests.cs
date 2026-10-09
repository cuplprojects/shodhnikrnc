using API.Application.Procurement;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentDetailQueryServiceTests
{
    [Fact]
    public async Task GetAsync_IndentWithTwoAllocations_ReturnsBothWithHeadNames()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var consumableHeadId = Guid.NewGuid();
        var overheadHeadId = Guid.NewGuid();
        var indentId = Guid.NewGuid();

        db.BudgetHeads.Add(new BudgetHead
        {
            Id = consumableHeadId, ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable, Year1Amount = 50_000m, Total = 50_000m,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId, ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringOverhead, Year1Amount = 0m, Total = 0m,
        });
        db.Indents.Add(new Indent
        {
            Id = indentId, IndentNumber = "MNIT/RNC/IND/2026-27/9003", IndentType = IndentType.Consumable,
            ProjectId = projectId, BudgetHeadId = consumableHeadId, WorkflowInstanceId = Guid.NewGuid(),
            OwnerUserId = Guid.NewGuid(), Purpose = "Test purpose", CreatedAt = DateTimeOffset.UtcNow,
        });
        db.IndentItems.Add(new IndentItem
        {
            Id = Guid.NewGuid(), IndentId = indentId, SerialNumber = 1, Name = "Item A",
            IsConsumable = true, TechnicalSpecs = "Spec", UnitOfMeasurement = "Nos",
            Quantity = 1, EstimatedCostInclTax = 5_000m,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = consumableHeadId,
            SubHead = null, CommittedAmount = 3_000m, OrderIndex = 0,
        });
        db.IndentBudgetHeadAllocations.Add(new IndentBudgetHeadAllocation
        {
            Id = Guid.NewGuid(), IndentId = indentId, BudgetHeadId = overheadHeadId,
            SubHead = OverheadSubHead.Pdf, CommittedAmount = 2_000m, OrderIndex = 1,
        });
        await db.SaveChangesAsync();

        var service = new IndentDetailQueryService(db);
        var detail = await service.GetAsync(indentId);

        detail.Should().NotBeNull();
        detail!.TotalEstimatedCost.Should().Be(5_000m);
        detail.Allocations.Should().HaveCount(2);
        detail.Allocations[0].BudgetHeadName.Should().Be("RecurringConsumable");
        detail.Allocations[1].SubHead.Should().Be(OverheadSubHead.Pdf);
    }

    [Fact]
    public async Task GetAsync_UnknownId_ReturnsNull()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        var service = new IndentDetailQueryService(db);

        var detail = await service.GetAsync(Guid.NewGuid());

        detail.Should().BeNull();
    }
}
