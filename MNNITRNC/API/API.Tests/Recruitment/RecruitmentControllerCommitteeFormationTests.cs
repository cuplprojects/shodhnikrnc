using System.Security.Claims;
using API.Application.Notifications;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Contracts.Recruitment;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// RecruitmentController's five Screening/Selection Committee formation
/// workflow actions (submit-for-approval/assign for Screening,
/// submit-for-approval/select/return for Selection). Each just needs to
/// reach its corresponding IRecruitmentService method and pass the caller's
/// identity through -- the workflow engine and RecruitmentService's own
/// validation (exercised in RecruitmentServiceTests) are what actually
/// enforce composition rules and stage transitions.
/// </summary>
public class RecruitmentControllerCommitteeFormationTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

    private static readonly string[] RnCOfficeRoles = AdvertisementApprovalHarness.RnCOfficeRoles;
    private static readonly string[] ComputerCentreRoles = AdvertisementApprovalHarness.ComputerCentreRoles;

    private sealed record Fixture(
        TestProcurementDbContext Db,
        RecruitmentController Controller,
        RecruitmentService Service,
        Guid PiUserId,
        Guid ProjectId,
        Guid PositionId);

    private static Fixture Create()
    {
        var db = new TestProcurementDbContext(
            new DbContextOptionsBuilder<TestProcurementDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var piUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-CTRL-CF1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Recruitment Controller Committee Formation Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 31_000m,
            Hra = 0m,
        });
        db.Users.Add(new ApplicationUser { Id = piUserId, UserName = "pi@test.local", FullName = "Prof. PI" });
        var hodUserId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser { Id = hodUserId, UserName = "hod@test.local", FullName = "Prof. HOD" });
        db.Departments.Add(new Department
        {
            Id = departmentId,
            Code = "CSE",
            Name = "Computer Science and Engineering",
            HeadUserId = hodUserId,
        });

        // SubmitScreeningCommitteeForApprovalAsync looks up a Co-PI via a
        // ResearchProposal tied to the same ProjectId (ProposalCoPi), and
        // requires one -- see ValidateScreeningChairAndCoPi.
        var proposalId = Guid.NewGuid();
        db.ResearchProposals.Add(new ResearchProposal
        {
            Id = proposalId,
            OwnerUserId = piUserId,
            DepartmentId = departmentId,
            Title = "Test Proposal",
            Agency = "DST",
            ProjectId = projectId,
            CreatedAt = DateTimeOffset.UtcNow,
            CoPis =
            [
                new ProposalCoPi
                {
                    Id = Guid.NewGuid(),
                    ResearchProposalId = proposalId,
                    Name = "Dr. CoPI",
                    Department = "CSE",
                    Designation = "Assoc. Professor",
                },
            ],
        });
        db.SaveChanges();

        AdvertisementWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        ScreeningCommitteeWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();
        SelectionCommitteeWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var profiles = new StubFacultyProfileProvider();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new StubUserDepartmentProvider();
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new API.Application.Workflow.WorkflowPendingQueryService(db, new API.Application.Workflow.WorkflowDefinitionService(db)));
        var service = new RecruitmentService(
            db, workflow, new FakeApplicantRoleService(),
            new StubRecruitmentDocumentGenerationService(), profiles,
            new StubDocumentStorageService(), new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            new AdvertisementTemplateService(db, profiles),
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var (userManager, _, _) = ApplicantAccountTestHarness.Create();
        var controller = new RecruitmentController(service, db, userManager, new StubWebHostEnvironment());
        return new Fixture(db, controller, service, piUserId, projectId, positionId);
    }

    private static void SetUser(RecruitmentController controller, Guid userId, params string[] roles)
    {
        var claims = new List<Claim>
        {
            new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role)),
            },
        };
    }

    /// <summary>Raises an advertised RecruitmentRequest, approved through the full chain.</summary>
    private static async Task<Guid> AdvertisedRequestAsync(Fixture f)
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);
        return id;
    }

    private static IReadOnlyList<CommitteeMemberInput> ThreeRecommendedMembers() =>
    [
        new(CommitteeRole.InternalNominee, "Dr. Internal One", "CSE", "Assoc. Professor", false),
        new(CommitteeRole.InternalNominee, "Dr. Internal Two", "CSE", "Professor", false),
        new(CommitteeRole.InternalNominee, "Prof. External", "ECE", "Professor", true),
    ];

    private static async Task<WorkflowStage> ScreeningStageAsync(Fixture f, Guid id)
    {
        var request = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);
        var instance = await f.Db.WorkflowInstances.AsNoTracking()
            .FirstAsync(w => w.Id == request.ScreeningCommitteeWorkflowInstanceId!.Value);
        return instance.CurrentStage;
    }

    private static async Task<WorkflowStage> SelectionStageAsync(Fixture f, Guid id)
    {
        var request = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);
        var instance = await f.Db.WorkflowInstances.AsNoTracking()
            .FirstAsync(w => w.Id == request.SelectionCommitteeWorkflowInstanceId!.Value);
        return instance.CurrentStage;
    }

    // ------------------------------------------- Screening: submit-for-approval

    [Fact]
    public async Task SubmitScreeningCommitteeForApproval_ByPi_ReachesTheServiceAndForwardsToDean()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var result = await f.Controller.SubmitScreeningCommitteeForApproval(id, CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await ScreeningStageAsync(f, id)).Should().Be(WorkflowStage.WithDeanScreeningCommittee);
    }

    // ------------------------------------------- Screening: assign

    [Fact]
    public async Task AssignScreeningCommitteeMember_ByDean_ReachesTheServiceAndApproves()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");
        await f.Controller.SubmitScreeningCommitteeForApproval(id, CancellationToken.None);

        var deanUserId = Guid.NewGuid();
        SetUser(f.Controller, deanUserId, "Dean");

        var body = new AssignScreeningCommitteeMemberRequestBody(
            new CommitteeMemberInput(CommitteeRole.NominatedFaculty, "Dr. Nominee", "CSE", "Professor", false));

        var result = await f.Controller.AssignScreeningCommitteeMember(id, body, CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await ScreeningStageAsync(f, id)).Should().Be(WorkflowStage.ScreeningCommitteeApproved);
    }

    // ------------------------------------------- Selection: submit-for-approval

    [Fact]
    public async Task SubmitSelectionCommitteeForApproval_ByPi_ReachesTheServiceAndForwardsToDean()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var body = new SubmitSelectionCommitteeForApprovalRequestBody(null, ThreeRecommendedMembers());

        var result = await f.Controller.SubmitSelectionCommitteeForApproval(id, body, CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await SelectionStageAsync(f, id)).Should().Be(WorkflowStage.WithDeanSelectionCommittee);
    }

    /// <summary>
    /// The service enforces 3-5 recommended members via
    /// InvalidCommitteeCompositionException, mapped by
    /// ProcurementExceptionMiddleware to 400 Bad Request with a "problem"
    /// body (Title: "Invalid committee composition", Detail: ex.Message).
    /// The controller itself does no validation, so this exercises that the
    /// controller lets the exception surface uncaught for the middleware to
    /// catch (the in-process controller test below the middleware layer, so
    /// it observes the thrown exception directly).
    /// </summary>
    [Fact]
    public async Task SubmitSelectionCommitteeForApproval_WithTwoRecommendedMembers_ThrowsInvalidCommitteeComposition()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var twoMembers = new List<CommitteeMemberInput>
        {
            new(CommitteeRole.InternalNominee, "A", "CSE", "Professor", false),
            new(CommitteeRole.InternalNominee, "B", "CSE", "Professor", false),
        };
        var body = new SubmitSelectionCommitteeForApprovalRequestBody(null, twoMembers);

        var act = () => f.Controller.SubmitSelectionCommitteeForApproval(id, body, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidCommitteeCompositionException>();
    }

    // ------------------------------------------- Selection: select

    [Fact]
    public async Task SelectSelectionCommitteeMember_ByDean_ReachesTheServiceAndApproves()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");
        await f.Controller.SubmitSelectionCommitteeForApproval(
            id, new SubmitSelectionCommitteeForApprovalRequestBody(null, ThreeRecommendedMembers()), CancellationToken.None);

        var toSelect = await f.Db.CommitteeMembers.FirstAsync(m =>
            m.RecruitmentRequestId == id && m.Role == CommitteeRole.InternalNominee);

        var deanUserId = Guid.NewGuid();
        SetUser(f.Controller, deanUserId, "Dean");

        var result = await f.Controller.SelectSelectionCommitteeMember(
            id, new SelectSelectionCommitteeMemberRequestBody(toSelect.Id), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await SelectionStageAsync(f, id)).Should().Be(WorkflowStage.SelectionCommitteeApproved);

        var updated = await f.Db.CommitteeMembers.FirstAsync(m => m.Id == toSelect.Id);
        updated.IsSelectedByDean.Should().BeTrue();
    }

    // ------------------------------------------- Selection: return

    [Fact]
    public async Task ReturnSelectionCommittee_ByDean_ReachesTheServiceAndSendsItBackToThePi()
    {
        var f = Create();
        var id = await AdvertisedRequestAsync(f);
        SetUser(f.Controller, f.PiUserId, "Faculty");
        await f.Controller.SubmitSelectionCommitteeForApproval(
            id, new SubmitSelectionCommitteeForApprovalRequestBody(null, ThreeRecommendedMembers()), CancellationToken.None);

        var deanUserId = Guid.NewGuid();
        SetUser(f.Controller, deanUserId, "Dean");

        var result = await f.Controller.ReturnSelectionCommittee(
            id, new ReturnSelectionCommitteeRequestBody("Please add a more senior external nominee."), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await SelectionStageAsync(f, id)).Should().Be(WorkflowStage.ReturnedToPISelectionCommittee);
    }
}
