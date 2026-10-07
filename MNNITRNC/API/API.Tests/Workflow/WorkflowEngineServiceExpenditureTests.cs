using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowEngineServiceExpenditureTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SeedSingleStageBillRouteAsync(ApplicationDbContext db)
    {
        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.Consumable, Phase = WorkflowPhase.Bill,
            Name = "Test Bill Route", IsActive = true,
        });
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.WithDean,
            Sequence = 1, CanApprove = true, CanReject = true, AllowedRoles = "Dean",
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ApproveAsync_BillPhaseReachesApproved_CreatesExpenditureRow()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        await SeedSingleStageBillRouteAsync(db);

        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var indentId = Guid.NewGuid();
        db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = indentId, ProjectId = projectId, BudgetHeadId = budgetHeadId,
            WorkflowInstanceId = Guid.NewGuid(), EstimatedCost = 10000m,
            Name = "Lab Reagents", TechnicalSpecs = "N/A", UnitOfMeasurement = "Lot", Purpose = "Test",
            OriginalBillReference = "B-001", BillAmount = 9500m,
            ItemReceivingDate = new DateOnly(2026, 3, 1),
        });

        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.Consumable, RequestId = indentId,
            Phase = WorkflowPhase.Bill, CurrentStage = WorkflowStage.WithDean, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        await engine.ApproveAsync(instanceId, Guid.NewGuid(), ["Dean"], "Approved");

        var expenditure = await db.Expenditure.SingleAsync(e => e.ProjectId == projectId);
        expenditure.BudgetHeadId.Should().Be(budgetHeadId);
        expenditure.Amount.Should().Be(9500m); // BillAmount, not EstimatedCost
        expenditure.TransactionDate.Should().Be(new DateOnly(2026, 3, 1));
    }

    [Fact]
    public async Task ApproveAsync_IndentPhaseReachesApproved_DoesNotCreateExpenditureRow()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();

        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.Consumable, Phase = WorkflowPhase.Indent,
            Name = "Test Indent Route", IsActive = true,
        });
        db.WorkflowStageDefinitions.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId, Stage = WorkflowStage.WithDean,
            Sequence = 1, CanApprove = true, CanReject = true, AllowedRoles = "Dean",
        });
        await db.SaveChangesAsync();

        var indentId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.Consumable, RequestId = indentId,
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithDean, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        await engine.ApproveAsync(instanceId, Guid.NewGuid(), ["Dean"], "Approved");

        (await db.Expenditure.AnyAsync()).Should().BeFalse();
    }
}
