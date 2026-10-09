using System.Security.Claims;
using API.Application.Common;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Contracts.Recruitment;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// Covers the REST surface added on top of Task 2's IAdvertisementTemplateService --
/// including that Resolve, unlike the bare service method it calls, verifies the
/// caller owns the recruitment's PROJECT before ever reaching ResolveAsync (see
/// AdvertisementTemplatesController.EnsureOwnsRecruitmentProjectAsync). The
/// service method alone only checks template ownership, which was judged
/// acceptable in Task 2's review only because no controller could reach it yet.
/// </summary>
public class AdvertisementTemplatesControllerTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestDbContext Db, AdvertisementTemplatesController Controller, Guid PiUserId, Guid RequestId);

    private static Fixture Create()
    {
        var db = new TestDbContext(
            new DbContextOptionsBuilder<TestDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var piUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-R1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Recruitment Test Project",
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
            Positions = 2,
            Stipend = 31_000m,
            Hra = 0m,
        });
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = requestId,
            ProjectId = projectId,
            SanctionedManpowerPositionId = positionId,
            Stage = RecruitmentStage.Draft,
            AdvertisementRound = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var service = new AdvertisementTemplateService(db, new StubFacultyProfileProvider());
        var controller = new AdvertisementTemplatesController(service, db);
        return new Fixture(db, controller, piUserId, requestId);
    }

    private static void SetUser(AdvertisementTemplatesController controller, Guid? userId)
    {
        var httpContext = new DefaultHttpContext();
        if (userId is not null)
        {
            var claims = new List<Claim> { new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.Value.ToString()) };
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        }
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    private static Guid AddOwnedTemplate(Fixture f, Guid ownerId, string name)
    {
        var id = Guid.NewGuid();
        f.Db.AdvertisementTemplates.Add(new AdvertisementTemplate
        {
            Id = id,
            OwnerUserId = ownerId,
            Name = name,
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
                    Content = "Some notes",
                    IsIncluded = true,
                    SortOrder = 1,
                },
            ],
        });
        f.Db.SaveChanges();
        return id;
    }

    private static async Task<Guid> SeedDefaultAsync(Fixture f)
    {
        await AdvertisementTemplateSeeder.SeedAsync(f.Db);
        return (await f.Db.AdvertisementTemplates.FirstAsync(t => t.IsSystemDefault)).Id;
    }

    // ------------------------------------------------------------------ List

    [Fact]
    public async Task List_ReturnsSystemDefaultAndCallersOwnTemplates_NotOtherUsersTemplates()
    {
        var f = Create();
        SetUser(f.Controller, f.PiUserId);

        var defaultId = await SeedDefaultAsync(f);
        var ownId = AddOwnedTemplate(f, f.PiUserId, "My Template");
        var otherUserId = Guid.NewGuid();
        var otherId = AddOwnedTemplate(f, otherUserId, "Someone Else's Template");

        var result = await f.Controller.List(CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeAssignableTo<IReadOnlyList<AdvertisementTemplateResponse>>().Subject;

        body.Select(t => t.Id).Should().Contain([defaultId, ownId]);
        body.Select(t => t.Id).Should().NotContain(otherId);
    }

    [Fact]
    public async Task List_NoUser_ReturnsUnauthorized()
    {
        var f = Create();
        SetUser(f.Controller, userId: null);

        var result = await f.Controller.List(CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }

    // ------------------------------------------------------------------ Clone

    [Fact]
    public async Task Clone_FromSystemDefault_Returns200WithNewId()
    {
        var f = Create();
        SetUser(f.Controller, f.PiUserId);
        var defaultId = await SeedDefaultAsync(f);

        var result = await f.Controller.Clone(defaultId, new CloneTemplateRequest("My Clone"), CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var newId = ok.Value.Should().BeOfType<Guid>().Subject;
        newId.Should().NotBe(Guid.Empty);

        var stored = await f.Db.AdvertisementTemplates.FirstAsync(t => t.Id == newId);
        stored.OwnerUserId.Should().Be(f.PiUserId);
        stored.IsSystemDefault.Should().BeFalse();
    }

    // ------------------------------------------------------------------ Update

    [Fact]
    public async Task Update_OnAnotherUsersTemplate_Returns403()
    {
        var f = Create();
        var otherUserId = Guid.NewGuid();
        var otherTemplateId = AddOwnedTemplate(f, otherUserId, "Someone Else's Template");

        SetUser(f.Controller, f.PiUserId);

        var body = new UpdateTemplateRequest(
            "New Name",
            [new UpdateTemplateSectionRequest(AdvertisementSectionKey.Notes, "content", true, 1)]);

        var act = async () => await f.Controller.Update(otherTemplateId, body, CancellationToken.None);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    // ------------------------------------------------------------------ Resolve

    [Fact]
    public async Task Resolve_ReturnsSubstitutedSectionsForARealRecruitment()
    {
        var f = Create();
        SetUser(f.Controller, f.PiUserId);
        var defaultId = await SeedDefaultAsync(f);

        var result = await f.Controller.Resolve(
            defaultId, f.RequestId, new ResolveTemplateRequest(1, new DateOnly(2024, 7, 1)), CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ResolvedTemplateResponse>().Subject;
        body.Sections.Should().NotBeEmpty();
    }

    /// <summary>
    /// Pins the security fix carried forward from Task 2's review:
    /// ResolveAsync alone only checks template ownership, so without the
    /// controller-level project-ownership guard, any authenticated caller
    /// could resolve (and read back) another PI's recruitment/project data
    /// through the shared system-default template. This must be rejected
    /// before ResolveAsync is ever invoked.
    /// </summary>
    [Fact]
    public async Task Resolve_OnAnotherUsersRecruitment_ThrowsProjectAccessDenied()
    {
        var f = Create();
        var intruderUserId = Guid.NewGuid();
        SetUser(f.Controller, intruderUserId);
        var defaultId = await SeedDefaultAsync(f);

        var act = async () => await f.Controller.Resolve(
            defaultId, f.RequestId, new ResolveTemplateRequest(1, new DateOnly(2024, 7, 1)), CancellationToken.None);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task Resolve_OnUnknownRecruitment_ThrowsProjectAccessDenied()
    {
        var f = Create();
        SetUser(f.Controller, f.PiUserId);
        var defaultId = await SeedDefaultAsync(f);

        var act = async () => await f.Controller.Resolve(
            defaultId, Guid.NewGuid(), new ResolveTemplateRequest(1, new DateOnly(2024, 7, 1)), CancellationToken.None);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    /// <summary>
    /// Pins the fix for review finding I-1: EnsureOwnsRecruitmentProjectAsync
    /// must mirror RecruitmentService.LoadOwnedProjectAsync exactly, including
    /// its "!p.IsDeleted" predicate. Without it, the project's own owner could
    /// still resolve advertisement templates against a soft-deleted project,
    /// where every other path in this module would refuse.
    /// </summary>
    [Fact]
    public async Task Resolve_OnSoftDeletedProject_ThrowsProjectAccessDenied()
    {
        var f = Create();
        SetUser(f.Controller, f.PiUserId);
        var defaultId = await SeedDefaultAsync(f);

        var project = await f.Db.Projects.FirstAsync(p => p.OwnerUserId == f.PiUserId);
        project.IsDeleted = true;
        await f.Db.SaveChangesAsync();

        var act = async () => await f.Controller.Resolve(
            defaultId, f.RequestId, new ResolveTemplateRequest(1, new DateOnly(2024, 7, 1)), CancellationToken.None);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }
}
