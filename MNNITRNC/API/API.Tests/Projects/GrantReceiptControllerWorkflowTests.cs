using System.Security.Claims;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Projects;
using API.Application.Workflow;
using API.Contracts.Projects;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

/// <summary>
/// ProjectsController's four grant-receipt approval chain actions
/// (Forward/Approve/Reject/Return), added over IProjectService's Task 3
/// methods. Each just needs to reach its corresponding service method and
/// pass the caller's identity, roles and remarks through -- the workflow
/// engine (exercised in GrantReceiptWorkflowTests) is what actually enforces
/// who may act at each stage.
/// </summary>
public class GrantReceiptControllerWorkflowTests
{
    private static readonly Guid DefaultDepartmentId = Guid.NewGuid();

    private static readonly string[] HodRole = ["HOD"];
    private static readonly string[] RnCRole = ["RegularStaff"];
    private static readonly string[] DeanRole = ["Dean"];
    private static readonly string[] FacultyRole = ["Faculty"];

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        TestProjectsDbContext Db,
        ProjectsController Controller,
        ProjectService Service,
        WorkflowEngineService Workflow,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid HeadId);

    private static async Task<Fixture> CreateAsync()
    {
        var db = new TestProjectsDbContext(
            new DbContextOptionsBuilder<TestProjectsDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        await GrantReceiptWorkflowSeeder.SeedAsync(db);

        var workflow = new WorkflowEngineService(db);
        var service = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(),
            new FakeDepartment(DefaultDepartmentId),
            new InstituteWideScopeResolver(db, new FakeDepartment(DefaultDepartmentId)),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        var ownerUserId = Guid.NewGuid();
        var project = await service.CreateAsync(
            ownerUserId,
            ProjectType.TypeIResearch,
            "SAN-CTRL-GR1",
            new DateOnly(2024, 6, 1),
            "Grant Receipt Controller Workflow Test Project",
            new DateOnly(2024, 6, 1),
            "DST",
            36,
            1_000_000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringFieldCharges, 10_000m, 0m, 0m)],
            [],
            []);
        var head = project.BudgetHeads.Single();

        var budgetSummaryService = new BudgetSummaryService(db, new ProjectYearCalculator());
        var refundService = new RefundService(db, new AuditService(db));

        var identityDb = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var userStore = new UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>(identityDb);
        var userManager = new UserManager<ApplicationUser>(
            userStore, null!, new PasswordHasher<ApplicationUser>(), [], [],
            new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!, null!);

        var controller = new ProjectsController(service, budgetSummaryService, refundService, db, userManager);

        return new Fixture(db, controller, service, workflow, ownerUserId, project.Id, head.Id);
    }

    private static void SetUser(ProjectsController controller, Guid userId, params string[] roles)
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

    private static async Task<Guid> RaisedReceiptAsync(Fixture f, decimal amount = 5_000m)
    {
        var receipt = await f.Service.RecordGrantReceiptAsync(
            f.ProjectId, f.OwnerUserId, f.HeadId, new DateOnly(2024, 6, 15), amount, null, remarks: "Test remark.");
        return receipt.Id;
    }

    private static async Task<WorkflowStage> StageAsync(Fixture f, Guid receiptId)
    {
        var receipt = await f.Db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
        var instance = await f.Workflow.GetAsync(receipt.WorkflowInstanceId!.Value);
        return instance!.CurrentStage;
    }

    // -------------------------------------------------------------- Forward

    [Fact]
    public async Task ForwardGrantReceipt_AtWithHOD_ReachesTheServiceAndAdvancesTheChain()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);
        SetUser(f.Controller, Guid.NewGuid(), HodRole);

        var result = await f.Controller.ForwardGrantReceipt(
            f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, receiptId)).Should().Be(WorkflowStage.AssignedToDAGrantReceipt);
    }

    // -------------------------------------------------------------- Approve

    [Fact]
    public async Task ApproveGrantReceipt_AtWithDean_ReachesTheServiceAndFlipsStatusToApproved()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), HodRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), RnCRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("DA ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), ["Superintendent"]);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("Superintendent ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), ["DeputyRegistrar"]);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("DeputyRegistrar ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), DeanRole);
        var result = await f.Controller.ApproveGrantReceipt(
            f.ProjectId, receiptId, new GrantReceiptActionRequestBody("Dean approves"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        var reloaded = await f.Db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
        reloaded.Status.Should().Be(GrantReceiptStatus.Approved);
        (await StageAsync(f, receiptId)).Should().Be(WorkflowStage.Approved);
    }

    // --------------------------------------------------------------- Reject

    [Fact]
    public async Task RejectGrantReceipt_AtWithRnCOffice_ReachesTheServiceAndConcludesTheChain()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), HodRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), RnCRole);
        var result = await f.Controller.RejectGrantReceipt(
            f.ProjectId, receiptId, new GrantReceiptActionRequestBody("Not valid"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        var reloaded = await f.Db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
        reloaded.Status.Should().Be(GrantReceiptStatus.Rejected);
        (await StageAsync(f, receiptId)).Should().Be(WorkflowStage.Rejected);
    }

    // --------------------------------------------------------------- Return

    [Fact]
    public async Task ReturnGrantReceipt_AtWithRnCOffice_ReachesTheServiceAndSendsItBackToThePi()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), HodRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), RnCRole);
        var result = await f.Controller.ReturnGrantReceipt(
            f.ProjectId, receiptId, new GrantReceiptActionRequestBody("Fix the reference"), CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        (await StageAsync(f, receiptId)).Should().Be(WorkflowStage.ReturnedToPIGrantReceipt);
        var reloaded = await f.Db.GrantReceipts.AsNoTracking().SingleAsync(g => g.Id == receiptId);
        reloaded.Status.Should().Be(GrantReceiptStatus.PendingApproval);
    }

    // ------------------------------------------------- No workflow instance yet

    /// <summary>
    /// A grant receipt row with no WorkflowInstanceId set (e.g. constructed
    /// directly rather than via RecordGrantReceiptAsync) makes the
    /// RequireGrantReceiptWorkflowAsync guard throw
    /// GrantReceiptWorkflowNotStartedException, mapped to 409 by
    /// ProcurementExceptionMiddleware per Task 3. Exercised via Forward; the
    /// same guard runs ahead of all four actions.
    /// </summary>
    [Fact]
    public async Task ForwardGrantReceipt_WithNoWorkflowInstance_ThrowsGrantReceiptWorkflowNotStarted()
    {
        var f = await CreateAsync();
        var receiptId = Guid.NewGuid();
        f.Db.GrantReceipts.Add(new GrantReceipt
        {
            Id = receiptId,
            ProjectId = f.ProjectId,
            BudgetHeadId = f.HeadId,
            ReceivedDate = new DateOnly(2024, 6, 15),
            Amount = 1_000m,
            Type = GrantReceiptType.Head,
            Status = GrantReceiptStatus.PendingApproval,
            WorkflowInstanceId = null,
        });
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, Guid.NewGuid(), HodRole);

        var act = () => f.Controller.ForwardGrantReceipt(
            f.ProjectId, receiptId, new GrantReceiptActionRequestBody(null), CancellationToken.None);

        await act.Should().ThrowAsync<GrantReceiptWorkflowNotStartedException>();
    }

    // ------------------------------------ GrantReceiptResponse now carries Status

    /// <summary>
    /// GrantReceiptResponse previously omitted Status entirely, so a PI's own
    /// receipts list had no way to tell a submitted-but-unapproved receipt
    /// from a confirmed one (Task 5 review finding, addressed here).
    /// </summary>
    [Fact]
    public async Task ListGrantReceipts_IncludesStatusAndWorkflowInstanceId()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, f.OwnerUserId, FacultyRole);
        var result = await f.Controller.ListGrantReceipts(f.ProjectId);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var list = ok.Value.Should().BeAssignableTo<IReadOnlyList<GrantReceiptResponse>>().Subject;
        var response = list.Should().ContainSingle(r => r.Id == receiptId).Subject;
        response.Status.Should().Be(GrantReceiptStatus.PendingApproval);
        response.WorkflowInstanceId.Should().NotBeNull();
    }

    // ------------------------------------------------------- Queue endpoints

    [Fact]
    public async Task ListGrantReceiptsForHod_ReachesTheServiceAndReturnsTheQueue()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        // The HOD created above shares DefaultDepartmentId with the project's
        // owner via FakeDepartment.
        SetUser(f.Controller, Guid.NewGuid(), HodRole);

        var result = await f.Controller.ListGrantReceiptsForHod(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var queue = ok.Value.Should().BeAssignableTo<IReadOnlyList<GrantReceiptQueueItem>>().Subject;
        queue.Should().ContainSingle(q => q.Id == receiptId);
    }

    [Fact]
    public async Task ListGrantReceiptsForRnCOffice_WhenCallerIsNotInstituteWide_ReturnsEmpty()
    {
        // FakeDepartment's single department is never seeded as
        // Department.IsInstituteWide, so InstituteWideScopeResolver refuses --
        // this is the department-scope security check in effect at the
        // controller layer, not just the service layer.
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), HodRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), RnCRole);
        var result = await f.Controller.ListGrantReceiptsForRnCOffice(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var queue = ok.Value.Should().BeAssignableTo<IReadOnlyList<GrantReceiptQueueItem>>().Subject;
        queue.Should().BeEmpty();
    }

    [Fact]
    public async Task ListGrantReceiptsForDean_WhenCallerIsNotInstituteWide_ReturnsEmpty()
    {
        var f = await CreateAsync();
        var receiptId = await RaisedReceiptAsync(f);

        SetUser(f.Controller, Guid.NewGuid(), HodRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("HOD ok"), CancellationToken.None);
        SetUser(f.Controller, Guid.NewGuid(), RnCRole);
        await f.Controller.ForwardGrantReceipt(f.ProjectId, receiptId, new GrantReceiptActionRequestBody("RnC ok"), CancellationToken.None);

        SetUser(f.Controller, Guid.NewGuid(), DeanRole);
        var result = await f.Controller.ListGrantReceiptsForDean(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var queue = ok.Value.Should().BeAssignableTo<IReadOnlyList<GrantReceiptQueueItem>>().Subject;
        queue.Should().BeEmpty();
    }
}
