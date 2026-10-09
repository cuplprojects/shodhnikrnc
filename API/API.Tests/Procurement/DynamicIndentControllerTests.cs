using System.Reflection;
using API.Application.Access;
using API.Application.Audit;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Contracts.Procurement;
using API.Contracts.Projects;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class DynamicIndentControllerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private sealed record Fixture(
        TestProcurementDbContext Db, ProjectsController Controller, Guid ProjectId, Guid BudgetHeadId, Guid OverheadHeadId);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var overheadHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = Guid.NewGuid(), ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DIC-1", SanctionDate = ProjectStart, ProjectTitle = "Controller Test Project",
            StartDate = ProjectStart, Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId, ProjectId = projectId, HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 100_000m, Total = 100_000m,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = overheadHeadId, ProjectId = projectId, HeadName = BudgetHeadName.RecurringOverhead,
            Year1Amount = 0m, Total = 0m,
        });
        db.SaveChanges();

        var yearCalculator = new ProjectYearCalculator();
        var workflow = new WorkflowEngineService(db);
        var departmentProvider = new FakeDepartment(null);
        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));
        var budgetSummaryService = new BudgetSummaryService(db, yearCalculator);
        var refundService = new RefundService(db, new AuditService(db));

        var identityDb = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var userStore = new UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>(identityDb);
        var userManager = new UserManager<ApplicationUser>(
            userStore, null!, new PasswordHasher<ApplicationUser>(), [], [],
            new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!, null!);

        var controller = new ProjectsController(projectService, budgetSummaryService, refundService, db, userManager);

        return new Fixture(db, controller, projectId, budgetHeadId, overheadHeadId);
    }

    [Fact]
    public async Task GetOverheadSubHeads_ProjectHasRecurringOverheadHead_ReportsPdfAndDdfAvailable()
    {
        var f = Create();

        var result = await f.Controller.GetOverheadSubHeads(f.ProjectId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<OverheadSubHeadAvailabilityResponse>().Subject;
        response.PdfAvailable.Should().BeTrue();
        response.DdfAvailable.Should().BeTrue();
        response.OverheadHeadId.Should().Be(f.OverheadHeadId);
    }

    [Fact]
    public async Task GetOverheadSubHeads_ProjectHasNoOverheadHead_ReportsNeitherAvailable()
    {
        var f = Create();
        f.Db.BudgetHeads.RemoveRange(f.Db.BudgetHeads.Where(b => b.Id == f.OverheadHeadId));
        await f.Db.SaveChangesAsync();

        var result = await f.Controller.GetOverheadSubHeads(f.ProjectId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<OverheadSubHeadAvailabilityResponse>().Subject;
        response.PdfAvailable.Should().BeFalse();
        response.DdfAvailable.Should().BeFalse();
        response.OverheadHeadId.Should().BeNull();
    }

    /// <summary>
    /// Review finding: GetOverheadSubHeads used
    /// [HttpGet("api/projects/{projectId:guid}/overhead-subheads")], a
    /// template that does NOT start with "/". ASP.NET Core's attribute
    /// routing combines a non-absolute action template with the
    /// controller-level [Route("api/projects")] prefix by joining them with
    /// "/", producing the doubled route
    /// "api/projects/api/projects/{projectId:guid}/overhead-subheads" --
    /// not reachable at the brief's documented
    /// "api/projects/{projectId:guid}/overhead-subheads". This bug was
    /// invisible to the existing tests because they call
    /// controller.GetOverheadSubHeads(...) as a plain C# method, bypassing
    /// attribute-route resolution entirely.
    ///
    /// This codebase has no WebApplicationFactory/TestServer fixture
    /// anywhere (confirmed by the same search
    /// AdminUsersControllerAuthorizationTests.cs documents), and building
    /// one just for a single route-template assertion would need a full
    /// DI/hosting setup this test project does not otherwise carry. Instead
    /// this test reproduces ASP.NET Core's actual attribute-route
    /// combination rule directly from the reflected attributes -- the
    /// same rule Microsoft.AspNetCore.Mvc.ApplicationModels.AttributeRouteModel
    /// implements: a template starting with "/" is absolute and used as-is;
    /// otherwise it is joined to the controller-level [Route] prefix with
    /// "/". This is precise enough to catch exactly the doubling bug found
    /// in review, without standing up a host.
    /// </summary>
    [Fact]
    public void GetOverheadSubHeads_BoundRoute_IsNotDoubledWithTheControllerPrefix()
    {
        var controllerType = typeof(ProjectsController);
        var controllerRoute = controllerType.GetCustomAttribute<RouteAttribute>()
            ?? throw new InvalidOperationException("ProjectsController no longer carries a class-level [Route].");

        var method = controllerType.GetMethod(nameof(ProjectsController.GetOverheadSubHeads))
            ?? throw new InvalidOperationException("ProjectsController.GetOverheadSubHeads was not found.");
        var httpGet = method.GetCustomAttribute<HttpGetAttribute>()
            ?? throw new InvalidOperationException("GetOverheadSubHeads no longer carries [HttpGet].");

        var actionTemplate = httpGet.Template
            ?? throw new InvalidOperationException("GetOverheadSubHeads' [HttpGet] carries no template.");

        var boundRoute = CombineRouteTemplates(controllerRoute.Template, actionTemplate);

        // The brief's documented, intended route.
        boundRoute.Should().Be("api/projects/{projectId:guid}/overhead-subheads");

        // Guards specifically against the doubling this review finding
        // reported -- if this ever regresses, the assertion above already
        // fails, but spelling out the doubled form makes the failure mode
        // unmistakable in a diff.
        boundRoute.Should().NotBe("api/projects/api/projects/{projectId:guid}/overhead-subheads");
    }

    /// <summary>
    /// Reproduces ASP.NET Core's own attribute-route combination rule
    /// (see AttributeRouteModel.CombineTemplates / CombineCore): an action
    /// template beginning with "/" is absolute and replaces the prefix
    /// entirely; otherwise the two templates are joined with "/" (trimming
    /// any redundant slashes at the join point).
    /// </summary>
    private static string CombineRouteTemplates(string controllerTemplate, string actionTemplate)
    {
        if (actionTemplate.StartsWith('/'))
        {
            return actionTemplate.TrimStart('/');
        }

        var prefix = controllerTemplate.Trim('/');
        var suffix = actionTemplate.Trim('/');
        return string.IsNullOrEmpty(suffix) ? prefix : $"{prefix}/{suffix}";
    }

    [Fact]
    public async Task RaiseAsync_PdfSelectionWithSpoofedBudgetHeadId_ReturnsBadRequest()
    {
        var f = Create();

        // A different project's BudgetHead -- not the real RecurringOverhead
        // head for f.ProjectId. A malicious/buggy caller pairing SubHead: Pdf
        // with this id would (absent the provenance check) validate and
        // commit against the wrong head's balance entirely.
        var spoofedBudgetHeadId = Guid.NewGuid();

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, Guid.NewGuid());

        var headSelectionsJson = System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new IndentHeadSelectionDto(spoofedBudgetHeadId, OverheadSubHead.Pdf, 500m),
        });

        var request = new RaiseDynamicIndentRequest
        {
            ProjectId = f.ProjectId,
            Purpose = "Test purpose",
            HeadSelectionsJson = headSelectionsJson,
            ItemsJson = "[]",
        };

        var result = await controller.RaiseAsync(request, CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    /// <summary>
    /// Review finding (surfaced during Task 8): HeadSelectionsJson is
    /// deserialized manually via JsonSerializer.Deserialize, which is NOT
    /// visible to the MVC pipeline's AddJsonOptions
    /// (Program.cs) registering JsonStringEnumConverter -- so, before the
    /// fix, this call used System.Text.Json's default options, which
    /// expect an enum as a NUMBER. A real HTTP client (Task 8's frontend
    /// included) sends SubHead as a STRING ("Pdf"/"Ddf"), which threw
    /// JsonException on every single PDF/DDF submission.
    ///
    /// This was invisible to every other test in this file because they
    /// all build the request via JsonSerializer.Serialize(new
    /// IndentHeadSelectionDto(...)) using the SAME default (numeric-enum)
    /// options as the buggy Deserialize call -- so serialize and
    /// deserialize agreed with each other by accident and the mismatch
    /// with what a real client sends was never exercised. This test
    /// instead builds the literal JSON string by hand, with SubHead as the
    /// string "Pdf", exactly as a real client would send it.
    /// </summary>
    [Fact]
    public async Task RaiseAsync_HeadSelectionsJsonWithStringEnumSubHead_DeserializesWithoutThrowing()
    {
        var f = Create();

        var parentReceiptId = Guid.NewGuid();
        f.Db.GrantReceipts.AddRange(
            new GrantReceipt
            {
                Id = parentReceiptId, ProjectId = f.ProjectId, BudgetHeadId = f.OverheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1000m, Type = GrantReceiptType.Head,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            },
            new GrantReceipt
            {
                Id = Guid.NewGuid(), ProjectId = f.ProjectId, BudgetHeadId = f.OverheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1000m, Type = GrantReceiptType.OverheadSplit,
                ParentReceiptId = parentReceiptId, SubHead = OverheadSubHead.Pdf,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            });
        await f.Db.SaveChangesAsync();

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, Guid.NewGuid());

        // Hand-built JSON, matching exactly what a real HTTP client (e.g.
        // Task 8's frontend) sends: SubHead as the string "Pdf", not a
        // numeric enum value.
        var headSelectionsJson =
            $$"""[{"BudgetHeadId":"{{f.OverheadHeadId}}","SubHead":"Pdf","ManualAmount":500}]""";
        var itemsJson = System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new DynamicIndentItemDto("Test Item", true, "Spec", "Nos", 1, 500m),
        });

        var request = new RaiseDynamicIndentRequest
        {
            ProjectId = f.ProjectId,
            Purpose = "Test purpose",
            HeadSelectionsJson = headSelectionsJson,
            ItemsJson = itemsJson,
        };

        // Pre-fix, this threw JsonException before RaiseAsync could return
        // any ActionResult at all -- so merely completing without throwing,
        // and not landing on the provenance-check's BadRequest, proves the
        // string "Pdf" was correctly parsed as OverheadSubHead.Pdf.
        var act = async () => await controller.RaiseAsync(request, CancellationToken.None);

        var result = await act.Should().NotThrowAsync();
        result.Subject.Should().NotBeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RaiseAsync_PdfSelectionWithCorrectBudgetHeadId_Succeeds()
    {
        var f = Create();

        // Fund the RecurringOverhead head's Pdf sub-head: GetSnapshotAsync
        // sums approved-parent OverheadSplit child rows for a given subHead,
        // so a Pdf-funded head needs both an Approved parent (Type: Head)
        // and a child split row (Type: OverheadSplit, SubHead: Pdf).
        var parentReceiptId = Guid.NewGuid();
        f.Db.GrantReceipts.AddRange(
            new GrantReceipt
            {
                Id = parentReceiptId, ProjectId = f.ProjectId, BudgetHeadId = f.OverheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1000m, Type = GrantReceiptType.Head,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            },
            new GrantReceipt
            {
                Id = Guid.NewGuid(), ProjectId = f.ProjectId, BudgetHeadId = f.OverheadHeadId,
                ReceivedDate = ProjectStart, Amount = 1000m, Type = GrantReceiptType.OverheadSplit,
                ParentReceiptId = parentReceiptId, SubHead = OverheadSubHead.Pdf,
                Status = GrantReceiptStatus.Approved, CreatedAt = DateTimeOffset.UtcNow,
            });
        await f.Db.SaveChangesAsync();

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, Guid.NewGuid());

        var headSelectionsJson = System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new IndentHeadSelectionDto(f.OverheadHeadId, OverheadSubHead.Pdf, 500m),
        });
        var itemsJson = System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new DynamicIndentItemDto("Test Item", true, "Spec", "Nos", 1, 500m),
        });

        var request = new RaiseDynamicIndentRequest
        {
            ProjectId = f.ProjectId,
            Purpose = "Test purpose",
            HeadSelectionsJson = headSelectionsJson,
            ItemsJson = itemsJson,
        };

        var result = await controller.RaiseAsync(request, CancellationToken.None);

        result.Should().NotBeOfType<BadRequestObjectResult>();
    }

    /// <summary>
    /// Review finding C1: GetDetailAsync only checked the caller was
    /// authenticated, never that they owned the project or were a Fellow on
    /// it -- so any authenticated user could read another project's indent
    /// detail (including per-head committed amounts) by guessing/enumerating
    /// an indent id. This mirrors ConsumableIndentsController.GetBudget's
    /// existing ownsProject || isFellow gate.
    /// </summary>
    [Fact]
    public async Task GetDetailAsync_CallerNeitherOwnsProjectNorIsFellow_ThrowsProjectAccessDenied()
    {
        var f = Create();
        var indentId = await RaiseSimpleIndentAsync(f);

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, Guid.NewGuid()); // unrelated authenticated user

        var act = async () => await controller.GetDetailAsync(indentId, CancellationToken.None);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task GetDetailAsync_CallerOwnsProject_Succeeds()
    {
        var f = Create();
        var ownerUserId = f.Db.Projects.Single(p => p.Id == f.ProjectId).OwnerUserId;
        var indentId = await RaiseSimpleIndentAsync(f, ownerUserId);

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, ownerUserId);

        var result = await controller.GetDetailAsync(indentId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var detail = ok.Value.Should().BeOfType<IndentDetailModel>().Subject;
        detail.Id.Should().Be(indentId);
    }

    /// <summary>
    /// GetDetailAsync now reuses ProjectService.GetAsync's full visibility
    /// rule instead of a narrower owner-or-Fellow-only check, so an HOD of
    /// the project's own department (a role the previous owner/Fellow-only
    /// gate would have 403'd) can also view an indent's budget breakdown.
    /// </summary>
    [Fact]
    public async Task GetDetailAsync_CallerIsHodOfProjectsDepartment_Succeeds()
    {
        var f = Create();
        var departmentId = Guid.NewGuid();
        var project = f.Db.Projects.Single(p => p.Id == f.ProjectId);
        project.DepartmentId = departmentId;
        await f.Db.SaveChangesAsync();

        var indentId = await RaiseSimpleIndentAsync(f);

        var hodUserId = Guid.NewGuid();
        var yearCalculator = new ProjectYearCalculator();
        var budgetValidator = new IndentBudgetValidator(f.Db, yearCalculator);
        var workflow = new WorkflowEngineService(f.Db);
        var docGenService = new API.Infrastructure.DocumentGeneration.DynamicIndentDocumentGenerationService(new FakeHtmlPdfRenderer(), f.Db);
        var storage = new StubDocumentStorageService();
        var indentService = new DynamicIndentService(f.Db, workflow, storage, budgetValidator);
        var detailQuery = new IndentDetailQueryService(f.Db);
        var departmentProvider = new FakeDepartment(departmentId); // this HOD's own department
        var projectService = new ProjectService(
            f.Db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(f.Db, departmentProvider),
            new AuditService(f.Db), new WorkflowPendingQueryService(f.Db, new WorkflowDefinitionService(f.Db)));
        var controller = new DynamicIndentController(indentService, docGenService, f.Db, storage, detailQuery, projectService);
        SetUser(controller, hodUserId, "HOD");

        var result = await controller.GetDetailAsync(indentId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var detail = ok.Value.Should().BeOfType<IndentDetailModel>().Subject;
        detail.Id.Should().Be(indentId);
    }

    /// <summary>
    /// Same widening as the HOD test above, for the RnC Office roles
    /// (Dean/DeputyRegistrar/Superintendent/RegularStaff/Director/
    /// SuperAdmin) ProjectService.GetAsync grants institute-wide read
    /// access to.
    /// </summary>
    [Fact]
    public async Task GetDetailAsync_CallerIsRnCOfficeRole_Succeeds()
    {
        var f = Create();
        var indentId = await RaiseSimpleIndentAsync(f);

        var controller = CreateDynamicIndentController(f.Db);
        SetUser(controller, Guid.NewGuid(), "Dean");

        var result = await controller.GetDetailAsync(indentId, CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var detail = ok.Value.Should().BeOfType<IndentDetailModel>().Subject;
        detail.Id.Should().Be(indentId);
    }

    private static async Task<Guid> RaiseSimpleIndentAsync(Fixture f, Guid? ownerUserId = null)
    {
        // Create()'s BudgetHead only funds Year1Amount, but "today" (used by
        // RaiseAsync/GetSnapshotAsync as asOfDate) falls in whatever the
        // current project year actually is relative to ProjectStart -- fund
        // every year so this helper works regardless of when the test suite
        // runs.
        var head = await f.Db.BudgetHeads.SingleAsync(b => b.Id == f.BudgetHeadId);
        head.Year1Amount = 100_000m;
        head.Year2Amount = 100_000m;
        head.Year3Amount = 100_000m;
        head.Year4Amount = 100_000m;
        head.Year5Amount = 100_000m;
        await f.Db.SaveChangesAsync();

        var budgetValidator = new IndentBudgetValidator(f.Db, new ProjectYearCalculator());
        var workflow = new WorkflowEngineService(f.Db);
        var storage = new StubDocumentStorageService();
        var indentService = new DynamicIndentService(f.Db, workflow, storage, budgetValidator);

        var input = new RaiseDynamicIndentInput(
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
            Purpose: "Test purpose",
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
            Items: [new DynamicIndentItemInput("Test Item", true, "Spec", "Nos", 1, 1_000m)],
            EstimatePdf: null,
            GemQuotation: null,
            PecCertificate: null,
            MacCertificate: null,
            PacCertificate: null,
            OtherSingleTenderDoc: null,
            NonAvailabilityCertificate: null);

        return await indentService.RaiseAsync(input, ownerUserId ?? Guid.NewGuid());
    }

    private sealed class FakeHtmlPdfRenderer : API.Application.Documents.IHtmlPdfRenderer
    {
        public Task<byte[]> RenderAsync(string html, CancellationToken ct = default) =>
            Task.FromResult(new byte[] { 1, 2, 3 });
    }

    private static DynamicIndentController CreateDynamicIndentController(TestProcurementDbContext db)
    {
        var yearCalculator = new ProjectYearCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var docGenService = new API.Infrastructure.DocumentGeneration.DynamicIndentDocumentGenerationService(new FakeHtmlPdfRenderer(), db);
        var storage = new StubDocumentStorageService();
        var indentService = new DynamicIndentService(db, workflow, storage, budgetValidator);
        var detailQuery = new IndentDetailQueryService(db);
        var departmentProvider = new FakeDepartment(null);
        var projectService = new ProjectService(
            db, workflow, yearCalculator, new OverheadSplitValidator(), departmentProvider,
            new InstituteWideScopeResolver(db, departmentProvider),
            new AuditService(db), new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        return new DynamicIndentController(indentService, docGenService, db, storage, detailQuery, projectService);
    }

    private static void SetUser(DynamicIndentController controller, Guid userId, params string[] roles)
    {
        var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()),
        };
        claims.AddRange(roles.Select(r => new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, r)));
        httpContext.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }
}
