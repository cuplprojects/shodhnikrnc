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
/// The two advertisement-approval discovery queues:
/// <see cref="RecruitmentService.ListForRnCOfficeAdvertisementQueueAsync"/> and
/// <see cref="RecruitmentService.ListForComputerCentreQueueAsync"/>. These let a
/// reviewer find advertisements awaiting their action without already knowing
/// the recruitment id -- the queue is pure discovery, the actual approve/
/// reject/return actions live on RecruitmentDetailPage's chain-actions panel
/// and are exercised by RecruitmentAdvertisementWorkflowTests instead.
/// </summary>
public class RecruitmentAdvertisementQueueTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);
    private static readonly Guid RnCDepartmentId = Guid.NewGuid();
    private static readonly Guid OtherDepartmentId = Guid.NewGuid();

    private static readonly string[] RnCOfficeRoles = AdvertisementApprovalHarness.RnCOfficeRoles;

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentService Service,
        Guid PiUserId);

    /// <summary>
    /// <paramref name="officeDepartmentId"/> is the department
    /// <see cref="ListForRnCOfficeAdvertisementQueueAsync"/> callers in this
    /// fixture's tests resolve to via <see cref="IInstituteWideScopeResolver"/>
    /// -- defaults to the seeded R&amp;C department (so most tests need not
    /// think about it), matching <c>ResearchProposalServiceTests</c>' own
    /// "institute-wide by default" fixture shape.
    /// </summary>
    private static async Task<Fixture> CreateAsync(Guid? officeDepartmentId = null)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        db.Departments.Add(new Department
        {
            Id = RnCDepartmentId, Code = "RNC", Name = "R&C Office", IsInstituteWide = true,
        });
        db.Departments.Add(new Department
        {
            Id = OtherDepartmentId, Code = "CSE", Name = "Computer Science", IsInstituteWide = false,
        });
        await db.SaveChangesAsync();

        var piUserId = Guid.NewGuid();

        var roles = new FakeApplicantRoleService();
        var profiles = new StubFacultyProfileProvider();
        var departmentProvider = new FakeDepartment(officeDepartmentId ?? RnCDepartmentId);
        var workflow = new WorkflowEngineService(db);
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
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
            new InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        await AdvertisementWorkflowSeeder.SeedAsync(db);

        return new Fixture(db, service, piUserId);
    }

    /// <summary>Creates a project + sanctioned position and returns a fresh
    /// recruitment id, ready for <see cref="RecruitmentService.CreateAsync"/>'s
    /// caller to advertise.</summary>
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
            ProjectTitle = $"Queue Test Project {sanctionNo}",
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
    public async Task RnCOfficeQueue_ContainsARecruitmentAtWithRnCOfficeAdvertisement_ButNotTheCcQueue()
    {
        var f = await CreateAsync();
        var id = await SubmittedForApprovalAsync(f, "SAN-Q1");

        var rncQueue = await f.Service.ListForRnCOfficeAdvertisementQueueAsync(Guid.NewGuid());
        var ccQueue = await f.Service.ListForComputerCentreQueueAsync();

        rncQueue.Select(r => r.Id).Should().Contain(id);
        ccQueue.Select(r => r.Id).Should().NotContain(id);
    }

    [Fact]
    public async Task ComputerCentreQueue_ContainsARecruitmentAtWithComputerCentre_ButNotTheRnCQueue()
    {
        var f = await CreateAsync();
        var id = await SubmittedForApprovalAsync(f, "SAN-Q2");

        await f.Service.ApproveAdvertisementAsync(id, Guid.NewGuid(), RnCOfficeRoles, "looks fine");

        var rncQueue = await f.Service.ListForRnCOfficeAdvertisementQueueAsync(Guid.NewGuid());
        var ccQueue = await f.Service.ListForComputerCentreQueueAsync();

        ccQueue.Select(r => r.Id).Should().Contain(id);
        rncQueue.Select(r => r.Id).Should().NotContain(id);
    }

    [Fact]
    public async Task BothQueues_ExcludeARecruitmentThatHasNeverBeenAdvertised()
    {
        var f = await CreateAsync();
        var (projectId, positionId) = await SeedProjectAsync(f, "SAN-Q3");
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(projectId, positionId), f.PiUserId);

        var rncQueue = await f.Service.ListForRnCOfficeAdvertisementQueueAsync(Guid.NewGuid());
        var ccQueue = await f.Service.ListForComputerCentreQueueAsync();

        rncQueue.Select(r => r.Id).Should().NotContain(id);
        ccQueue.Select(r => r.Id).Should().NotContain(id);
    }

    [Fact]
    public async Task BothQueues_ExcludeARecruitmentWhoseAdvertisementIsAlreadyLive()
    {
        var f = await CreateAsync();
        var id = await SubmittedForApprovalAsync(f, "SAN-Q4");

        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);

        var request = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);
        request.Stage.Should().Be(RecruitmentStage.Advertised, "the chain has concluded");

        var rncQueue = await f.Service.ListForRnCOfficeAdvertisementQueueAsync(Guid.NewGuid());
        var ccQueue = await f.Service.ListForComputerCentreQueueAsync();

        rncQueue.Select(r => r.Id).Should().NotContain(id);
        ccQueue.Select(r => r.Id).Should().NotContain(id);
    }

    [Fact]
    public async Task RnCOfficeQueue_ForACallerOutsideTheRnCDepartment_IsEmpty()
    {
        // The reviewer-caught gap: [PageAccess] alone only checks that the
        // caller holds SOME grant for this page key -- the RnC-office
        // advertisement stage's AllowedRoles is the whole Office group
        // (RegularStaff, Superintendent, DeputyRegistrar, Dean), not just R&C
        // staff, so a Dean of, say, Computer Science legitimately clears the
        // controller gate. Without this service-level check, that Dean would
        // see every other department's advertisement-queue rows. Mirrors
        // ResearchProposalServiceTests.ListForRnCOfficeAsync_RequiresTheCallerToBeInAnInstituteWideDepartment.
        var f = await CreateAsync(officeDepartmentId: OtherDepartmentId);
        await SubmittedForApprovalAsync(f, "SAN-Q5");

        var rncQueue = await f.Service.ListForRnCOfficeAdvertisementQueueAsync(Guid.NewGuid());

        rncQueue.Should().BeEmpty();
    }
}
