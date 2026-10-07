using API.Application.Access;
using API.Application.Reporting;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Projects;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Reporting;

/// <summary>
/// The BRD's explicit acceptance criterion ("data-scoping rules verified
/// with integration tests, not just unit tests") is honoured at two levels:
/// this file exercises ReportingService directly against a real in-memory
/// EF context (not mocked repositories), and Task 14's suite drives the
/// same scenarios through a fuller stack. Every scope (Own/Department/
/// Institute) is tested against the SAME seeded data, so a test passing by
/// coincidence (e.g. an empty result either way) is not possible.
/// </summary>
public class ReportingServiceTests
{
    private static readonly Guid CseDeptId = Guid.NewGuid();
    private static readonly Guid EedDeptId = Guid.NewGuid();
    private static readonly Guid RncDeptId = Guid.NewGuid();

    private static readonly Guid CsePiId = Guid.NewGuid();
    private static readonly Guid AnotherCsePiId = Guid.NewGuid();
    private static readonly Guid EedPiId = Guid.NewGuid();
    private static readonly Guid CseHodId = Guid.NewGuid();
    private static readonly Guid DeanInRncId = Guid.NewGuid();
    private static readonly Guid SuperintendentNotInRncId = Guid.NewGuid();

    private sealed class FakeDepartment(Dictionary<Guid, Guid?> byUser) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(byUser.GetValueOrDefault(userId));
    }

    private sealed class FakeStaffDirectory(IReadOnlyList<StaffMember> members) : IStaffDirectory
    {
        public Task<IReadOnlyList<StaffMember>> GetAllAsync(CancellationToken ct = default) =>
            Task.FromResult(members);
    }

    private static (ReportingService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);

        db.Departments.AddRange(
            new Department { Id = CseDeptId, Code = "CSED", Name = "Computer Science & Engineering", IsInstituteWide = false },
            new Department { Id = EedDeptId, Code = "EED", Name = "Electrical Engineering", IsInstituteWide = false },
            new Department { Id = RncDeptId, Code = "RNC", Name = "Research & Consultancy", IsInstituteWide = true });
        db.SaveChanges();

        var departmentByUser = new Dictionary<Guid, Guid?>
        {
            [CsePiId] = CseDeptId,
            [AnotherCsePiId] = CseDeptId,
            [EedPiId] = EedDeptId,
            [CseHodId] = CseDeptId,
            [DeanInRncId] = RncDeptId,
            [SuperintendentNotInRncId] = CseDeptId, // misconfigured/non-RnC office account
        };

        var staff = new List<StaffMember>
        {
            new(CsePiId, "Faculty", CseDeptId),
            new(AnotherCsePiId, "Faculty", CseDeptId),
            new(EedPiId, "Faculty", EedDeptId),
            new(CseHodId, "HOD", CseDeptId),
            new(DeanInRncId, "Dean", RncDeptId),
            new(SuperintendentNotInRncId, "Superintendent", CseDeptId),
        };

        var service = new ReportingService(
            db, new FakeDepartment(departmentByUser),
            new InstituteWideScopeResolver(db, new FakeDepartment(departmentByUser)),
            new FakeStaffDirectory(staff));

        return (service, db);
    }

    private static Project SampleProject(Guid ownerId, Guid departmentId, string title, decimal sanctioned = 500_000m) => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = ownerId,
        DepartmentId = departmentId,
        ProjectType = ProjectType.TypeIResearch,
        SanctionNo = $"SAN-{Guid.NewGuid():N}"[..12],
        SanctionDate = new DateOnly(2025, 6, 1),
        ProjectTitle = title,
        StartDate = new DateOnly(2025, 6, 1),
        Agency = "DST",
        DurationMonths = 36,
        TotalSanctioned = sanctioned,
        CreatedAt = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
    };

    // ---- GetNumberOfProjectsAsync: scope proof --------------------------------

    [Fact]
    public async Task GetNumberOfProjectsAsync_Faculty_SeesOnlyTheirOwnProjects()
    {
        var (service, db) = CreateService();
        db.Projects.AddRange(
            SampleProject(CsePiId, CseDeptId, "Mine"),
            SampleProject(AnotherCsePiId, CseDeptId, "Same department, someone else's"),
            SampleProject(EedPiId, EedDeptId, "Different department entirely"));
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(CsePiId, ["Faculty"]);

        rows.Sum(r => r.Count).Should().Be(1, "a PI cannot view another PI's data, even in their own department");
    }

    [Fact]
    public async Task GetNumberOfProjectsAsync_Hod_SeesTheirWholeDepartment_NotOtherDepartments()
    {
        var (service, db) = CreateService();
        db.Projects.AddRange(
            SampleProject(CsePiId, CseDeptId, "CSE 1"),
            SampleProject(AnotherCsePiId, CseDeptId, "CSE 2"),
            SampleProject(EedPiId, EedDeptId, "EED, not this HOD's department"));
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(CseHodId, ["HOD"]);

        rows.Sum(r => r.Count).Should().Be(2);
        rows.Should().OnlyContain(r => r.DepartmentId == CseDeptId);
    }

    [Fact]
    public async Task GetNumberOfProjectsAsync_DeanInRnc_SeesEveryDepartment()
    {
        var (service, db) = CreateService();
        db.Projects.AddRange(
            SampleProject(CsePiId, CseDeptId, "CSE"),
            SampleProject(EedPiId, EedDeptId, "EED"));
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(DeanInRncId, Dean);

        rows.Sum(r => r.Count).Should().Be(2, "Dean/R&C office see institute-wide, not just their own department");
    }

    [Fact]
    public async Task GetNumberOfProjectsAsync_OfficeRoleNotInRnc_SeesOnlyTheirOwnDepartment()
    {
        // The office role widening comes from R&C membership, not role rank
        // -- a Superintendent whose own department is not R&C-flagged (a
        // misconfigured account, or simply not RnC staff) is Department-
        // scoped like an HOD, not Institute-scoped.
        var (service, db) = CreateService();
        db.Projects.AddRange(
            SampleProject(CsePiId, CseDeptId, "CSE"),
            SampleProject(EedPiId, EedDeptId, "EED"));
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(SuperintendentNotInRncId, ["Superintendent"]);

        rows.Sum(r => r.Count).Should().Be(1);
        rows.Should().OnlyContain(r => r.DepartmentId == CseDeptId);
    }

    [Fact]
    public async Task GetNumberOfProjectsAsync_ExcludesSoftDeletedProjects()
    {
        var (service, db) = CreateService();
        var deleted = SampleProject(CsePiId, CseDeptId, "Deleted");
        deleted.IsDeleted = true;
        db.Projects.AddRange(deleted, SampleProject(CsePiId, CseDeptId, "Live"));
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(CsePiId, ["Faculty"]);

        rows.Sum(r => r.Count).Should().Be(1);
    }

    [Fact]
    public async Task GetNumberOfProjectsAsync_DateRange_FiltersByCreatedAt()
    {
        var (service, db) = CreateService();
        var early = SampleProject(CsePiId, CseDeptId, "Early");
        early.CreatedAt = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var inRange = SampleProject(CsePiId, CseDeptId, "In range");
        inRange.CreatedAt = new DateTimeOffset(2025, 6, 15, 0, 0, 0, TimeSpan.Zero);
        db.Projects.AddRange(early, inRange);
        await db.SaveChangesAsync();

        var rows = await service.GetNumberOfProjectsAsync(
            CsePiId, ["Faculty"], from: new DateOnly(2025, 1, 1), to: new DateOnly(2025, 12, 31));

        rows.Sum(r => r.Count).Should().Be(1);
    }

    // ---- GetGrantSanctionedAsync -----------------------------------------------

    [Fact]
    public async Task GetGrantSanctionedAsync_ReportsTotalSanctionedPerProject_InScope()
    {
        var (service, db) = CreateService();
        db.Projects.AddRange(
            SampleProject(CsePiId, CseDeptId, "Mine", 700_000m),
            SampleProject(AnotherCsePiId, CseDeptId, "Not mine", 300_000m));
        await db.SaveChangesAsync();

        var rows = await service.GetGrantSanctionedAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle(r => r.ProjectTitle == "Mine" && r.TotalSanctioned == 700_000m);
    }

    // ---- GetProjectExpenditureAsync --------------------------------------------

    [Fact]
    public async Task GetProjectExpenditureAsync_LinksByBudgetHeadId_ScopedToTheCaller()
    {
        var (service, db) = CreateService();
        var mine = SampleProject(CsePiId, CseDeptId, "Mine");
        var notMine = SampleProject(AnotherCsePiId, CseDeptId, "Not mine");
        db.Projects.AddRange(mine, notMine);
        var headId = Guid.NewGuid();
        db.BudgetHeads.Add(new BudgetHead { Id = headId, ProjectId = mine.Id, HeadName = BudgetHeadName.RecurringConsumable, Year1Amount = 100_000m, Year2Amount = 0, Year3Amount = 0, Total = 100_000m });
        db.Expenditure.Add(new Expenditure { Id = Guid.NewGuid(), ProjectId = mine.Id, BudgetHeadId = headId, SectionType = "consumable", TransactionDate = new DateOnly(2025, 7, 1), Amount = 25_000m });
        var otherHeadId = Guid.NewGuid();
        db.BudgetHeads.Add(new BudgetHead { Id = otherHeadId, ProjectId = notMine.Id, HeadName = BudgetHeadName.RecurringConsumable, Year1Amount = 50_000m, Year2Amount = 0, Year3Amount = 0, Total = 50_000m });
        db.Expenditure.Add(new Expenditure { Id = Guid.NewGuid(), ProjectId = notMine.Id, BudgetHeadId = otherHeadId, SectionType = "consumable", TransactionDate = new DateOnly(2025, 7, 1), Amount = 10_000m });
        await db.SaveChangesAsync();

        var rows = await service.GetProjectExpenditureAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle();
        rows.Single().ProjectId.Should().Be(mine.Id);
        rows.Single().Amount.Should().Be(25_000m);
    }

    [Fact]
    public async Task GetProjectExpenditureAsync_IgnoresRowsWithNoBudgetHeadId()
    {
        // Legacy rows that predate BudgetHeadId (Phase 10) are simply not
        // reportable by head -- this report is head-centric by design, not
        // a total-spend figure.
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        db.Expenditure.Add(new Expenditure { Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = null, SectionType = "consumable", TransactionDate = new DateOnly(2025, 7, 1), Amount = 99_999m });
        await db.SaveChangesAsync();

        var rows = await service.GetProjectExpenditureAsync(CsePiId, ["Faculty"]);

        rows.Should().BeEmpty();
    }

    // ---- GetProjectOverheadAsync ------------------------------------------------

    [Fact]
    public async Task GetProjectOverheadAsync_OnlyIncludesOverheadSplitReceipts()
    {
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        var headId = Guid.NewGuid();
        var parentId = Guid.NewGuid();
        db.GrantReceipts.Add(new GrantReceipt { Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = headId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 100_000m, Type = GrantReceiptType.Head, Status = GrantReceiptStatus.Approved });
        // The OverheadSplit child's own Status is meaningless (see
        // GrantReceipt.Status) -- what gates it into the report is its
        // PARENT's Status, via ParentReceiptId, so an Approved parent must
        // be present here for the child to appear.
        db.GrantReceipts.Add(new GrantReceipt { Id = parentId, ProjectId = project.Id, BudgetHeadId = headId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 400_000m, Type = GrantReceiptType.Head, Status = GrantReceiptStatus.Approved });
        db.GrantReceipts.Add(new GrantReceipt { Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = headId, ParentReceiptId = parentId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 40_000m, Type = GrantReceiptType.OverheadSplit, SubHead = OverheadSubHead.Idf });
        await db.SaveChangesAsync();

        var rows = await service.GetProjectOverheadAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle();
        rows.Single().SubHead.Should().Be(OverheadSubHead.Idf);
        rows.Single().Amount.Should().Be(40_000m);
    }

    /// <summary>
    /// Task 5 regression: an OverheadSplit child row inherits its parent
    /// receipt's approval state via ParentReceiptId (the child carries no
    /// meaningful Status of its own). A child whose parent is still
    /// PendingApproval must be excluded from the overhead report; one whose
    /// parent is Approved must be included.
    /// </summary>
    [Fact]
    public async Task GetProjectOverheadAsync_ChildWithPendingParent_Excluded_ChildWithApprovedParent_Included()
    {
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        var headId = Guid.NewGuid();

        var pendingParentId = Guid.NewGuid();
        db.GrantReceipts.Add(new GrantReceipt { Id = pendingParentId, ProjectId = project.Id, BudgetHeadId = headId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 100_000m, Type = GrantReceiptType.Head, Status = GrantReceiptStatus.PendingApproval });
        db.GrantReceipts.Add(new GrantReceipt { Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = headId, ParentReceiptId = pendingParentId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 10_000m, Type = GrantReceiptType.OverheadSplit, SubHead = OverheadSubHead.Idf });

        var approvedParentId = Guid.NewGuid();
        db.GrantReceipts.Add(new GrantReceipt { Id = approvedParentId, ProjectId = project.Id, BudgetHeadId = headId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 200_000m, Type = GrantReceiptType.Head, Status = GrantReceiptStatus.Approved });
        db.GrantReceipts.Add(new GrantReceipt { Id = Guid.NewGuid(), ProjectId = project.Id, BudgetHeadId = headId, ParentReceiptId = approvedParentId, ReceivedDate = new DateOnly(2025, 7, 1), Amount = 20_000m, Type = GrantReceiptType.OverheadSplit, SubHead = OverheadSubHead.Pdf });
        await db.SaveChangesAsync();

        var rows = await service.GetProjectOverheadAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle();
        rows.Single().SubHead.Should().Be(OverheadSubHead.Pdf);
        rows.Single().Amount.Should().Be(20_000m);
    }

    // ---- GetRefundsAsync --------------------------------------------------------

    [Fact]
    public async Task GetRefundsAsync_ScopedTheSameWayAsEveryOtherReport()
    {
        var (service, db) = CreateService();
        var mine = SampleProject(CsePiId, CseDeptId, "Mine");
        var notMine = SampleProject(AnotherCsePiId, CseDeptId, "Not mine");
        db.Projects.AddRange(mine, notMine);
        db.Refunds.Add(new Refund { Id = Guid.NewGuid(), ProjectId = mine.Id, Amount = 5000m, RefundDate = new DateOnly(2025, 8, 1), Reason = "unspent balance", RecordedByUserId = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow });
        db.Refunds.Add(new Refund { Id = Guid.NewGuid(), ProjectId = notMine.Id, Amount = 3000m, RefundDate = new DateOnly(2025, 8, 1), Reason = "not mine", RecordedByUserId = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();

        var rows = await service.GetRefundsAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle(r => r.ProjectId == mine.Id);
    }

    // ---- GetStaffCountAsync ------------------------------------------------------

    [Fact]
    public async Task GetStaffCountAsync_Faculty_SeesNothing()
    {
        var (service, _) = CreateService();

        var rows = await service.GetStaffCountAsync(CsePiId, ["Faculty"]);

        rows.Should().BeEmpty("the BRD gives a PI no institute-wide (or department-wide) view of staff");
    }

    [Fact]
    public async Task GetStaffCountAsync_Hod_SeesOnlyTheirDepartment()
    {
        var (service, _) = CreateService();

        var rows = await service.GetStaffCountAsync(CseHodId, ["HOD"]);

        rows.Should().OnlyContain(r => r.DepartmentId == CseDeptId);
        rows.Sum(r => r.Count).Should().Be(4,
            "CsePiId, AnotherCsePiId (Faculty), CseHodId (HOD) and SuperintendentNotInRncId are all in CSE");
    }

    [Fact]
    public async Task GetStaffCountAsync_DeanInRnc_SeesEveryDepartment()
    {
        var (service, _) = CreateService();

        var rows = await service.GetStaffCountAsync(DeanInRncId, Dean);

        rows.Sum(r => r.Count).Should().Be(6, "every seeded staff member across every department");
    }

    // ---- GetProjectEquipmentAsync ------------------------------------------------

    [Fact]
    public async Task GetProjectEquipmentAsync_ScopedTheSameWayAsEveryOtherReport()
    {
        var (service, db) = CreateService();
        var mine = SampleProject(CsePiId, CseDeptId, "Mine");
        var notMine = SampleProject(AnotherCsePiId, CseDeptId, "Not mine");
        db.Projects.AddRange(mine, notMine);
        db.SanctionedEquipment.Add(new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = mine.Id, Name = "Oscilloscope", Unit = "1", Amount = 150_000m });
        db.SanctionedEquipment.Add(new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = notMine.Id, Name = "Spectrometer", Unit = "1", Amount = 300_000m });
        await db.SaveChangesAsync();

        var rows = await service.GetProjectEquipmentAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle(r => r.EquipmentName == "Oscilloscope");
    }

    // ---- GetRecruitmentFunnelAsync ------------------------------------------------

    private static RecruitmentRequest SampleRecruitment(Guid projectId) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = projectId,
        SanctionedManpowerPositionId = Guid.NewGuid(),
        Stage = RecruitmentStage.ScreeningInProgress,
        AdvertisementRound = 1,
        CreatedAt = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
    };

    private static Candidate SampleCandidate(
        Guid recruitmentRequestId, ScreeningResult? screening, CandidateOutcome outcome) => new()
    {
        Id = Guid.NewGuid(),
        RecruitmentRequestId = recruitmentRequestId,
        ApplicationUserId = Guid.NewGuid(),
        FullName = "Applicant",
        Mobile = "9000000000",
        ScreeningResult = screening,
        Outcome = outcome,
        AppliedAt = DateTimeOffset.UtcNow,
        // ApplicationStatus defaults to Draft; every existing test here means a
        // real, submitted applicant, so it is set explicitly rather than relying
        // on the entity default.
        ApplicationStatus = ApplicationStatus.Submitted,
    };

    [Fact]
    public async Task GetRecruitmentFunnelAsync_Faculty_SeesOnlyTheirOwnRecruitments()
    {
        var (service, db) = CreateService();
        var mine = SampleProject(CsePiId, CseDeptId, "Mine");
        var notMine = SampleProject(AnotherCsePiId, CseDeptId, "Not mine");
        db.Projects.AddRange(mine, notMine);
        var mineRequest = SampleRecruitment(mine.Id);
        var notMineRequest = SampleRecruitment(notMine.Id);
        db.RecruitmentRequests.AddRange(mineRequest, notMineRequest);
        await db.SaveChangesAsync();

        var rows = await service.GetRecruitmentFunnelAsync(CsePiId, ["Faculty"]);

        rows.Should().ContainSingle(r => r.ProjectId == mine.Id);
    }

    [Fact]
    public async Task GetRecruitmentFunnelAsync_Hod_SeesTheirWholeDepartment_NotOtherDepartments()
    {
        var (service, db) = CreateService();
        var cse = SampleProject(CsePiId, CseDeptId, "CSE");
        var eed = SampleProject(EedPiId, EedDeptId, "EED");
        db.Projects.AddRange(cse, eed);
        db.RecruitmentRequests.AddRange(SampleRecruitment(cse.Id), SampleRecruitment(eed.Id));
        await db.SaveChangesAsync();

        var rows = await service.GetRecruitmentFunnelAsync(CseHodId, ["HOD"]);

        rows.Should().ContainSingle(r => r.ProjectId == cse.Id);
    }

    [Fact]
    public async Task GetRecruitmentFunnelAsync_CountsCandidatesByScreeningAndOutcome()
    {
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        var request = SampleRecruitment(project.Id);
        db.RecruitmentRequests.Add(request);
        db.Candidates.AddRange(
            SampleCandidate(request.Id, ScreeningResult.Eligible, CandidateOutcome.Selected),
            SampleCandidate(request.Id, ScreeningResult.Eligible, CandidateOutcome.NotSelected),
            SampleCandidate(request.Id, ScreeningResult.Ineligible, CandidateOutcome.NotSelected),
            SampleCandidate(request.Id, null, CandidateOutcome.Pending));
        await db.SaveChangesAsync();

        var rows = await service.GetRecruitmentFunnelAsync(CsePiId, ["Faculty"]);

        var row = rows.Should().ContainSingle().Subject;
        row.Applied.Should().Be(4);
        row.ScreenedEligible.Should().Be(2);
        row.ScreenedIneligible.Should().Be(1);
        row.Selected.Should().Be(1);
        row.NotSelected.Should().Be(2);
        row.Pending.Should().Be(1);
    }

    [Fact]
    public async Task GetRecruitmentFunnelAsync_ExcludesDraftCandidates_FromAppliedAndPendingCounts()
    {
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        var request = SampleRecruitment(project.Id);
        db.RecruitmentRequests.Add(request);

        var submitted = SampleCandidate(request.Id, null, CandidateOutcome.Pending);
        var draft = SampleCandidate(request.Id, null, CandidateOutcome.Pending);
        draft.ApplicationStatus = ApplicationStatus.Draft;
        db.Candidates.AddRange(submitted, draft);
        await db.SaveChangesAsync();

        var rows = await service.GetRecruitmentFunnelAsync(CsePiId, ["Faculty"]);

        // A Draft is an unsubmitted application-wizard row, not a real
        // candidate -- it must not inflate the institutional Applied/Pending
        // counts, or this report will disagree with the PI-facing candidate
        // table and count badge for the same recruitment.
        var row = rows.Should().ContainSingle().Subject;
        row.Applied.Should().Be(1);
        row.Pending.Should().Be(1);
    }

    [Fact]
    public async Task GetRecruitmentFunnelAsync_DateRange_FiltersByRecruitmentCreatedAt()
    {
        var (service, db) = CreateService();
        var project = SampleProject(CsePiId, CseDeptId, "Mine");
        db.Projects.Add(project);
        var early = SampleRecruitment(project.Id);
        early.CreatedAt = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var inRange = SampleRecruitment(project.Id);
        inRange.CreatedAt = new DateTimeOffset(2025, 6, 15, 0, 0, 0, TimeSpan.Zero);
        db.RecruitmentRequests.AddRange(early, inRange);
        await db.SaveChangesAsync();

        var rows = await service.GetRecruitmentFunnelAsync(
            CsePiId, ["Faculty"], from: new DateOnly(2025, 1, 1), to: new DateOnly(2025, 12, 31));

        rows.Should().HaveCount(1, "the 2024 recruitment falls outside the requested range");
    }
}
