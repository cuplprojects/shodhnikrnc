using API.Application.Recruitment;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

public class AdvertisementTemplateServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly AdvertisementDate = new(2024, 7, 1);

    private sealed record Fixture(
        TestDbContext Db,
        AdvertisementTemplateService Service,
        Guid PiUserId,
        Guid ProjectId,
        Guid PositionId,
        Guid RequestId);

    /// <summary>
    /// Mirrors RecruitmentServiceTests.Create's fixture shape (Project +
    /// SanctionedManpowerPosition + PI owner), on TestDbContext because it is
    /// the test context that already declares the AdvertisementTemplate model.
    /// </summary>
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
        return new Fixture(db, service, piUserId, projectId, positionId, requestId);
    }

    private static async Task<Guid> SeedDefaultAsync(Fixture f)
    {
        await AdvertisementTemplateSeeder.SeedAsync(f.Db);
        return (await f.Db.AdvertisementTemplates.FirstAsync(t => t.IsSystemDefault)).Id;
    }

    private static Guid AddOwnedTemplate(Fixture f, Guid ownerId, string name, params string[] contents)
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
                .. contents.Select((c, i) => new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = id,
                    Key = AdvertisementSectionKey.Notes,
                    Content = c,
                    IsIncluded = true,
                    SortOrder = i + 1,
                })
            ],
        });
        f.Db.SaveChanges();
        return id;
    }

    // ------------------------------------------------------------------ List

    [Fact]
    public async Task ListForUserAsync_ReturnsSystemDefaultAndOwnTemplatesOnly()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);
        var mine = AddOwnedTemplate(f, f.PiUserId, "My Template", "Mine");
        AddOwnedTemplate(f, Guid.NewGuid(), "Someone Else's", "Theirs");

        var list = await f.Service.ListForUserAsync(f.PiUserId);

        list.Select(t => t.Id).Should().BeEquivalentTo([defaultId, mine]);
        list[0].Id.Should().Be(defaultId, "the system default lists first");
        list[0].IsOwnedByCaller.Should().BeFalse();
        list[1].IsOwnedByCaller.Should().BeTrue();
    }

    // ----------------------------------------------------------------- Clone

    [Fact]
    public async Task CloneAsync_FromSystemDefault_CreatesAnOwnedCopyWithAllSections()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);

        var cloneId = await f.Service.CloneAsync(defaultId, "My Copy", f.PiUserId);

        var clone = await f.Db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstAsync(t => t.Id == cloneId);
        clone.Should().NotBeNull();
        clone.Id.Should().NotBe(defaultId);
        clone.Name.Should().Be("My Copy");
        clone.IsSystemDefault.Should().BeFalse();
        clone.OwnerUserId.Should().Be(f.PiUserId);
        clone.Sections.Should().HaveCount(8);

        var source = await f.Db.AdvertisementTemplates
            .Include(t => t.Sections)
            .FirstAsync(t => t.Id == defaultId);
        clone.Sections.OrderBy(s => s.SortOrder).Select(s => s.Content)
            .Should().Equal(source.Sections.OrderBy(s => s.SortOrder).Select(s => s.Content));
        clone.Sections.Select(s => s.Id).Should()
            .NotIntersectWith(source.Sections.Select(s => s.Id));
    }

    [Fact]
    public async Task CloneAsync_FromAnotherUsersTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var theirs = AddOwnedTemplate(f, Guid.NewGuid(), "Theirs", "Body");

        var act = () => f.Service.CloneAsync(theirs, "Stolen", f.PiUserId);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    [Fact]
    public async Task CloneAsync_UnknownTemplate_ThrowsNotFound()
    {
        var f = Create();

        var act = () => f.Service.CloneAsync(Guid.NewGuid(), "Copy", f.PiUserId);

        await act.Should().ThrowAsync<AdvertisementTemplateNotFoundException>();
    }

    // ---------------------------------------------------------------- Update

    [Fact]
    public async Task UpdateAsync_OnSystemDefault_ThrowsCannotEditSystemDefault()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);

        var act = () => f.Service.UpdateAsync(defaultId, "Renamed", [], f.PiUserId);

        await act.Should().ThrowAsync<CannotEditSystemDefaultTemplateException>();
    }

    [Fact]
    public async Task UpdateAsync_OnAnotherUsersTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var theirs = AddOwnedTemplate(f, Guid.NewGuid(), "Theirs", "Body");

        var act = () => f.Service.UpdateAsync(theirs, "Renamed", [], f.PiUserId);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    [Fact]
    public async Task UpdateAsync_ReplacesSectionsEntirely()
    {
        var f = Create();
        var mine = AddOwnedTemplate(f, f.PiUserId, "Mine", "Old A", "Old B", "Old C");
        var oldSectionIds = await f.Db.AdvertisementTemplateSections
            .Where(s => s.TemplateId == mine).Select(s => s.Id).ToListAsync();
        oldSectionIds.Should().HaveCount(3);

        await f.Service.UpdateAsync(
            mine,
            "Renamed",
            [
                new AdvertisementTemplateSectionInput(
                    AdvertisementSectionKey.Salary, "New one", true, 1),
                new AdvertisementTemplateSectionInput(
                    AdvertisementSectionKey.AgeLimit, "New two", false, 2),
            ],
            f.PiUserId);

        var updated = await f.Db.AdvertisementTemplates
            .Include(t => t.Sections)
            .AsNoTracking()
            .FirstAsync(t => t.Id == mine);

        updated.Name.Should().Be("Renamed");
        updated.Sections.Should().HaveCount(2);
        updated.Sections.OrderBy(s => s.SortOrder).Select(s => s.Content)
            .Should().Equal("New one", "New two");
        updated.Sections.Select(s => s.Id).Should().NotIntersectWith(oldSectionIds);
        (await f.Db.AdvertisementTemplateSections
            .AnyAsync(s => oldSectionIds.Contains(s.Id))).Should().BeFalse();
    }

    // ---------------------------------------------------------------- Delete

    [Fact]
    public async Task DeleteAsync_OnSystemDefault_ThrowsCannotEditSystemDefault()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);

        var act = () => f.Service.DeleteAsync(defaultId, f.PiUserId);

        await act.Should().ThrowAsync<CannotEditSystemDefaultTemplateException>();
        (await f.Db.AdvertisementTemplates.AnyAsync(t => t.Id == defaultId)).Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_OnAnotherUsersTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var theirs = AddOwnedTemplate(f, Guid.NewGuid(), "Theirs", "Body");

        var act = () => f.Service.DeleteAsync(theirs, f.PiUserId);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    [Fact]
    public async Task DeleteAsync_OnOwnTemplate_RemovesItAndItsSections()
    {
        var f = Create();
        var mine = AddOwnedTemplate(f, f.PiUserId, "Mine", "A", "B");

        await f.Service.DeleteAsync(mine, f.PiUserId);

        (await f.Db.AdvertisementTemplates.AnyAsync(t => t.Id == mine)).Should().BeFalse();
        (await f.Db.AdvertisementTemplateSections.AnyAsync(s => s.TemplateId == mine))
            .Should().BeFalse();
    }

    // --------------------------------------------------------------- Resolve

    [Fact]
    public async Task ResolveAsync_SubstitutesEntityBoundTokensAndReportsNoneUnresolved()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);
        var cloneId = await f.Service.CloneAsync(defaultId, "My Copy", f.PiUserId);

        var resolved = await f.Service.ResolveAsync(
            cloneId, f.RequestId, f.PiUserId, 7, AdvertisementDate);

        resolved.Sections.Should().HaveCount(8);
        resolved.Sections.Select(s => s.SortOrder).Should().BeInAscendingOrder();
        resolved.UnresolvedTokens.Should().BeEmpty();

        var all = string.Join("\n", resolved.Sections.Select(s => s.Content));
        all.Should().NotContain("{{");
        all.Should().Contain("DST", "the {{FundingAgency}} token resolves from Project.Agency");
        all.Should().Contain("Rs. 31000.00 per month", "the salary tokens derive from Stipend");
        all.Should().Contain("Dr. A Sharma", "the {{PiName}} token resolves from the PI profile");
    }

    [Fact]
    public async Task ResolveAsync_LeavesUnknownTokensReportedAsUnresolved()
    {
        var f = Create();
        var mine = AddOwnedTemplate(
            f, f.PiUserId, "Mine",
            "Applications for {{ProjectTitle}} close on {{SomeFreeTextField}}.");

        var resolved = await f.Service.ResolveAsync(
            mine, f.RequestId, f.PiUserId, 3, AdvertisementDate);

        var content = resolved.Sections.Single().Content;
        content.Should().Contain("Recruitment Test Project");
        content.Should().NotContain("{{ProjectTitle}}");
        content.Should().Contain("{{SomeFreeTextField}}");
        resolved.UnresolvedTokens.Should().Equal("SomeFreeTextField");
    }

    [Fact]
    public async Task ResolveAsync_OnAnotherUsersTemplate_ThrowsTemplateNotOwned()
    {
        var f = Create();
        var theirs = AddOwnedTemplate(f, Guid.NewGuid(), "Theirs", "Body");

        var act = () => f.Service.ResolveAsync(
            theirs, f.RequestId, f.PiUserId, 1, AdvertisementDate);

        await act.Should().ThrowAsync<TemplateNotOwnedException>();
    }

    [Fact]
    public async Task ResolveAsync_UnknownRecruitmentRequest_ThrowsRecruitmentRequestNotFound()
    {
        var f = Create();
        var defaultId = await SeedDefaultAsync(f);

        var act = () => f.Service.ResolveAsync(
            defaultId, Guid.NewGuid(), f.PiUserId, 1, AdvertisementDate);

        await act.Should().ThrowAsync<RecruitmentRequestNotFoundException>();
    }

    // ------------------------------------------------------ Token catalogue

    [Fact]
    public void ResolveEntityBoundTokens_CoversEveryDeclaredEntityBoundToken()
    {
        var request = new RecruitmentRequest { Id = Guid.NewGuid() };
        var project = new Project
        {
            Id = Guid.NewGuid(),
            SanctionNo = "SAN-9",
            ProjectTitle = "T",
            Agency = "SERB",
        };
        var position = new SanctionedManpowerPosition
        {
            Id = Guid.NewGuid(),
            Designation = "JRF",
            Positions = 3,
            Stipend = 37_000m,
            Hra = 5_000m,
        };
        var pi = new API.Application.Procurement.FacultyProfileInfo("N", "D", "Dept");

        var values = AdvertisementTokenCatalogue.ResolveEntityBoundTokens(
            request, project, position, pi, 12, AdvertisementDate);

        values.Keys.Should().BeEquivalentTo(AdvertisementTokenCatalogue.EntityBoundTokens);
        values["SalaryJrf"].Should().Be("Rs. 37000.00 per month + Rs. 5000.00 HRA");
        values["SalaryProjectAssociate"].Should().Be(values["SalaryJrf"]);
        values["PositionCount"].Should().Be("3");
        values["AdvertisementNo"].Should().Be("12");
        values["AdvertisementDate"].Should().Be("01/07/2024");
        values["ProjectFileNo"].Should().Be("SAN-9");
    }
}
