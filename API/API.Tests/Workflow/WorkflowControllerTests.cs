using System.Security.Claims;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Documents;
using API.Application.Notifications;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Contracts.Workflow;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using API.Tests.Recruitment;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// <c>GET /api/workflow/{instanceId}</c> always returns every
/// <see cref="WorkflowStep"/> (no step is ever hidden), but redacts the
/// <c>Remarks</c> of a step whose actor currently holds an office role
/// (Dean/DeputyRegistrar/Superintendent/RegularStaff) when the viewer is the
/// request's own PI/owner or the HOD of its department -- "internal office
/// communication" they should not see the wording of. A step taken by the PI
/// or the HOD themselves keeps its remarks visible to everyone, restricted
/// viewer or not; only the actor's role decides redaction, never the action
/// taken (an HOD's Forward and an office role's Forward are treated
/// differently). An office-role caller, or anyone the redaction does not
/// specifically narrow (e.g. an HOD of a different department), sees every
/// remark unredacted. Every non-ResearchProposal/Advertisement/GrantReceipt
/// request type is untouched by this redaction.
/// </summary>
public class WorkflowControllerTests
{
    private static readonly Guid PiUserId = Guid.NewGuid();
    private static readonly Guid DepartmentId = Guid.NewGuid();
    private static readonly Guid OtherDepartmentId = Guid.NewGuid();

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(TestDbContext Db, WorkflowController Controller, Mock<UserManager<ApplicationUser>> UserManager);

    private static Fixture Create(Guid? callerDepartmentId)
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestDbContext(options);

        var department = new FakeDepartment(callerDepartmentId);
        var workflowEngine = new WorkflowEngineService(db);
        // GetOwnershipAsync (the only ResearchProposalService member this
        // suite exercises) touches none of ProjectService/instituteWideScope
        // -- these are wired for real, same as ConsumableIndentsControllerTests,
        // rather than hand-stubbing IProjectService's full surface for members
        // that are never called here.
        var instituteWideScope = new InstituteWideScopeResolver(db, department);
        var projectService = new ProjectService(
            db, workflowEngine, new ProjectYearCalculator(), new OverheadSplitValidator(), department,
            instituteWideScope, new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        var proposalService = new ResearchProposalService(
            db, workflowEngine, department, projectService, instituteWideScope,
            new DocumentChecklistService(db), new AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        // GetOwnershipAsync (the only RecruitmentService member this suite
        // exercises, via WorkflowController's finding-3 redaction branch) is a
        // plain read join over RecruitmentRequests/Projects, so the rest of
        // RecruitmentService's dependencies are stubbed the same way
        // RecruitmentAdvertisementWorkflowTests wires them -- none of them are
        // ever called here.
        var recruitmentService = new RecruitmentService(
            db, workflowEngine, new FakeApplicantRoleService(),
            new StubRecruitmentDocumentGenerationService(), new StubFacultyProfileProvider(),
            new StubDocumentStorageService(), new RecordingEmailSender(),
            Microsoft.Extensions.Options.Options.Create(new EmailOptions
            {
                Host = "smtp.test.local",
                FromAddress = "noreply@test.local",
                PortalBaseUrl = "http://localhost:5173",
            }),
            new AdvertisementTemplateService(db, new StubFacultyProfileProvider()),
            instituteWideScope, projectService,
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var userManagerStore = new Mock<IUserStore<ApplicationUser>>();
        var userManager = new Mock<UserManager<ApplicationUser>>(
            userManagerStore.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        var controller = new WorkflowController(
            workflowEngine, proposalService, department, recruitmentService, projectService, userManager.Object);
        return new Fixture(db, controller, userManager);
    }

    private static void SetUser(WorkflowController controller, Guid userId, params string[] roles)
    {
        var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()) };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) };
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    /// <summary>
    /// Registers what WorkflowController.Get's role lookup finds for a given
    /// step actor -- FindByIdAsync returning a user, then GetRolesAsync
    /// returning their roles. An actor id never registered here yields
    /// FindByIdAsync(null), matching an unknown/deleted user: the actor's
    /// remarks are never redacted (GetOfficeRoleActorIdsAsync skips them),
    /// same as holding no office role.
    /// </summary>
    private static void SetActorRoles(Mock<UserManager<ApplicationUser>> userManager, Guid actorId, params string[] roles)
    {
        var user = new ApplicationUser { Id = actorId, FullName = "Test Actor" };
        userManager.Setup(m => m.FindByIdAsync(actorId.ToString())).ReturnsAsync(user);
        userManager.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(roles);
    }

    /// <summary>
    /// Raises a ResearchProposal workflow instance and appends one step by an
    /// office-role actor (Forward) and one by a non-office actor (Return), so
    /// a redacted response is distinguishable from an unredacted one by which
    /// remarks survive -- every step itself is always present now; only
    /// remarks are ever hidden.
    /// </summary>
    private static async Task<(TestDbContext Db, WorkflowController Controller, Mock<UserManager<ApplicationUser>> UserManager, Guid InstanceId)>
        SeededProposalAsync(Guid? callerDepartmentId)
    {
        var (db, controller, userManager) = Create(callerDepartmentId);

        var proposal = new ResearchProposal
        {
            Id = Guid.NewGuid(),
            OwnerUserId = PiUserId,
            DepartmentId = DepartmentId,
            Title = "Test proposal",
            Agency = "DST",
            ProposedAmount = 100_000m,
            OverheadAmount = 10_000m,
            DurationMonths = 12,
            Status = ProposalStatus.UnderApproval,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.ResearchProposal, proposal.Id, WorkflowPhase.Indent, PiUserId);

        // Raise already appended one step (Raise, by the PI). Append one more
        // step by an office-role actor (Forward) and one by a non-office
        // actor (Return) directly, since driving the full 8-stage route just
        // to reach a stage where Forward/Return are legal isn't needed to
        // test the controller's redaction.
        //
        // Mirrors WorkflowEngineService.AppendStep exactly: it adds the new
        // WorkflowStep to *both* instance.Steps (the navigation) and
        // db.WorkflowSteps (the DbSet) -- adding to the navigation alone
        // leaves EF Core InMemory unable to save (DbUpdateConcurrencyException
        // on the parent WorkflowInstance), confirmed by a standalone repro.
        var officeActorId = Guid.NewGuid();
        SetActorRoles(userManager, officeActorId, "Superintendent");
        var forwardStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Forward,
            ActorUserId = officeActorId,
            Remarks = "internal forwarding note",
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
        };
        instance.Steps.Add(forwardStep);
        db.WorkflowSteps.Add(forwardStep);

        var nonOfficeActorId = Guid.NewGuid();
        SetActorRoles(userManager, nonOfficeActorId, "HOD");
        var returnStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Return,
            ActorUserId = nonOfficeActorId,
            Remarks = "please fix and resubmit",
            IsInternal = false,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(2),
        };
        instance.Steps.Add(returnStep);
        db.WorkflowSteps.Add(returnStep);

        await db.SaveChangesAsync();

        return (db, controller, userManager, instance.Id);
    }

    [Fact]
    public async Task Get_Pi_SeesEveryStep_ButOfficeRoleRemarksAreRedacted()
    {
        var (_, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);
        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3); // Raise + Forward + Return, all present
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward && s.Remarks == null);
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Return && s.Remarks == "please fix and resubmit");
    }

    [Fact]
    public async Task Get_HodOfSameDepartment_SeesEveryStep_ButOfficeRoleRemarksAreRedacted()
    {
        var hodUserId = Guid.NewGuid();
        var (_, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);
        SetUser(controller, hodUserId, "HOD");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3);
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward && s.Remarks == null);
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Return && s.Remarks == "please fix and resubmit");
    }

    /// <summary>
    /// The redaction narrows to "the requester and their HOD" -- a HOD of a
    /// *different* department is neither, so nothing is redacted for them:
    /// same full, unredacted list an office-role caller gets.
    /// </summary>
    [Fact]
    public async Task Get_HodOfDifferentDepartment_SeesFullUnredactedList()
    {
        var hodUserId = Guid.NewGuid();
        var (_, controller, _, instanceId) = await SeededProposalAsync(OtherDepartmentId);
        SetUser(controller, hodUserId, "HOD");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3);
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward && s.Remarks == "internal forwarding note");
    }

    [Fact]
    public async Task Get_OfficeRole_SeesEveryStepUnredacted()
    {
        var officeUserId = Guid.NewGuid();
        var (_, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);
        SetUser(controller, officeUserId, "Superintendent");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3);
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward && s.Remarks == "internal forwarding note");
    }

    [Fact]
    public async Task Get_NonResearchProposalRequestType_IsNeverRedacted()
    {
        var (db, controller, userManager) = Create(DepartmentId);
        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        var officeActorId = Guid.NewGuid();
        SetActorRoles(userManager, officeActorId, "Superintendent");
        var forwardStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Forward,
            ActorUserId = officeActorId,
            Remarks = "internal note",
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
        };
        instance.Steps.Add(forwardStep);
        db.WorkflowSteps.Add(forwardStep);
        await db.SaveChangesAsync();

        // Same caller as the PI-owner test above, but this instance is not a
        // ResearchProposal, so RequestType.ResearchProposal gate must not
        // engage at all -- full unredacted list regardless of who's asking.
        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instance.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(2); // Raise + Forward, unredacted
        response.Steps.Should().Contain(s => s.Remarks == "internal note");
    }

    // ------------------------------------------------------- Advertisement (finding 3)

    /// <summary>
    /// Raises an Advertisement workflow instance and appends one step by an
    /// office-role actor (Approve) and one by a non-office actor (Return),
    /// same shape as SeededProposalAsync.
    /// </summary>
    private static async Task<(TestDbContext Db, WorkflowController Controller, Mock<UserManager<ApplicationUser>> UserManager, Guid InstanceId)>
        SeededAdvertisementAsync()
    {
        var (db, controller, userManager) = Create(DepartmentId);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = PiUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-WFCTRL-ADV1",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "Workflow Controller Advertisement Test Project",
            StartDate = new DateOnly(2024, 6, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Projects.Add(project);

        var request = new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            Stage = RecruitmentStage.AdvertisementRequested,
            AdvertisementRound = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.RecruitmentRequests.Add(request);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Advertisement, request.Id, WorkflowPhase.Indent, PiUserId);

        var officeActorId = Guid.NewGuid();
        SetActorRoles(userManager, officeActorId, "RegularStaff");
        var approveStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Approve,
            ActorUserId = officeActorId,
            Remarks = "internal RnC office note",
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
        };
        instance.Steps.Add(approveStep);
        db.WorkflowSteps.Add(approveStep);

        var nonOfficeActorId = Guid.NewGuid();
        SetActorRoles(userManager, nonOfficeActorId, "ComputerCentre");
        var returnStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Return,
            ActorUserId = nonOfficeActorId,
            Remarks = "closing date is too soon",
            IsInternal = false,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(2),
        };
        instance.Steps.Add(returnStep);
        db.WorkflowSteps.Add(returnStep);

        await db.SaveChangesAsync();

        return (db, controller, userManager, instance.Id);
    }

    [Fact]
    public async Task Get_Pi_OnAdvertisementInstance_SeesEveryStep_ButOfficeRoleRemarksAreRedacted()
    {
        var (_, controller, _, instanceId) = await SeededAdvertisementAsync();
        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3); // Raise + Approve + Return, all present
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Return && s.Remarks == "closing date is too soon");
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Approve && s.Remarks == null);
    }

    [Fact]
    public async Task Get_OfficeRole_OnAdvertisementInstance_SeesEveryStepUnredacted()
    {
        var officeUserId = Guid.NewGuid();
        var (_, controller, _, instanceId) = await SeededAdvertisementAsync();
        SetUser(controller, officeUserId, "Superintendent");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(3);
        response.Steps.Should().Contain(s => s.Remarks == "internal RnC office note");
    }

    // ------------------------------------------------------- GrantReceipt (final review finding 2)

    /// <summary>
    /// Raises a GrantReceipt workflow instance and appends one step by an
    /// office-role actor (Forward), one by an HOD actor (Forward), and one by
    /// a non-office actor (Return) -- proving remarks are redacted by the
    /// ACTOR's role, not the action: two Forward steps with the same action
    /// but different actor roles must be treated differently.
    /// </summary>
    private static async Task<(TestDbContext Db, WorkflowController Controller, Mock<UserManager<ApplicationUser>> UserManager, Guid InstanceId)>
        SeededGrantReceiptAsync()
    {
        var (db, controller, userManager) = Create(DepartmentId);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = PiUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-WFCTRL-GR1",
            SanctionDate = new DateOnly(2024, 6, 1),
            ProjectTitle = "Workflow Controller Grant Receipt Test Project",
            StartDate = new DateOnly(2024, 6, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Projects.Add(project);

        var receipt = new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = Guid.NewGuid(),
            ReceivedDate = new DateOnly(2024, 7, 1),
            Amount = 50_000m,
            Type = GrantReceiptType.Head,
            Status = GrantReceiptStatus.PendingApproval,
        };
        db.GrantReceipts.Add(receipt);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.GrantReceipt, receipt.Id, WorkflowPhase.Indent, PiUserId);

        receipt.WorkflowInstanceId = instance.Id;
        await db.SaveChangesAsync();

        var hodActorId = Guid.NewGuid();
        SetActorRoles(userManager, hodActorId, "HOD");
        var hodForwardStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Forward,
            ActorUserId = hodActorId,
            Remarks = "HOD forward note",
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(1),
        };
        instance.Steps.Add(hodForwardStep);
        db.WorkflowSteps.Add(hodForwardStep);

        var officeActorId = Guid.NewGuid();
        SetActorRoles(userManager, officeActorId, "Superintendent");
        var officeForwardStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Forward,
            ActorUserId = officeActorId,
            Remarks = "internal RnC office forward note",
            IsInternal = true,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(2),
        };
        instance.Steps.Add(officeForwardStep);
        db.WorkflowSteps.Add(officeForwardStep);

        var nonOfficeActorId = Guid.NewGuid();
        SetActorRoles(userManager, nonOfficeActorId, "ComputerCentre");
        var returnStep = new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = WorkflowAction.Return,
            ActorUserId = nonOfficeActorId,
            Remarks = "receipt amount does not match challan",
            IsInternal = false,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(3),
        };
        instance.Steps.Add(returnStep);
        db.WorkflowSteps.Add(returnStep);

        await db.SaveChangesAsync();

        return (db, controller, userManager, instance.Id);
    }

    [Fact]
    public async Task Get_Pi_OnGrantReceiptInstance_SeesEveryStep_ButOnlyOfficeRoleRemarksAreRedacted()
    {
        var (_, controller, _, instanceId) = await SeededGrantReceiptAsync();
        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(4); // Raise + HOD Forward + Office Forward + Return, all present
        response.Steps.Should().Contain(s => s.Remarks == "receipt amount does not match challan");
        // The HOD's own remark stays visible -- redaction is keyed on the
        // actor's role, not the Forward action.
        response.Steps.Should().Contain(s => s.Remarks == "HOD forward note");
        response.Steps.Should().Contain(s => s.Action == WorkflowAction.Forward && s.Remarks == null);
        response.Steps.Should().NotContain(s => s.Remarks == "internal RnC office forward note");
    }

    [Fact]
    public async Task Get_OfficeRole_OnGrantReceiptInstance_SeesEveryStepUnredacted()
    {
        var officeUserId = Guid.NewGuid();
        var (_, controller, _, instanceId) = await SeededGrantReceiptAsync();
        SetUser(controller, officeUserId, "Superintendent");

        var result = await controller.Get(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().HaveCount(4);
        response.Steps.Should().Contain(s => s.Remarks == "internal RnC office forward note");
        response.Steps.Should().Contain(s => s.Remarks == "HOD forward note");
    }

    /// <summary>
    /// Task 3: WorkflowController.Get projects the actor's EmployeeId
    /// alongside their name into WorkflowStepResponse.ActorEmployeeId, using
    /// the same FindByIdAsync-per-distinct-actor lookup GetActorNamesAsync
    /// already performs for the name.
    /// </summary>
    [Fact]
    public async Task Get_ReturnsActorEmployeeId_WhenActorHasOneSet()
    {
        var (db, controller, userManager) = Create(DepartmentId);
        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);

        var actorWithEmployeeId = new ApplicationUser { Id = PiUserId, FullName = "Test PI", EmployeeId = "EMP1234" };
        userManager.Setup(m => m.FindByIdAsync(PiUserId.ToString())).ReturnsAsync(actorWithEmployeeId);

        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instance.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().Contain(s => s.ActorUserId == PiUserId && s.ActorEmployeeId == "EMP1234");
    }

    [Fact]
    public async Task Get_ReturnsNullActorEmployeeId_WhenActorHasNoneSet()
    {
        var (db, controller, userManager) = Create(DepartmentId);
        var engine = new WorkflowEngineService(db);
        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);

        var actorWithoutEmployeeId = new ApplicationUser { Id = PiUserId, FullName = "Test PI", EmployeeId = null };
        userManager.Setup(m => m.FindByIdAsync(PiUserId.ToString())).ReturnsAsync(actorWithoutEmployeeId);

        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(instance.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkflowInstanceResponse>(ok.Value);
        response.Steps.Should().Contain(s => s.ActorUserId == PiUserId && s.ActorEmployeeId == null && s.ActorName == "Test PI");
    }

    [Fact]
    public async Task Get_UnknownInstance_ReturnsNotFound()
    {
        var (_, controller, _) = Create(DepartmentId);
        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.Get(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    /// <summary>
    /// Task 4: query/reply endpoints share the exact same always-internal
    /// visibility rule as WorkflowController.Get's WorkflowStep filtering --
    /// a WorkflowQuery never surfaces to the proposal's PI/owner or their
    /// HOD, regardless of who asked or was asked.
    /// </summary>
    [Fact]
    public async Task ListQueries_Pi_SeesNone()
    {
        var (db, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);

        // The forwardStep's ActorUserId is the asked-of target, so AskQueryAsync's
        // own actor check is satisfied.
        var askedOf = db.WorkflowSteps.First(s => s.WorkflowInstanceId == instanceId && s.Action == WorkflowAction.Forward).ActorUserId;
        var engine = new WorkflowEngineService(db);
        await engine.AskQueryAsync(instanceId, PiUserId, askedOf, "What is the status?");

        SetUser(controller, PiUserId, "Faculty");

        var result = await controller.ListQueries(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsAssignableFrom<IReadOnlyList<WorkflowQueryResponse>>(ok.Value);
        response.Should().BeEmpty();
    }

    [Fact]
    public async Task ListQueries_OfficeRole_SeesAllQueries()
    {
        var (db, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);

        var askedOf = db.WorkflowSteps.First(s => s.WorkflowInstanceId == instanceId && s.Action == WorkflowAction.Forward).ActorUserId;
        var engine = new WorkflowEngineService(db);
        var query = await engine.AskQueryAsync(instanceId, PiUserId, askedOf, "What is the status?");

        var officeUserId = Guid.NewGuid();
        SetUser(controller, officeUserId, "Superintendent");

        var result = await controller.ListQueries(instanceId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<List<WorkflowQueryResponse>>(ok.Value);
        response.Should().ContainSingle(q => q.Id == query.Id && q.Question == "What is the status?");
    }

    [Fact]
    public async Task AskQuery_AskerNotAnActor_ReturnsForbid()
    {
        var (_, controller, _, instanceId) = await SeededProposalAsync(DepartmentId);

        // A user who never appears in this instance's Steps (not the PI who
        // raised it, not the forward/return actors seeded above).
        var strangerUserId = Guid.NewGuid();
        SetUser(controller, strangerUserId, "Faculty");

        var result = await controller.AskQuery(instanceId, new AskQueryRequest(PiUserId, "Some question"));

        Assert.IsType<ForbidResult>(result.Result);
    }
}
