using System.Security.Claims;
using API.Application.Fellowship;
using API.Application.Projects;
using API.Application.Workflow;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Fellowship;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Controllers;

/// <summary>
/// FellowshipController's two new endpoints: the bulk-action POST (delegating
/// to Task 3's <see cref="IFellowshipService.BulkActOnClaimsAsync"/>) and the
/// ready-to-voucher GET (backing this task's new
/// <see cref="IFellowshipService.ListReadyToVoucherClaimsAsync"/>). Mirrors
/// IndentControllerWorkflowTests' pattern of constructing the controller
/// directly with a real service over an in-memory db and a hand-built
/// ClaimsPrincipal, rather than any WebApplicationFactory/HTTP client --
/// this codebase has no such in-process HTTP test fixture for controllers.
/// </summary>
public class FellowshipControllerBulkActionTests
{
    private static readonly DateOnly Joined = new(2026, 1, 1);
    private static readonly DateOnly ValidTill = new(2026, 12, 31);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        FellowshipController Controller,
        FellowshipService Fellowship,
        Guid FellowUserId,
        Guid AppointmentId);

    private static Fixture Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var piUserId = Guid.NewGuid();
        var fellowUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var recruitmentRequestId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-FC1",
            SanctionDate = Joined,
            ProjectTitle = "Fellowship Controller Test Project",
            StartDate = Joined,
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
            Stipend = 37_000m,
            Hra = 7_400m,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = recruitmentRequestId,
            ProjectId = projectId,
            SanctionedManpowerPositionId = positionId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.Candidates.Add(new Candidate
        {
            Id = candidateId,
            RecruitmentRequestId = recruitmentRequestId,
            ApplicationUserId = fellowUserId,
            FullName = "Test Fellow",
            Mobile = "9999999999",
            AppliedAt = DateTimeOffset.UtcNow,
        });
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            CandidateId = candidateId,
            ApplicationUserId = fellowUserId,
            SanctionedManpowerPositionId = positionId,
            JoinedOn = Joined,
            ValidTill = ValidTill,
            RecommendedStipend = 37_000m,
            IdCardNumber = "MNNIT/JRF/001",
            IdCardIssuedAt = DateTimeOffset.UtcNow,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        FellowshipWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var fellowContext = new FellowContextService(db);
        var workflow = new WorkflowEngineService(db);
        var documents = new StubFellowshipDocumentGenerationService();
        var faculty = new StubFacultyProfileProvider();
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var userDepartment = new StubUserDepartmentProvider();

        var fellowship = new FellowshipService(
            db, fellowContext, workflow, documents, faculty, pendingQuery, userDepartment);

        var controller = new FellowshipController(fellowship, db);

        return new Fixture(db, controller, fellowship, fellowUserId, appointmentId);
    }

    private static void SetUser(FellowshipController controller, Guid? userId, IReadOnlyCollection<string>? roles = null)
    {
        var claims = new List<Claim>();
        if (userId is { } id)
        {
            claims.Add(new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, id.ToString()));
        }
        if (roles is not null)
        {
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role)),
            },
        };
    }

    [Fact]
    public async Task BulkAction_EmptyClaimIds_ReturnsBadRequest()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), ["RegularStaff"]);

        var result = await f.Controller.BulkAction(
            new FellowshipController.BulkActionRequestBody(Array.Empty<Guid>(), "Approve", null),
            CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task BulkAction_UnknownAction_ReturnsBadRequest()
    {
        var f = Create();
        SetUser(f.Controller, Guid.NewGuid(), ["RegularStaff"]);

        var result = await f.Controller.BulkAction(
            new FellowshipController.BulkActionRequestBody([Guid.NewGuid()], "Forward", null),
            CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task BulkAction_NoAuthenticatedUser_ReturnsUnauthorized()
    {
        var f = Create();
        SetUser(f.Controller, null);

        var result = await f.Controller.BulkAction(
            new FellowshipController.BulkActionRequestBody([Guid.NewGuid()], "Approve", null),
            CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task ReadyToVoucher_NoAuthenticatedUser_ReturnsUnauthorized()
    {
        var f = Create();
        SetUser(f.Controller, null);

        var result = await f.Controller.ReadyToVoucher(CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task ReadyToVoucher_ReturnsApprovedUnvoucheredClaims()
    {
        var f = Create();
        var claimId = await f.Fellowship.RaiseClaimAsync(
            new RaiseClaimInput(2026, 3, false, 0, 0, "Remarks for claim.", "21st-20th"),
            f.FellowUserId);
        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == claim.WorkflowInstanceId);
        instance.CurrentStage = WorkflowStage.Approved;
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, Guid.NewGuid(), ["RegularStaff"]);

        var result = await f.Controller.ReadyToVoucher(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var summaries = Assert.IsAssignableFrom<IReadOnlyList<FellowshipClaimSummary>>(ok.Value);
        summaries.Should().ContainSingle(s => s.Id == claimId);
    }

    [Fact]
    public async Task ReadyToVoucher_ExcludesClaimsAlreadyLinkedToAVoucherItem()
    {
        var f = Create();
        var claimId = await f.Fellowship.RaiseClaimAsync(
            new RaiseClaimInput(2026, 4, false, 0, 0, "Remarks for claim.", "21st-20th"),
            f.FellowUserId);
        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == claim.WorkflowInstanceId);
        instance.CurrentStage = WorkflowStage.Approved;
        claim.PaymentVoucherItemId = Guid.NewGuid();
        await f.Db.SaveChangesAsync();

        SetUser(f.Controller, Guid.NewGuid(), ["RegularStaff"]);

        var result = await f.Controller.ReadyToVoucher(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var summaries = Assert.IsAssignableFrom<IReadOnlyList<FellowshipClaimSummary>>(ok.Value);
        summaries.Should().NotContain(s => s.Id == claimId);
    }
}
