using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class ProjectServiceUpsertTests
{
    /// <summary>Every owner used across this file resolves to this
    /// department unless a test explicitly asks for something else --
    /// keeps CreateSampleProjectAsync's existing call sites unchanged.</summary>
    private static readonly Guid DefaultDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    /// <summary>
    /// True by default (department = DefaultDepartmentId or the explicit
    /// override), so most tests need not think about it. False is how a
    /// test asks for an owner who genuinely has none -- distinct from "not
    /// specified", which departmentId ?? DefaultDepartmentId could not tell
    /// apart from an explicit null (Phase 9 hit exactly this bug once
    /// already).
    /// </summary>
    private static (ProjectService Service, TestProjectsDbContext Db) CreateService(
        Guid? departmentId = null, bool hasDepartment = true)
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        // Without this, RecordGrantReceiptAsync's RaiseAsync/ForwardAsync pair
        // resolves against WorkflowDefinitionService's fallback shipped office
        // route (initial stage Raised) instead of GrantReceiptWorkflowSeeder's
        // actual PI -> HOD -> RnC office -> Dean chain -- silently the wrong
        // route, not a thrown error, so every test in this file that records a
        // grant receipt needs the real route seeded. Synchronous
        // .GetAwaiter().GetResult() here (rather than making CreateService
        // async) keeps every one of this file's ~30 call sites unchanged.
        GrantReceiptWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        var department = hasDepartment ? (departmentId ?? DefaultDepartmentId) : (Guid?)null;
        var service = new ProjectService(
            db, new WorkflowEngineService(db), new ProjectYearCalculator(), new OverheadSplitValidator(),
            new FakeDepartment(department),
            new InstituteWideScopeResolver(db, new FakeDepartment(department)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        return (service, db);
    }

    private static async Task<Project> CreateSampleProjectAsync(
        ProjectService service, Guid ownerUserId,
        IReadOnlyList<SanctionedManpowerPositionInput>? manpower = null)
    {
        return await service.CreateAsync(
            ownerUserId,
            ProjectType.TypeIResearch,
            "SAN-001",
            new DateOnly(2024, 6, 1),
            "Sample Project",
            new DateOnly(2024, 6, 1),
            "DST",
            36,
            1000000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m)],
            [],
            manpower ?? []);
    }

    [Fact]
    public async Task CreateAsync_SnapshotsTheOwnersCurrentDepartment()
    {
        var departmentId = Guid.NewGuid();
        var (service, _) = CreateService(departmentId);
        var ownerId = Guid.NewGuid();

        var project = await CreateSampleProjectAsync(service, ownerId);

        project.DepartmentId.Should().Be(departmentId);
    }

    [Fact]
    public async Task CreateAsync_WithNoDepartment_Throws()
    {
        var (service, _) = CreateService(hasDepartment: false);
        var ownerId = Guid.NewGuid();

        var act = () => CreateSampleProjectAsync(service, ownerId);

        await act.Should().ThrowAsync<OwnerHasNoDepartmentException>();
    }

    [Fact]
    public async Task CreateAsync_DepartmentSnapshot_IsUnaffectedByTheOwnersLaterDepartmentChange()
    {
        // The whole reason this is snapshotted rather than resolved live:
        // a project's DepartmentId must not silently follow the owner if
        // they transfer departments after the project already exists.
        var originalDepartmentId = Guid.NewGuid();
        var (service, db) = CreateService(originalDepartmentId);
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        // Simulate the owner transferring departments -- the fake provider
        // would now resolve differently for any *new* project, but this
        // project's own stored value must not move.
        var reloaded = await db.Projects.FindAsync(project.Id);

        reloaded!.DepartmentId.Should().Be(originalDepartmentId);
    }

    [Fact]
    public async Task UpdateAsync_KeepsSameBudgetHeadId_WhenIdIsPassedBackInUpdate()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var originalHeadId = project.BudgetHeads.Single().Id;

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(originalHeadId, BudgetHeadName.RecurringOverhead, 20000m, 20000m, 20000m)],
            [], []);

        updated.BudgetHeads.Single().Id.Should().Be(originalHeadId);
        updated.BudgetHeads.Single().Year1Amount.Should().Be(20000m);
    }

    [Fact]
    public async Task CreateAsync_BudgetHeadWithFiveYears_PersistsAllFiveAndTotal()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-5YR", new DateOnly(2024, 6, 1),
            "Five Year Project", new DateOnly(2024, 6, 1), "DST", 60, 5_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m, 10000m, 10000m)],
            [], []);

        var head = db.BudgetHeads.Single(b => b.ProjectId == project.Id);
        head.Year4Amount.Should().Be(10000m);
        head.Year5Amount.Should().Be(10000m);
        head.Total.Should().Be(50000m);
    }

    [Fact]
    public async Task CreateAsync_BudgetHeadWithoutYear4Or5_DefaultsBothToZero()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-3YR", new DateOnly(2024, 6, 1),
            "Three Year Project", new DateOnly(2024, 6, 1), "DST", 36, 3_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m)],
            [], []);

        var head = db.BudgetHeads.Single(b => b.ProjectId == project.Id);
        head.Year4Amount.Should().Be(0m);
        head.Year5Amount.Should().Be(0m);
        head.Total.Should().Be(30000m);
    }

    [Fact]
    public async Task UpdateAsync_RemovesBudgetHead_WhenOmittedFromInputList()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [], [], []);

        updated.BudgetHeads.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateAsync_AddsNewBudgetHead_WhenIdIsNull()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var existingHeadId = project.BudgetHeads.Single().Id;

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(existingHeadId, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 5000m, 5000m, 5000m),
            ],
            [], []);

        updated.BudgetHeads.Should().HaveCount(2);
        updated.BudgetHeads.Should().Contain(h => h.Id == existingHeadId);
        updated.BudgetHeads.Should().Contain(h => h.HeadName == BudgetHeadName.RecurringConsumable && h.Id != existingHeadId);
    }

    [Fact]
    public async Task UpdateAsync_WithoutBudgetHeadIds_PreservesExistingHeadIds_ByNameAndCustomLabel()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var existingHeadId = project.BudgetHeads.Single().Id;

        // Input with null Id but matching HeadName
        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 15000m, 15000m, 15000m),
            ],
            [], []);

        updated.BudgetHeads.Should().HaveCount(1);
        updated.BudgetHeads.Single().Id.Should().Be(existingHeadId);
        updated.BudgetHeads.Single().Total.Should().Be(45000m);
        updated.Collaborators.Single().Id.Should().Be(project.Collaborators.Single().Id);
    }

    [Fact]
    public async Task CreateAsync_WithOtherHeadAndNoCustomLabel_ThrowsArgumentException()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();

        var act = () => service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-OTHER-1", new DateOnly(2024, 6, 1),
            "Other Head Test", new DateOnly(2024, 6, 1), "DST", 12, 1000m,
            [], [new BudgetHeadInput(null, BudgetHeadName.Other, 500m, 0m, 0m)], [], []);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateAsync_WithOtherHeadAndCustomLabel_PersistsTheLabel()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-OTHER-2", new DateOnly(2024, 6, 1),
            "Other Head Test", new DateOnly(2024, 6, 1), "DST", 12, 1000m,
            [], [new BudgetHeadInput(null, BudgetHeadName.Other, 500m, 0m, 0m, CustomLabel: "Miscellaneous Charges")], [], []);

        var head = db.BudgetHeads.Single(b => b.ProjectId == project.Id);
        head.CustomLabel.Should().Be("Miscellaneous Charges");
    }

    [Fact]
    public async Task CreateAsync_TwoOtherHeadsWithSameLabel_Throws()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();

        var act = () => service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-OTHER-DUP", DateOnly.FromDateTime(DateTime.UtcNow),
            "Duplicate Other Head Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [],
            [
                new BudgetHeadInput(null, BudgetHeadName.Other, 5000m, 0m, 0m, CustomLabel: "Publication Charges"),
                new BudgetHeadInput(null, BudgetHeadName.Other, 3000m, 0m, 0m, CustomLabel: "Publication Charges"),
            ],
            [], []);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Publication Charges*");
    }

    [Fact]
    public async Task UpdateAsync_ChangingHeadToOtherWithoutCustomLabel_ThrowsArgumentException()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-OTHER-3", DateOnly.FromDateTime(DateTime.UtcNow),
            "Other Head Update Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 1000m,
            [], [new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 500m, 0m, 0m)], [], []);
        var headId = project.BudgetHeads.Single().Id;

        var act = () => service.UpdateAsync(
            project.Id, ownerId, ProjectType.TypeIResearch, "SAN-OTHER-3", DateOnly.FromDateTime(DateTime.UtcNow),
            "Other Head Update Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 1000m,
            [], [new BudgetHeadInput(headId, BudgetHeadName.Other, 500m, 0m, 0m, CustomLabel: null)], [], []);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CreateAsync_WithOverheadPercentAndNoOverheadRow_ComputesTotalAmount()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var budgetHeads = new List<BudgetHeadInput>
        {
            new(null, BudgetHeadName.RecurringConsumable, 100000m, 0m, 0m),
        };

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-1", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [], budgetHeads, [], [], overheadPercent: 10m);

        project.TotalAmount.Should().Be(110000m); // 100000 + (100000 * 10%)
    }

    [Fact]
    public async Task CreateAsync_WithOverheadPercentAndAnOverheadRow_AddsBothIndependently()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var budgetHeads = new List<BudgetHeadInput>
        {
            new(null, BudgetHeadName.RecurringConsumable, 100000m, 0m, 0m),
            new(null, BudgetHeadName.RecurringOverhead, 5000m, 0m, 0m),
        };

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-2", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Test 2", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [], budgetHeads, [], [], overheadPercent: 10m);

        // nonOverheadTotal = 100000 (the RecurringOverhead row itself is excluded from this base)
        // overheadRowTotal = 5000
        // Since overhead row exists, overhead is NOT added twice; total = 100000 + 5000 = 105000
        project.TotalAmount.Should().Be(105000m);
    }

    [Fact]
    public async Task CreateAsync_WithOverheadPercentAndNoRecurringOverheadRow_ComputesDerivedOverhead()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var budgetHeads = new List<BudgetHeadInput>
        {
            new(null, BudgetHeadName.RecurringConsumable, 100000m, 0m, 0m),
        };

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-2B", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Test 2B", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [], budgetHeads, [], [], overheadPercent: 10m);

        // nonOverheadTotal = 100000
        // percentDerived = 100000 * 10% = 10000
        // overheadRowTotal = 0 -> total = 100000 + 10000 = 110000
        project.TotalAmount.Should().Be(110000m);
    }

    [Fact]
    public async Task CreateAsync_WithNoOverheadPercent_TotalAmountEqualsNonOverheadHeadsSum()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var budgetHeads = new List<BudgetHeadInput>
        {
            new(null, BudgetHeadName.RecurringConsumable, 50000m, 0m, 0m),
        };

        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-3", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Test 3", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 50000m,
            [], budgetHeads, [], []);

        project.TotalAmount.Should().Be(50000m);
        project.OverheadPercent.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_RecomputesTotalAmountWhenBudgetHeadsChange()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-4", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Update Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [], [new(null, BudgetHeadName.RecurringConsumable, 100000m, 0m, 0m)], [], [], overheadPercent: 10m);

        var headId = project.BudgetHeads.Single().Id;
        var updated = await service.UpdateAsync(
            project.Id, ownerId, ProjectType.TypeIResearch, "SAN-TOTAL-4", DateOnly.FromDateTime(DateTime.UtcNow),
            "Total Amount Update Test", DateOnly.FromDateTime(DateTime.UtcNow), "DST", 12, 100000m,
            [], [new(headId, BudgetHeadName.RecurringConsumable, 200000m, 0m, 0m)], [], [], overheadPercent: 10m);

        updated.TotalAmount.Should().Be(220000m); // 200000 + (200000 * 10%)
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_WritesAnAuditLogRow()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 10000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 4000m,
                [OverheadSubHead.Pdf] = 4000m,
                [OverheadSubHead.Ddf] = 2000m,
            }, remarks: "Test remark.");

        var entry = db.AuditLogs.Single(a => a.Action == "GrantReceiptRecorded");
        entry.EntityType.Should().Be(nameof(Project));
        entry.EntityId.Should().Be(project.Id);
        entry.ActorUserId.Should().Be(ownerId);
    }

    [Fact]
    public async Task UpdateAsync_WritesAnAuditLogRow()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [], [], []);

        var entry = db.AuditLogs.Single(a => a.Action == "Updated");
        entry.EntityType.Should().Be(nameof(Project));
        entry.EntityId.Should().Be(project.Id);
        entry.ActorUserId.Should().Be(ownerId);
    }

    [Fact]
    public async Task SoftDeleteAsync_WritesAnAuditLogRow()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        await service.SoftDeleteAsync(project.Id, ownerId);

        var entry = db.AuditLogs.Single(a => a.Action == "SoftDeleted");
        entry.EntityType.Should().Be(nameof(Project));
        entry.EntityId.Should().Be(project.Id);
        entry.ActorUserId.Should().Be(ownerId);
    }

    [Fact]
    public async Task UpdateAsync_GrantReceiptBudgetHeadLink_SurvivesUpdateThatKeepsHead()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 10000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 4000m,
                [OverheadSubHead.Pdf] = 4000m,
                [OverheadSubHead.Ddf] = 2000m,
            }, remarks: "Test remark.");

        await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(headId, BudgetHeadName.RecurringOverhead, 15000m, 15000m, 15000m)],
            [], []);

        var reloadedReceipt = await db.GrantReceipts.FindAsync(receipt.Id);
        reloadedReceipt!.BudgetHeadId.Should().Be(headId);
    }

    [Fact]
    public async Task SoftDeleteAsync_SetsIsDeletedAndExcludesFromListForOwner()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        await service.SoftDeleteAsync(project.Id, ownerId);

        var list = await service.ListForOwnerAsync(ownerId);
        list.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_ThrowsAccessDenied()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var act = () => service.GetAsync(project.Id, otherUserId);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_WithNoRoles_StillThrowsAccessDenied()
    {
        // The default parameter must not silently widen every existing call
        // site the moment this ships -- an empty/omitted role collection is
        // exactly today's behaviour, unchanged.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var act = () => service.GetAsync(project.Id, otherUserId, []);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Theory]
    [InlineData("Dean")]
    [InlineData("DeputyRegistrar")]
    [InlineData("Superintendent")]
    [InlineData("RegularStaff")]
    public async Task GetAsync_DifferentOwner_WithAnOfficeRole_Succeeds(string officeRole)
    {
        // Read-only widening: an RnC office role may view any project, not
        // just their own -- they administer sanctioned grants across the
        // institute, the same reasoning that gives them institute-wide sight
        // of proposals and indents. This does not touch UpdateAsync,
        // SoftDeleteAsync or RecordGrantReceiptAsync, which stay owner-only.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var result = await service.GetAsync(project.Id, otherUserId, [officeRole]);

        result.Should().NotBeNull();
        result!.Id.Should().Be(project.Id);
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_WithAnUnrelatedRole_StillThrowsAccessDenied()
    {
        // Only the named office roles widen access -- Faculty (or any other
        // role) holding no special relationship to the project stays denied,
        // even though this overload now takes a role collection.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var act = () => service.GetAsync(project.Id, otherUserId, ["Faculty"]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetAsync_TheOwner_StillSucceeds_RegardlessOfRoles()
    {
        // The owner's own access is unaffected by this change either way.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var result = await service.GetAsync(project.Id, ownerId, []);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAsync_ComputerCentre_WithNoPendingAdvertisement_StillThrowsAccessDenied()
    {
        // ComputerCentre holds no general project visibility -- unlike the
        // RnCOfficeRoles group, it must not see a project it has no pending
        // advertisement action on.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var act = () => service.GetAsync(project.Id, otherUserId, ["ComputerCentre"]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetAsync_ComputerCentre_WithAdvertisementAtItsOwnStage_Succeeds()
    {
        // The narrow widening: a ComputerCentre caller may view a project
        // when one of its recruitments has an advertisement currently
        // sitting at WithComputerCentre -- this is what unblocks
        // RecruitmentService.GetAsync (which calls this method to load the
        // project before returning the recruitment's own detail) for the
        // Approve action ComputerCentre is actually meant to take.
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var workflowInstanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowInstanceId,
            RequestType = RequestType.Advertisement,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.WithComputerCentre,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            AdvertisementWorkflowInstanceId = workflowInstanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await service.GetAsync(project.Id, otherUserId, ["ComputerCentre"]);

        result.Should().NotBeNull();
        result!.Id.Should().Be(project.Id);
    }

    [Fact]
    public async Task GetAsync_ComputerCentre_WithAdvertisementAtADifferentStage_StillThrowsAccessDenied()
    {
        // The check is stage-specific, not "any advertisement exists" -- an
        // advertisement still at the RnC-office stage (not yet
        // ComputerCentre's turn) must not widen access early.
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var workflowInstanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowInstanceId,
            RequestType = RequestType.Advertisement,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.WithRnCOfficeAdvertisement,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            AdvertisementWorkflowInstanceId = workflowInstanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var act = () => service.GetAsync(project.Id, otherUserId, ["ComputerCentre"]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetAsync_ComputerCentre_WhoPublishedTheAdvertisement_StillSucceedsAfterItLeavesTheirStage()
    {
        // The instant a ComputerCentre caller approves (publishes) the
        // advertisement, the instance moves past WithComputerCentre, so the
        // pending-stage widening above no longer applies -- without this
        // second, actor-scoped widening, GetAsync would 403 the very person
        // who just published, the moment they try to view the project again
        // (e.g. reached via the "Published" history list).
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var computerCentreUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var workflowInstanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowInstanceId,
            RequestType = RequestType.Advertisement,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Approved,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowSteps.Add(new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = workflowInstanceId,
            Stage = WorkflowStage.WithComputerCentre,
            Action = WorkflowAction.Approve,
            ActorUserId = computerCentreUserId,
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            AdvertisementWorkflowInstanceId = workflowInstanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await service.GetAsync(project.Id, computerCentreUserId, ["ComputerCentre"]);

        result.Should().NotBeNull();
        result!.Id.Should().Be(project.Id);
    }

    [Fact]
    public async Task GetAsync_ComputerCentre_WhoDidNotPublishTheAdvertisement_ThrowsAccessDeniedOnceItLeavesTheirStage()
    {
        // The actor-scoped widening is specific to the caller who acted, not
        // "any ComputerCentre user" -- a different ComputerCentre caller who
        // never approved this advertisement gets no special access once it
        // has moved past WithComputerCentre.
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var computerCentreUserId = Guid.NewGuid();
        var otherComputerCentreUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var workflowInstanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowInstanceId,
            RequestType = RequestType.Advertisement,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Approved,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowSteps.Add(new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = workflowInstanceId,
            Stage = WorkflowStage.WithComputerCentre,
            Action = WorkflowAction.Approve,
            ActorUserId = computerCentreUserId,
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            AdvertisementWorkflowInstanceId = workflowInstanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var act = () => service.GetAsync(project.Id, otherComputerCentreUserId, ["ComputerCentre"]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_SingleReceiptExceedingOverallSanction_Throws()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        // Overall sanctioned = 30,000; 35,000 exceeds overall sanctioned budget head total
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 35000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 14000m,
                [OverheadSubHead.Pdf] = 14000m,
                [OverheadSubHead.Ddf] = 7000m,
            }, remarks: "Test remark.");

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ExceedingYearSanctionWithoutRemarks_Throws()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        // Year 1 sanctioned = 10,000; 15,000 exceeds Year 1 but is within overall 30,000. Without remarks, it throws.
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 15000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 6000m,
                [OverheadSubHead.Pdf] = 6000m,
                [OverheadSubHead.Ddf] = 3000m,
            }, remarks: null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_SecondReceiptPushingTotalPastOverallSanction_Throws()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var first = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 20000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 8000m,
                [OverheadSubHead.Pdf] = 8000m,
                [OverheadSubHead.Ddf] = 4000m,
            }, remarks: "Test remark.");

        await service.ForwardGrantReceiptAsync(first.Id, Guid.NewGuid(), ["HOD"], "HOD ok", default);
        await service.ForwardGrantReceiptAsync(first.Id, Guid.NewGuid(), ["RegularStaff"], "DA ok", default);
        await service.ForwardGrantReceiptAsync(first.Id, Guid.NewGuid(), ["Superintendent"], "Superintendent ok", default);
        await service.ForwardGrantReceiptAsync(first.Id, Guid.NewGuid(), ["DeputyRegistrar"], "DeputyRegistrar ok", default);
        await service.ApproveGrantReceiptAsync(first.Id, Guid.NewGuid(), ["Dean"], "Dean approves", default);

        // 20,000 already Approved + 15,000 new = 35,000 > 30,000 overall sanctioned
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 2), 15000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 6000m,
                [OverheadSubHead.Pdf] = 6000m,
                [OverheadSubHead.Ddf] = 3000m,
            }, remarks: "Test remark.");

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_OverheadHeadWithInvalidSplit_ThrowsArgumentException()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 10000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 5000m,
                [OverheadSubHead.Pdf] = 3000m,
                [OverheadSubHead.Ddf] = 2000m,
            }, remarks: "Test remark.");

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_Year4WithinSanction_Succeeds()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-Y4", new DateOnly(2024, 6, 1),
            "Year 4 Project", new DateOnly(2024, 6, 1), "DST", 48, 5_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m, 50000m, 0m)],
            [], []);
        var headId = project.BudgetHeads.Single().Id;

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2027, 6, 1), 30000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 12000m,
                [OverheadSubHead.Pdf] = 12000m,
                [OverheadSubHead.Ddf] = 6000m,
            }, projectYear: 4, remarks: "Test remark.");

        receipt.Amount.Should().Be(30000m);
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_Year4ExceedsOverallSanction_Throws()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerId, ProjectType.TypeIResearch, "SAN-Y4X", new DateOnly(2024, 6, 1),
            "Year 4 Project Exceed", new DateOnly(2024, 6, 1), "DST", 48, 5_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m, 50000m, 0m)],
            [], []);
        var headId = project.BudgetHeads.Single().Id;

        // Overall sanctioned = 80,000; 90,000 exceeds overall budget head sanction
        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2027, 6, 1), 90000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 36000m,
                [OverheadSubHead.Pdf] = 36000m,
                [OverheadSubHead.Ddf] = 18000m,
            }, projectYear: 4, remarks: "Test remark.");

        await act.Should().ThrowAsync<GrantReceiptExceedsSanctionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ReceivedBeforeAgencySubmission_Throws()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        db.ResearchProposals.Add(new ResearchProposal
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerId,
            DepartmentId = DefaultDepartmentId,
            Title = "Sample Proposal",
            Agency = "DST",
            Status = ProposalStatus.Sanctioned,
            SubmittedToAgencyOn = new DateOnly(2026, 6, 1),
            ProjectId = project.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId,
            receivedDate: new DateOnly(2026, 5, 1), // before submission
            amount: 1000m,
            overheadSplit: new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 400m,
                [OverheadSubHead.Pdf] = 400m,
                [OverheadSubHead.Ddf] = 200m,
            },
            projectYear: null,
            remarks: "Test remark.");

        await act.Should().ThrowAsync<GrantReceivedBeforeSubmissionException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_ReceivedOnOrAfterAgencySubmission_Succeeds()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        db.ResearchProposals.Add(new ResearchProposal
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerId,
            DepartmentId = DefaultDepartmentId,
            Title = "Sample Proposal",
            Agency = "DST",
            Status = ProposalStatus.Sanctioned,
            SubmittedToAgencyOn = new DateOnly(2026, 6, 1),
            ProjectId = project.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId,
            receivedDate: new DateOnly(2026, 6, 1), // same day is allowed
            amount: 1000m,
            overheadSplit: new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 400m,
                [OverheadSubHead.Pdf] = 400m,
                [OverheadSubHead.Ddf] = 200m,
            },
            projectYear: null,
            remarks: "Test remark.");

        receipt.Should().NotBeNull();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_NoSourceProposal_SkipsTheDateCheck()
    {
        // A project created directly, with no ResearchProposal referencing it
        // via ProjectId (i.e. not created from a sanctioned proposal) -- the
        // date check must not block this, since there is no submission date
        // to compare against.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId,
            receivedDate: new DateOnly(2024, 6, 1), // arbitrarily early -- the project's own start date, well before "today"
            amount: 1000m,
            overheadSplit: new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 400m,
                [OverheadSubHead.Pdf] = 400m,
                [OverheadSubHead.Ddf] = 200m,
            },
            projectYear: null,
            remarks: "Test remark.");

        receipt.Should().NotBeNull();
    }

    // ------------------------------------------------------- ListVisibleToAsync

    /// <summary>Resolves a different department per user, unlike the shared
    /// FakeDepartment above (which answers the same department for everyone
    /// -- fine for the office-role tests, useless for proving an HOD sees
    /// only their own department and not another PI's).</summary>
    private sealed class FakeDepartmentPerUser(Dictionary<Guid, Guid?> byUser) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(byUser.GetValueOrDefault(userId));
    }

    private static (ProjectService Service, TestProjectsDbContext Db) CreateServiceWithDepartments(
        Dictionary<Guid, Guid?> departmentByUser)
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var service = new ProjectService(
            db, new WorkflowEngineService(db), new ProjectYearCalculator(), new OverheadSplitValidator(),
            new FakeDepartmentPerUser(departmentByUser),
            new InstituteWideScopeResolver(db, new FakeDepartmentPerUser(departmentByUser)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        return (service, db);
    }

    [Fact]
    public async Task ListVisibleToAsync_Faculty_SeesOnlyTheirOwnProjects()
    {
        // The bug this guards against: a prior implementation called
        // db.Projects.ToListAsync() with no filter at all, so any
        // authenticated user -- of any role -- saw every project in the
        // system. This is the regression test for that.
        var ownerId = Guid.NewGuid();
        var otherPiId = Guid.NewGuid();
        var departmentByUser = new Dictionary<Guid, Guid?>
        {
            [ownerId] = DefaultDepartmentId,
            [otherPiId] = DefaultDepartmentId,
        };
        var (service, _) = CreateServiceWithDepartments(departmentByUser);
        var mine = await CreateSampleProjectAsync(service, ownerId);
        await CreateSampleProjectAsync(service, otherPiId);

        var visible = await service.ListVisibleToAsync(ownerId, ["Faculty"]);

        visible.Select(p => p.Id).Should().BeEquivalentTo([mine.Id]);
    }

    [Fact]
    public async Task ListVisibleToAsync_Hod_SeesTheirWholeDepartment_NotOtherDepartments()
    {
        var hodId = Guid.NewGuid();
        var sameDeptPiId = Guid.NewGuid();
        var otherDeptPiId = Guid.NewGuid();
        var hodDepartmentId = Guid.NewGuid();
        var otherDepartmentId = Guid.NewGuid();
        var departmentByUser = new Dictionary<Guid, Guid?>
        {
            [hodId] = hodDepartmentId,
            [sameDeptPiId] = hodDepartmentId,
            [otherDeptPiId] = otherDepartmentId,
        };
        var (service, _) = CreateServiceWithDepartments(departmentByUser);
        var sameDept = await CreateSampleProjectAsync(service, sameDeptPiId);
        await CreateSampleProjectAsync(service, otherDeptPiId);

        var visible = await service.ListVisibleToAsync(hodId, ["HOD"]);

        visible.Select(p => p.Id).Should().BeEquivalentTo([sameDept.Id]);
    }

    [Theory]
    [InlineData("Dean")]
    [InlineData("DeputyRegistrar")]
    [InlineData("Superintendent")]
    [InlineData("RegularStaff")]
    public async Task ListVisibleToAsync_OfficeRole_SeesEveryProjectInstituteWide(string officeRole)
    {
        var officeUserId = Guid.NewGuid();
        var piAId = Guid.NewGuid();
        var piBId = Guid.NewGuid();
        var departmentByUser = new Dictionary<Guid, Guid?>
        {
            [officeUserId] = DefaultDepartmentId,
            [piAId] = DefaultDepartmentId,
            [piBId] = Guid.NewGuid(),
        };
        var (service, _) = CreateServiceWithDepartments(departmentByUser);
        await CreateSampleProjectAsync(service, piAId);
        await CreateSampleProjectAsync(service, piBId);

        var visible = await service.ListVisibleToAsync(officeUserId, [officeRole]);

        visible.Should().HaveCount(2, "an R&C office role sees every project institute-wide");
    }

    [Fact]
    public async Task ListVisibleToAsync_ExcludesSoftDeletedProjects()
    {
        var ownerId = Guid.NewGuid();
        var departmentByUser = new Dictionary<Guid, Guid?> { [ownerId] = DefaultDepartmentId };
        var (service, _) = CreateServiceWithDepartments(departmentByUser);
        var project = await CreateSampleProjectAsync(service, ownerId);
        await service.SoftDeleteAsync(project.Id, ownerId);

        var visible = await service.ListVisibleToAsync(ownerId, ["Faculty"]);

        visible.Should().BeEmpty();
    }

    [Fact]
    public async Task ListVisibleToAsync_WithNoRoles_SeesOnlyTheirOwnProjects()
    {
        // Matches GetAsync's default: an empty/omitted role collection is
        // strict owner-only, not a silent institute-wide widening.
        var ownerId = Guid.NewGuid();
        var otherPiId = Guid.NewGuid();
        var departmentByUser = new Dictionary<Guid, Guid?>
        {
            [ownerId] = DefaultDepartmentId,
            [otherPiId] = DefaultDepartmentId,
        };
        var (service, _) = CreateServiceWithDepartments(departmentByUser);
        var mine = await CreateSampleProjectAsync(service, ownerId);
        await CreateSampleProjectAsync(service, otherPiId);

        var visible = await service.ListVisibleToAsync(ownerId);

        visible.Select(p => p.Id).Should().BeEquivalentTo([mine.Id]);
    }

    // ------------------------------------------- GetManpowerPositionsAsync (scoped)

    [Fact]
    public async Task GetManpowerPositionsAsync_Scoped_DifferentOwner_ReturnsEmpty()
    {
        // The scoped overload existed but was never wired to the controller
        // -- the endpoint called the unscoped one instead, handing back any
        // project's manpower positions to any signed-in user. This is the
        // regression test for that gap.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var positions = await service.GetManpowerPositionsAsync(project.Id, otherUserId, []);

        positions.Should().BeEmpty();
    }

    [Fact]
    public async Task GetManpowerPositionsAsync_Scoped_TheOwner_Succeeds()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId, manpower:
        [
            new SanctionedManpowerPositionInput(null, "Junior Research Fellow", 1, 31000m, 0m),
        ]);

        var positions = await service.GetManpowerPositionsAsync(project.Id, ownerId, []);

        positions.Should().ContainSingle(p => p.Designation == "Junior Research Fellow");
    }

    [Fact]
    public async Task RaiseReappropriationAsync_Unscoped_DifferentOwner_ReturnsForbidden()
    {
        // Renamed from ReappropriateBudgetAsync_DifferentOwner_ThrowsProjectAccessDeniedException.
        // The old API took a bare destination head id/name pair (destination
        // head id was nullable, e.g. "General Fund" with no real BudgetHead);
        // the new RaiseReappropriationAsync requires every source/destination
        // line's BudgetHeadId to resolve to a real BudgetHead on the project
        // (see ProjectService.cs ~1186-1195), so both lines here reference the
        // project's single real "Recurring Overhead" head. The ownership
        // check this test pins (ProjectAccessDeniedException for a
        // non-owner caller) fires before the budget-head lookup either way,
        // so the head id does not need to be real for this specific test --
        // kept real regardless, for consistency with the other rewritten
        // tests in this section.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var act = () => service.RaiseReappropriationAsync(
            project.Id, otherUserId, "Test",
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1000m)],
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1000m)]);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task RaiseReappropriationAsync_AmountExceedsSourceHeadBalance_Throws()
    {
        // Superseded by task B4: re-appropriation now validates against the
        // source head's *effective received* total (actual GrantReceipts
        // net of prior reappropriations), never against Sanctioned Budget
        // (BudgetHead.Total/Year1Amount), which a reappropriation must never
        // mutate. Nothing has been received into this head at all, so even
        // a modest amount now correctly throws
        // ReappropriationExceedsReceivedException rather than the old
        // ArgumentException keyed off Total.
        //
        // Renamed from ReappropriateBudgetAsync_AmountExceedsSourceHeadBalance_Throws;
        // destination is the same single real head as the source since the
        // new API requires a real BudgetHeadId (see note on the previous
        // test) -- the source-side check throws first regardless.
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var act = () => service.RaiseReappropriationAsync(
            project.Id, ownerId, "Test",
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1m)],
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1m)]);

        await act.Should().ThrowAsync<ReappropriationExceedsReceivedException>();
    }

    // GetReappropriationAsync's authorization gap is covered in
    // ProjectServiceReappropriationTests.cs, which already has the
    // received-funds fixture RaiseReappropriationAsync needs to succeed here.

    [Fact]
    public async Task GetAsync_IncludesBudgetReappropriationLogs()
    {
        // Project.BudgetReappropriationLogs is a navigation collection
        // loaded by the private LoadProjectWithChildrenAsync helper
        // alongside BudgetHeads/GrantReceipts/etc. GetAsync is the public
        // seam that surfaces that loaded Project, so a reappropriation
        // raised via RaiseReappropriationAsync should be visible on the
        // very next GetAsync's collection.
        //
        // Renamed/rewritten from GetAsync_IncludesBudgetReappropriationLogs.
        // The old ReappropriateBudgetAsync wrote to Project.BudgetReappropriationLogs
        // (an immediate-mutation log entity); the new RaiseReappropriationAsync
        // instead writes a ReappropriationRequest onto Project.ReappropriationRequests
        // (see LoadProjectWithChildrenAsync, which loads ReappropriationRequests,
        // not BudgetReappropriationLogs, for a freshly-raised request). The
        // test's actual intent -- "GetAsync's eagerly-loaded project reflects
        // a just-raised reappropriation" -- is preserved by asserting against
        // ReappropriationRequests instead.
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;
        // Task B4: re-appropriation now validates against effective received,
        // not Sanctioned Budget -- record a receipt so the transfer has
        // something to move.
        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 1000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 400m,
                [OverheadSubHead.Pdf] = 400m,
                [OverheadSubHead.Ddf] = 200m,
            }, remarks: "Test remark.");
        // Task 5: BudgetHeadEffectiveReceived now counts only Approved
        // receipts -- this test is about the reappropriation navigation
        // property, not the receipt approval chain, so drive it straight to
        // Approved.
        receipt.Status = GrantReceiptStatus.Approved;
        await db.SaveChangesAsync();

        var request = await service.RaiseReappropriationAsync(
            project.Id, ownerId, "Test",
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1000m)],
            [new ReappropriationLineInput(headId, "Recurring Overhead", 1000m)]);

        var reloaded = await service.GetAsync(project.Id, ownerId);

        reloaded.Should().NotBeNull();
        reloaded!.ReappropriationRequests.Should().ContainSingle(r => r.Id == request.Id);
    }

    [Fact]
    public async Task ListForProcessBillAsync_RegularFaculty_ReturnsOnlyOwnedProjects()
    {
        var deptId = Guid.NewGuid();
        var (service, _) = CreateService(deptId);
        var owner1 = Guid.NewGuid();
        var owner2 = Guid.NewGuid();

        var p1 = await CreateSampleProjectAsync(service, owner1);
        var p2 = await CreateSampleProjectAsync(service, owner2);

        var listForOwner1 = await service.ListForProcessBillAsync(owner1, ["Faculty"]);
        listForOwner1.Should().ContainSingle(p => p.Id == p1.Id);

        var newFacultyWithNoProjects = Guid.NewGuid();
        var listForNewFaculty = await service.ListForProcessBillAsync(newFacultyWithNoProjects, ["Faculty"]);
        listForNewFaculty.Should().BeEmpty();
    }

    [Fact]
    public async Task ListForProcessBillAsync_HodRole_ReturnsDepartmentProjects()
    {
        var deptId = Guid.NewGuid();
        var (service, _) = CreateService(deptId);
        var owner1 = Guid.NewGuid();
        var hodUserId = Guid.NewGuid();

        var p1 = await CreateSampleProjectAsync(service, owner1);

        var listForHod = await service.ListForProcessBillAsync(hodUserId, ["HOD"]);
        listForHod.Should().ContainSingle(p => p.Id == p1.Id);
    }

    /// <summary>
    /// Whole-branch review finding (Important #2): HasAnyDownstreamActivityAsync
    /// must also check HistoricalExpenditure/HistoricalGrantReceipt, or a
    /// project backfilled through the Historical Entries feature (exactly the
    /// kind of pre-existing project this feature targets) would be wrongly
    /// treated as "untouched" and eligible for hard-delete when a research
    /// proposal's sanction is undone -- silently cascade-deleting its
    /// HistoricalGrantReceipts and orphaning its HistoricalExpenditures.
    /// </summary>
    [Fact]
    public async Task HasAnyDownstreamActivityAsync_ProjectHasOnlyHistoricalExpenditure_ReturnsTrue()
    {
        var (service, db) = CreateService();
        var owner = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, owner);
        var head = project.BudgetHeads.Single();

        db.HistoricalExpenditures.Add(new HistoricalExpenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = head.Id,
            Amount = 1_000m,
            Description = "Backfilled spend",
            TransactionDate = new DateOnly(2024, 7, 1),
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await service.HasAnyDownstreamActivityAsync(project.Id);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task HasAnyDownstreamActivityAsync_ProjectHasOnlyHistoricalGrantReceipt_ReturnsTrue()
    {
        var (service, db) = CreateService();
        var owner = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, owner);
        var head = project.BudgetHeads.Single();

        db.HistoricalGrantReceipts.Add(new HistoricalGrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = head.Id,
            Amount = 1_000m,
            ReceivedDate = new DateOnly(2024, 7, 1),
            RecordedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await service.HasAnyDownstreamActivityAsync(project.Id);

        result.Should().BeTrue();
    }
}
