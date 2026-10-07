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
/// The RecruitmentController's own behaviour, as distinct from the service it
/// delegates to: the Dean-facing all-recruitments list (built by an inline EF
/// projection, not by RecruitmentService.ToSummariesAsync), and the
/// advertise/readvertise actions' two-id authorization -- the substituted PI id
/// for the recruitment, the caller's real identity for the chosen advertisement
/// template.
/// </summary>
public class RecruitmentControllerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly Published = new(2024, 7, 1);
    private static readonly DateOnly Closing = new(2024, 7, 21);

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

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-CTRL1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Recruitment Controller Project",
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
        db.SaveChanges();
        AdvertisementWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

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

    private static async Task<Guid> AdvertisedRequestAsync(Fixture f)
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        await AdvertisementApprovalHarness.ApproveThroughChainAsync(f.Service, id);
        return id;
    }

    /// <summary>
    /// A freshly created recruitment with no advertisement submitted yet --
    /// AdvertiseAsync's own re-forward guard treats a null
    /// AdvertisementWorkflowInstanceId as always eligible to advertise, so this
    /// is the fixture the template-ownership tests below use to call Advertise
    /// without tripping the in-review/terminal-stage guard added for final
    /// whole-branch review finding 2 -- those tests are about template
    /// authorization, not workflow stage, and must not need to know about it.
    /// </summary>
    private static async Task<Guid> UnadvertisedRequestAsync(Fixture f) =>
        await f.Service.CreateAsync(new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);

    private static Guid AddPrivateTemplate(Fixture f, Guid ownerId, string content)
    {
        var id = Guid.NewGuid();
        f.Db.AdvertisementTemplates.Add(new AdvertisementTemplate
        {
            Id = id,
            OwnerUserId = ownerId,
            Name = "Private Template",
            IsSystemDefault = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Sections =
            [
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = id,
                    Key = AdvertisementSectionKey.Notes,
                    Content = content,
                    IsIncluded = true,
                    SortOrder = 1,
                },
            ],
        });
        f.Db.SaveChanges();
        return id;
    }

    // ------------------------------------------------ Dean-facing list count

    /// <summary>
    /// Final-review finding 2: ListAllForDean builds CandidateCount with its own
    /// inline EF projection rather than through ToSummariesAsync, so it needed
    /// the Submitted-only filter added independently of its two siblings.
    /// </summary>
    [Fact]
    public async Task ListAllForDean_CandidateCount_ExcludesDraftApplications()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), "Dean");
        var requestId = await AdvertisedRequestAsync(f);

        foreach (var status in new[] { ApplicationStatus.Submitted, ApplicationStatus.Draft })
        {
            f.Db.Candidates.Add(new Candidate
            {
                Id = Guid.NewGuid(),
                RecruitmentRequestId = requestId,
                ApplicationUserId = Guid.NewGuid(),
                FullName = $"{status} Applicant",
                Mobile = "9990001111",
                Outcome = CandidateOutcome.Pending,
                AppliedAt = DateTimeOffset.UtcNow,
                ApplicationStatus = status,
            });
        }
        await f.Db.SaveChangesAsync();

        var result = await f.Controller.ListAllForDean(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IReadOnlyList<RecruitmentSummary>>().Subject;

        body.Should().ContainSingle().Which.CandidateCount.Should().Be(
            1, "an unsubmitted wizard draft is not a real candidate");
    }

    // ------------------------------------------ template ownership on advertise

    /// <summary>
    /// Final-review finding 1: GetPiUserIdAsync substitutes the project owner's
    /// id for the caller's own, and that substituted id used to be what
    /// authorized the chosen advertisement template too -- which made
    /// ResolveAsync's "OwnerUserId != piUserId" guard match by construction.
    /// recruitment.detail is Institute-scoped, so a plain Faculty account can
    /// reach another PI's recruitment id and would otherwise have read that PI's
    /// private template wording straight out of the generated Advertisement.Text.
    /// </summary>
    [Fact]
    public async Task Advertise_ByANonDeanCaller_WithAnotherPisPrivateTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var requestId = await UnadvertisedRequestAsync(f);
        var templateId = AddPrivateTemplate(f, f.PiUserId, "The PI's confidential wording");

        // A Faculty user with no Dean/Office role, acting on a recruitment whose
        // project belongs to somebody else.
        SetUser(f.Controller, Guid.NewGuid(), "Faculty");

        var act = () => f.Controller.Advertise(
            requestId,
            new AdvertiseRequestBody(Published, Closing, "free text", "Submitted for RnC office approval", templateId, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();

        // TemplateNotOwnedException fires before any content is written, so
        // (using a not-yet-advertised request) no Advertisement row exists at
        // all -- the strongest possible form of "nothing of the template may
        // leak into the advertisement".
        (await f.Db.Advertisements.AnyAsync(a => a.RecruitmentRequestId == requestId)).Should().BeFalse();
    }

    [Fact]
    public async Task Readvertise_ByANonDeanCaller_WithAnotherPisPrivateTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var requestId = await AdvertisedRequestAsync(f);
        var templateId = AddPrivateTemplate(f, f.PiUserId, "The PI's confidential wording");

        SetUser(f.Controller, Guid.NewGuid(), "Faculty");

        var act = () => f.Controller.Readvertise(
            requestId,
            new ReadvertiseRequestBody(0, Published, Closing, "free text", templateId, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    /// <summary>
    /// Regression for the same finding: the impersonation shim's legitimate use
    /// -- a Dean acting on a PI's behalf with that PI's OWN template -- must keep
    /// working. Only the cross-PI leak is closed, not the shim itself.
    /// </summary>
    [Fact]
    public async Task Advertise_ByADean_WithTheImpersonatedPisOwnTemplate_StillSucceeds()
    {
        var f = Create();
        var requestId = await UnadvertisedRequestAsync(f);
        var templateId = AddPrivateTemplate(f, f.PiUserId, "The PI's own approved wording");

        SetUser(f.Controller, Guid.NewGuid(), "Dean");

        var result = await f.Controller.Advertise(
            requestId,
            new AdvertiseRequestBody(Published, Closing, "free text", "Submitted for RnC office approval", templateId, null),
            CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == requestId);
        ad.Text.Should().Contain("The PI's own approved wording");
    }

    /// <summary>
    /// And the ordinary case: the PI advertising their own recruitment with
    /// their own template, where the "substituted" id happens to equal the real
    /// caller's id anyway.
    /// </summary>
    [Fact]
    public async Task Advertise_ByThePiThemselves_WithTheirOwnTemplate_StillSucceeds()
    {
        var f = Create();
        var requestId = await UnadvertisedRequestAsync(f);
        var templateId = AddPrivateTemplate(f, f.PiUserId, "My own wording");

        SetUser(f.Controller, f.PiUserId, "Faculty");

        var result = await f.Controller.Advertise(
            requestId,
            new AdvertiseRequestBody(Published, Closing, "free text", "Submitted for RnC office approval", templateId, null),
            CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();

        var ad = await f.Db.Advertisements.FirstAsync(a => a.RecruitmentRequestId == requestId);
        ad.Text.Should().Contain("My own wording");
    }

    /// <summary>
    /// The committee-member picker's real data source: every entry's
    /// ApplicationUserId must be a genuine ApplicationUser.Id, never the
    /// legacy FacultyProfiles.UserId string that broke committee submission
    /// (see CommitteeForm.jsx and FacultyDirectoryEntry's own remarks).
    /// </summary>
    [Fact]
    public async Task ListFacultyDirectory_ReturnsRealAccountIdsWithDepartmentNames()
    {
        var f = Create();

        var departmentId = Guid.NewGuid();
        f.Db.Departments.Add(new Department { Id = departmentId, Code = "CSED", Name = "Computer Science & Engineering" });
        await f.Db.SaveChangesAsync();

        var (userManager, _, _) = ApplicantAccountTestHarness.Create();

        var facultyUser = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "csfaculty1",
            Email = "csfaculty1@mnnit.ac.in",
            EmailConfirmed = true,
            FullName = "Dr. CS Faculty",
            DepartmentId = departmentId,
            IsActive = true,
        };
        (await userManager.CreateAsync(facultyUser, "Password@123")).Succeeded.Should().BeTrue();
        (await userManager.AddToRoleAsync(facultyUser, "Faculty")).Succeeded.Should().BeTrue();

        var controller = new RecruitmentController(f.Service, f.Db, userManager, new StubWebHostEnvironment());
        SetUser(controller, f.PiUserId, "Faculty");

        var result = await controller.ListFacultyDirectory(null, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var entries = ok.Value.Should().BeAssignableTo<IReadOnlyList<FacultyDirectoryEntry>>().Subject;
        var entry = entries.Should().ContainSingle(e => e.Id == facultyUser.Id).Subject;
        entry.FullName.Should().Be("Dr. CS Faculty");
        entry.Department.Should().Be("Computer Science & Engineering");
    }
}
