using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class DynamicIndentServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        DynamicIndentService Service,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId);

    private static Fixture Create(decimal year1Budget = 1_000_000m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DI-1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Dynamic Indent Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 5_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = year1Budget,
            Year2Amount = year1Budget,
            Year3Amount = year1Budget,
            Total = year1Budget * 3,
        });
        db.SaveChanges();

        var budgetValidator = new IndentBudgetValidator(db, new ProjectYearCalculator());
        var workflow = new WorkflowEngineService(db);
        var storage = new StubDocumentStorageService();

        var service = new DynamicIndentService(db, workflow, storage, budgetValidator);

        return new Fixture(db, service, ownerUserId, projectId, budgetHeadId);
    }

    private static RaiseDynamicIndentInput Input(Fixture f, string purpose = "Research use") =>
        new(
            IsRule166: false,
            ProjectId: f.ProjectId,
            HeadSelections: [new IndentHeadSelectionInput(f.BudgetHeadId, null, null)],
            IndentType: IndentType.Consumable,
            GemAvailability: GemAvailability.Yes,
            GemCategoryType: null,
            StockAvailability: StockAvailability.No,
            StockBookSerialNo: null,
            StockBookPage: null,
            StockBookDate: null,
            StockDescription: null,
            StockQuantity: null,
            StockActualCost: null,
            StockCondition: null,
            Purpose: purpose,
            PurposeOfAcquiring: null,
            InstallationRequired: false,
            TrainingRequired: false,
            QualificationCriterion: null,
            MaxDeliveryPeriod: null,
            NumberOfEnclosures: null,
            PerpetualLicense: null,
            NonAvailabilityCertificateNumber: null,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: null,
            QuotationDate: null,
            CommitteeFacultyUserId: null,
            BiddingNumber: null,
            BidPublicationDate: null,
            Items:
            [
                new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 10_000m)
            ],
            EstimatePdf: null,
            GemQuotation: null,
            PecCertificate: null,
            MacCertificate: null,
            PacCertificate: null,
            OtherSingleTenderDoc: null,
            NonAvailabilityCertificate: null);

    [Fact]
    public async Task RaiseAsync_ValidIndent_PersistsAndCreatesWorkflowInstance()
    {
        var f = Create();

        var indentId = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.Indents.FirstAsync(i => i.Id == indentId);
        saved.ProjectId.Should().Be(f.ProjectId);
        saved.Purpose.Should().Be("Research use");

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.DynamicIndent);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
    }

    [Fact]
    public async Task RaiseAsync_WithBlankPurpose_Throws()
    {
        var f = Create();

        var act = () => f.Service.RaiseAsync(Input(f, purpose: "   "), f.OwnerUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RaiseAsync_WaterfallAcrossTwoHeads_DrainsFirstThenSecond()
    {
        var f = Create(year1Budget: 6_000m); // primary head has 6,000 available
        var secondHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = secondHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 10_000m, Year2Amount = 10_000m, Year3Amount = 10_000m, Total = 10_000m,
        });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(f.BudgetHeadId, null, null),
                new IndentHeadSelectionInput(secondHeadId, null, null),
            ],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 9_000m)],
        };

        var indentId = await f.Service.RaiseAsync(input, f.OwnerUserId);

        var allocations = await f.Db.IndentBudgetHeadAllocations
            .Where(a => a.IndentId == indentId).OrderBy(a => a.OrderIndex).ToListAsync();

        allocations.Should().HaveCount(2);
        allocations[0].BudgetHeadId.Should().Be(f.BudgetHeadId);
        allocations[0].CommittedAmount.Should().Be(6_000m);
        allocations[1].BudgetHeadId.Should().Be(secondHeadId);
        allocations[1].CommittedAmount.Should().Be(3_000m);
    }

    [Fact]
    public async Task RaiseAsync_WaterfallInsufficientAcrossAllHeads_Throws()
    {
        var f = Create(year1Budget: 1_000m);

        var input = Input(f) with
        {
            HeadSelections = [new IndentHeadSelectionInput(f.BudgetHeadId, null, null)],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task RaiseAsync_ManualSplit_SumMatchesTotal_Succeeds()
    {
        var f = Create(year1Budget: 10_000m);
        var secondHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = secondHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 10_000m, Year2Amount = 10_000m, Year3Amount = 10_000m, Total = 10_000m,
        });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(f.BudgetHeadId, null, 3_000m),
                new IndentHeadSelectionInput(secondHeadId, null, 2_000m),
            ],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var indentId = await f.Service.RaiseAsync(input, f.OwnerUserId);

        var allocations = await f.Db.IndentBudgetHeadAllocations.Where(a => a.IndentId == indentId).ToListAsync();
        allocations.Sum(a => a.CommittedAmount).Should().Be(5_000m);
    }

    [Fact]
    public async Task RaiseAsync_ManualSplit_SumDoesNotMatchTotal_Throws()
    {
        var f = Create(year1Budget: 10_000m);

        var input = Input(f) with
        {
            HeadSelections = [new IndentHeadSelectionInput(f.BudgetHeadId, null, 3_000m)],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*must equal*");
    }

    [Fact]
    public async Task RaiseAsync_ManualSplit_OneHeadUnderfunded_ThrowsNamingIt()
    {
        var f = Create(year1Budget: 1_000m); // primary head insufficient
        var secondHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = secondHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 10_000m, Year2Amount = 10_000m, Year3Amount = 10_000m, Total = 10_000m,
        });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(f.BudgetHeadId, null, 3_000m),
                new IndentHeadSelectionInput(secondHeadId, null, 2_000m),
            ],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task RaiseAsync_PartialManualSplit_MixedAmountedAndBlank_Throws()
    {
        var f = Create(year1Budget: 10_000m);
        var secondHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = secondHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringContingency,
            Year1Amount = 10_000m, Year2Amount = 10_000m, Year3Amount = 10_000m, Total = 10_000m,
        });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(f.BudgetHeadId, null, 3_000m),
                new IndentHeadSelectionInput(secondHeadId, null, null),
            ],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*all selected heads*");
    }

    [Fact]
    public async Task RaiseAsync_EmptyHeadSelections_Throws()
    {
        var f = Create();
        var input = Input(f) with { HeadSelections = [] };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*At least one budget head*");
    }

    [Fact]
    public async Task RaiseAsync_IdfSubHeadSelected_RejectedServerSide()
    {
        var f = Create();
        var input = Input(f) with
        {
            HeadSelections = [new IndentHeadSelectionInput(f.BudgetHeadId, OverheadSubHead.Idf, null)],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Idf*");
    }

    [Fact]
    public async Task RaiseAsync_SingleHeadSelection_SetsLegacyBudgetHeadIdForBackCompat()
    {
        var f = Create();

        var indentId = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.Indents.FirstAsync(i => i.Id == indentId);
        saved.BudgetHeadId.Should().Be(f.BudgetHeadId);
    }

    /// <summary>
    /// Review finding I1: the plain RecurringOverhead head and its PDF/DDF
    /// sub-heads draw from two disjoint Sanctioned pools with no
    /// reconciliation, so selecting both on the same Indent risks
    /// double-committing the same underlying overhead money. The frontend
    /// hides the plain head once sub-heads are offered, but this must also be
    /// rejected server-side as defense-in-depth.
    /// </summary>
    [Fact]
    public async Task RaiseAsync_PlainOverheadHeadCombinedWithItsOwnPdfSubHead_Throws()
    {
        var f = Create();
        var overheadHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 0m, Total = 0m,
        });
        var parentReceiptId = Guid.NewGuid();
        f.Db.GrantReceipts.AddRange(
            new GrantReceipt
            {
                Id = parentReceiptId, ProjectId = f.ProjectId, BudgetHeadId = overheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1_000m, Type = GrantReceiptType.Head,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            },
            new GrantReceipt
            {
                Id = Guid.NewGuid(), ProjectId = f.ProjectId, BudgetHeadId = overheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1_000m, Type = GrantReceiptType.OverheadSplit,
                ParentReceiptId = parentReceiptId, SubHead = OverheadSubHead.Pdf,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(overheadHeadId, null, null),
                new IndentHeadSelectionInput(overheadHeadId, OverheadSubHead.Pdf, null),
            ],
        };

        var act = () => f.Service.RaiseAsync(input, f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*plain*overhead*");
    }

    /// <summary>
    /// Review finding M1: no test exercised a mixed normal-head + PDF/DDF
    /// selection reaching RaiseAsync/allocation persistence in one call.
    /// Funds a normal head and an approved PDF sub-head, then raises a
    /// single indent selecting both (waterfall) and asserts two allocation
    /// rows persist with the right BudgetHeadId/SubHead/CommittedAmount/
    /// OrderIndex.
    /// </summary>
    [Fact]
    public async Task RaiseAsync_MixedNormalHeadAndPdfSubHeadInOneCall_PersistsTwoAllocations()
    {
        var f = Create(year1Budget: 3_000m); // normal head has 3,000 available

        var overheadHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId, ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 0m, Total = 0m,
        });
        var parentReceiptId = Guid.NewGuid();
        f.Db.GrantReceipts.AddRange(
            new GrantReceipt
            {
                Id = parentReceiptId, ProjectId = f.ProjectId, BudgetHeadId = overheadHeadId,
                ReceivedDate = ProjectStart, Amount = 4_000m, Type = GrantReceiptType.Head,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            },
            new GrantReceipt
            {
                Id = Guid.NewGuid(), ProjectId = f.ProjectId, BudgetHeadId = overheadHeadId,
                ReceivedDate = ProjectStart, Amount = 4_000m, Type = GrantReceiptType.OverheadSplit,
                ParentReceiptId = parentReceiptId, SubHead = OverheadSubHead.Pdf,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            });
        await f.Db.SaveChangesAsync();

        var input = Input(f) with
        {
            HeadSelections =
            [
                new IndentHeadSelectionInput(f.BudgetHeadId, null, null),
                new IndentHeadSelectionInput(overheadHeadId, OverheadSubHead.Pdf, null),
            ],
            Items = [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 5_000m)],
        };

        var indentId = await f.Service.RaiseAsync(input, f.OwnerUserId);

        var allocations = await f.Db.IndentBudgetHeadAllocations
            .Where(a => a.IndentId == indentId).OrderBy(a => a.OrderIndex).ToListAsync();

        allocations.Should().HaveCount(2);

        allocations[0].BudgetHeadId.Should().Be(f.BudgetHeadId);
        allocations[0].SubHead.Should().BeNull();
        allocations[0].CommittedAmount.Should().Be(3_000m);
        allocations[0].OrderIndex.Should().Be(0);

        allocations[1].BudgetHeadId.Should().Be(overheadHeadId);
        allocations[1].SubHead.Should().Be(OverheadSubHead.Pdf);
        allocations[1].CommittedAmount.Should().Be(2_000m);
        allocations[1].OrderIndex.Should().Be(1);
    }

    [Fact]
    public async Task RaiseAsync_ProjectHasDaAssigned_NewInstanceAssignedToDaUser()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        var indentId = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.Indents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.AssignedToUserId.Should().Be(daUserId);
        instance.IsAssignedViaProjectDa.Should().BeTrue();
    }

    [Fact]
    public async Task RaiseAsync_ProjectHasNoDaAtRaiseTime_StageStaysRoleWide()
    {
        var f = Create(); // no CurrentDaUserId set on this fixture's project

        var indentId = await f.Service.RaiseAsync(Input(f), f.OwnerUserId);

        var saved = await f.Db.Indents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.AssignedToUserId.Should().BeNull();
    }
}
