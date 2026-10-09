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
/// RecruitmentController's four advertisement-approval chain actions
/// (Forward/Approve/Reject/Return), added in place of the retired flat
/// request/publish-advertisement endpoints. Each just needs to reach its
/// corresponding IRecruitmentService method and pass the caller's identity,
/// roles and remarks through -- the workflow engine (exercised in
/// RecruitmentAdvertisementWorkflowTests) is what actually enforces who may
/// act at each stage.
/// </summary>
public class RecruitmentControllerAdvertisementWorkflowTests
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

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-CTRL-ADV1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Recruitment Controller Advertisement Workflow Test Project",
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

    /// <summary>Raises the advertisement workflow and leaves it with the RnC office.</summary>
    private static async Task<Guid> SubmittedForApprovalAsync(Fixture f)
    {
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        await f.Service.AdvertiseAsync(
            new AdvertiseInput(id, Published, Closing, "JRF wanted", "Submitted for RnC office approval"), f.PiUserId);
        return id;
    }

    private static async Task<WorkflowStage> StageAsync(Fixture f, Guid id)
    {
        var request = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);
        var instance = await f.Db.WorkflowInstances.AsNoTracking()
            .FirstAsync(w => w.Id == request.AdvertisementWorkflowInstanceId!.Value);
        return instance.CurrentStage;
    }

    // -------------------------------------------------------------- Approve

    [Fact]
    public async Task ApproveAdvertisement_AtRnCOffice_ReachesTheServiceAndAdvancesTheChain()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        var actorId = Guid.NewGuid();
        SetUser(f.Controller, actorId, RnCOfficeRoles);

        var result = await f.Controller.ApproveAdvertisement(
            id, new RemarksRequestBody("looks fine"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithComputerCentre);
    }

    [Fact]
    public async Task ApproveAdvertisement_AtComputerCentre_MakesTheAdLive()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), RnCOfficeRoles);
        await f.Controller.ApproveAdvertisement(id, new RemarksRequestBody(null), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), ComputerCentreRoles);
        var result = await f.Controller.ApproveAdvertisement(
            id, new RemarksRequestBody("published"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        var request = await f.Db.RecruitmentRequests.AsNoTracking().FirstAsync(r => r.Id == id);
        request.Stage.Should().Be(RecruitmentStage.Advertised);
    }

    // -------------------------------------------------------------- Forward

    [Fact]
    public async Task ForwardAdvertisement_FromReturnedToPi_ReachesTheServiceAndReEntersAtTheRnCOffice()
    {
        // WithPIAdvertisement and ReturnedToPIAdvertisement both carry no
        // AllowedRoles (PI-only, enforced by ownership rather than a role
        // name) -- return it once first so there is a forward-capable stage
        // to act on, then forward it back. The route's ForwardOverrideSequence
        // re-enters at the RnC office (sequence 2), not back at sequence 1.
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), RnCOfficeRoles);
        await f.Controller.ReturnAdvertisement(id, new RemarksRequestBody("please fix wording"), CancellationToken.None);
        (await StageAsync(f, id)).Should().Be(WorkflowStage.ReturnedToPIAdvertisement);

        SetUser(f.Controller, f.PiUserId, "Faculty");
        var result = await f.Controller.ForwardAdvertisement(
            id, new RemarksRequestBody("fixed"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);
    }

    // --------------------------------------------------------------- Reject

    [Fact]
    public async Task RejectAdvertisement_AtRnCOffice_ReachesTheServiceAndConcludesTheChain()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        SetUser(f.Controller, Guid.NewGuid(), RnCOfficeRoles);

        var result = await f.Controller.RejectAdvertisement(
            id, new RemarksRequestBody("not acceptable"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, id)).Should().Be(WorkflowStage.Rejected);
    }

    // --------------------------------------------------------------- Return

    [Fact]
    public async Task ReturnAdvertisement_AtRnCOffice_ReachesTheServiceAndSendsItBackToThePi()
    {
        var f = Create();
        var id = await SubmittedForApprovalAsync(f);
        SetUser(f.Controller, Guid.NewGuid(), RnCOfficeRoles);

        var result = await f.Controller.ReturnAdvertisement(
            id, new RemarksRequestBody("please clarify"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, id)).Should().Be(WorkflowStage.ReturnedToPIAdvertisement);
    }

    // ------------------------------------------------- Advertisement token values

    [Fact]
    public async Task GetAdvertisementTokenValues_ReturnsTheServiceResult()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var result = await f.Controller.GetAdvertisementTokenValues(id, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var values = ok.Value.Should().BeAssignableTo<IReadOnlyDictionary<string, string>>().Subject;
        values.Should().ContainKey("ProjectTitle");
    }

    // ------------------------------------------------- Advertisement draft

    [Fact]
    public async Task SaveAdvertisementDraft_ThenGet_ReturnsTheSavedDraft()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var saveResult = await f.Controller.SaveAdvertisementDraft(
            id, new SaveAdvertisementDraftRequestBody("<p>Draft body</p>", new DateOnly(2024, 9, 1)), CancellationToken.None);
        saveResult.Should().BeOfType<NoContentResult>();

        var getResult = await f.Controller.Get(id, CancellationToken.None);
        var ok = getResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = ok.Value.Should().BeOfType<RecruitmentSummary>().Subject;
        summary.DraftAdvertisementText.Should().Contain("Draft body");
        summary.DraftClosingDate.Should().Be(new DateOnly(2024, 9, 1));
    }

    [Fact]
    public async Task PreviewAdvertisement_ReturnsHtmlContentType()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var result = await f.Controller.PreviewAdvertisement(
            id, new SaveAdvertisementDraftRequestBody("<p>Preview me</p>", null), CancellationToken.None);

        var content = result.Result.Should().BeOfType<ContentResult>().Subject;
        content.ContentType.Should().Be("text/html");
        content.Content.Should().Contain("Preview me");
    }

    // ------------------------------------------------- Advertisement image upload

    [Fact]
    public async Task UploadAdvertisementImage_WithValidPngBytes_ReturnsUrlUnderUploadsPath()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 };
        var stream = new MemoryStream(pngBytes);
        var formFile = new FormFile(stream, 0, pngBytes.Length, "file", "photo.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png",
        };

        var result = await f.Controller.UploadAdvertisementImage(id, formFile, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<AdvertisementImageUploadResponse>().Subject;
        response.Url.Should().StartWith("/uploads/advertisement-images/");
        response.Url.Should().EndWith(".png");
    }

    [Fact]
    public async Task UploadAdvertisementImage_WithNonImageMagicBytes_ReturnsBadRequest()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var notAnImage = System.Text.Encoding.UTF8.GetBytes("this is not an image");
        var stream = new MemoryStream(notAnImage);
        var formFile = new FormFile(stream, 0, notAnImage.Length, "file", "fake.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png",
        };

        var result = await f.Controller.UploadAdvertisementImage(id, formFile, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ------------------------------------------------- No workflow instance yet

    /// <summary>
    /// A recruitment created but never advertised has no
    /// AdvertisementWorkflowInstanceId -- RequireAdvertisementWorkflowAsync
    /// throws AdvertisementWorkflowNotStartedException, mapped to 409 by
    /// ProcurementExceptionMiddleware. Exercised via Approve; the same guard
    /// runs ahead of all four actions.
    /// </summary>
    [Fact]
    public async Task ApproveAdvertisement_WithNoWorkflowInstance_ThrowsAdvertisementWorkflowNotStarted()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, Guid.NewGuid(), RnCOfficeRoles);

        var act = () => f.Controller.ApproveAdvertisement(
            id, new RemarksRequestBody(null), CancellationToken.None);

        await act.Should().ThrowAsync<AdvertisementWorkflowNotStartedException>();
    }

    // ------------------------------------------------- Advertise: mandatory Remarks

    [Fact]
    public async Task Advertise_WithBlankRemarks_Throws()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var body = new AdvertiseRequestBody(Published, Closing, "Advertisement text", "");

        var act = () => f.Controller.Advertise(id, body, CancellationToken.None);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task Advertise_WithRemarks_Succeeds()
    {
        var f = Create();
        var id = await f.Service.CreateAsync(
            new CreateRecruitmentInput(f.ProjectId, f.PositionId), f.PiUserId);
        SetUser(f.Controller, f.PiUserId, "Faculty");

        var body = new AdvertiseRequestBody(Published, Closing, "Advertisement text", "Submitting for RnC review");

        var result = await f.Controller.Advertise(id, body, CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, id)).Should().Be(WorkflowStage.WithRnCOfficeAdvertisement);
    }
}
