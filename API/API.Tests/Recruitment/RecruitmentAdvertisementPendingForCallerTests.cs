using API.Application.Access;
using API.Application.Audit;
using API.Application.Notifications;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// <see cref="IRecruitmentService.ListPendingForCallerAsync"/> -- the
/// dashboard's "pending my action" panel for the advertisement approval
/// chain. Built on <see cref="IWorkflowPendingQueryService"/> (Task 1) plus
/// this service's own institute-wide/ComputerCentre gating, mirroring
/// <see cref="RecruitmentService.ListForRnCOfficeAdvertisementQueueAsync"/>
/// and <see cref="RecruitmentService.ListForComputerCentreQueueAsync"/> --
/// but strictly stage-matched against the caller's own roles rather than a
/// fixed role/no-check split.
/// </summary>
public class RecruitmentAdvertisementPendingForCallerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);
    private static readonly Guid RnCDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed class AlwaysInstituteWide : IInstituteWideScopeResolver
    {
        public Task<bool> IsInstituteWideAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(true);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        Guid PiUserId);

    /// <summary>
    /// Always wires an <see cref="IInstituteWideScopeResolver"/> stub
    /// returning true, per the brief -- this method's own gate only cares
    /// about that boolean plus the ComputerCentre-role exemption, not any
    /// particular department id.
    /// </summary>
    private static async Task<Fixture> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        db.Departments.Add(new Department
        {
            Id = RnCDepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        await db.SaveChangesAsync();

        var piUserId = Guid.NewGuid();

        var roles = new FakeApplicantRoleService();
        var profiles = new StubFacultyProfileProvider();
        var departmentProvider = new FakeDepartment(RnCDepartmentId);
        var workflow = new WorkflowEngineService(db);
        var instituteWideScope = new AlwaysInstituteWide();
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            instituteWideScope,
            new AuditService(db), pendingQuery);
        var service = new RecruitmentService(
            db, workflow, roles,
            new StubRecruitmentDocumentGenerationService(), profiles,
            new StubDocumentStorageService(), new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            new AdvertisementTemplateService(db, profiles),
            instituteWideScope,
            projectService,
            pendingQuery);

        await AdvertisementWorkflowSeeder.SeedAsync(db);

        return new Fixture(db, service, piUserId);
    }

    private static async Task<(Guid ProjectId, Guid PositionId)> SeedProjectAsync(
        Fixture f, string sanctionNo)
    {
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();

        f.Db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = f.PiUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = sanctionNo,
            SanctionDate = ProjectStart,
            ProjectTitle = $"Pending Test Project {sanctionNo}",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        f.Db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 31_000m,
            Hra = 0m,
        });
        await f.Db.SaveChangesAsync();

        return (projectId, positionId);
    }

    private static async Task<Guid> SubmittedForApprovalAsync(Fixture f, string sanctionNo)
    {
        var (projectId, positionId) = await SeedProjectAsync(f, sanctionNo);
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(projectId, positionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        return id;
    }

    [Fact]
    public async Task RnCOfficeAccountSeesOnlyAdvertisementsAtItsOwnStage()
    {
        var f = await CreateAsync();

        var atRnCOffice = await SubmittedForApprovalAsync(f, "SAN-P1");
        var atComputerCentre = await SubmittedForApprovalAsync(f, "SAN-P2");
        await f.Service.ApproveAdvertisementAsync(
            atComputerCentre, Guid.NewGuid(), AdvertisementApprovalHarness.RnCOfficeRoles, "RnC office approved");

        var officeUserId = Guid.NewGuid();
        var result = await f.Service.ListPendingForCallerAsync(officeUserId, ["RegularStaff"]);

        result.Select(r => r.Id).Should().Contain(atRnCOffice);
        result.Select(r => r.Id).Should().NotContain(atComputerCentre);
    }

    [Fact]
    public async Task ComputerCentreAccountSeesOnlyAdvertisementsAtItsOwnStage()
    {
        var f = await CreateAsync();

        var atRnCOffice = await SubmittedForApprovalAsync(f, "SAN-P3");
        var atComputerCentre = await SubmittedForApprovalAsync(f, "SAN-P4");
        await f.Service.ApproveAdvertisementAsync(
            atComputerCentre, Guid.NewGuid(), AdvertisementApprovalHarness.RnCOfficeRoles, "RnC office approved");

        var ccUserId = Guid.NewGuid();
        var result = await f.Service.ListPendingForCallerAsync(ccUserId, ["ComputerCentre"]);

        result.Select(r => r.Id).Should().Contain(atComputerCentre);
        result.Select(r => r.Id).Should().NotContain(atRnCOffice);
    }
}
