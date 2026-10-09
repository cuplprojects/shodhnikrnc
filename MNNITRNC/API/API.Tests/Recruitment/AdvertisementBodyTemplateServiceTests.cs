using API.Application.Recruitment;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

public class AdvertisementBodyTemplateServiceTests
{
    private static (TestDbContext Db, AdvertisementBodyTemplateService Service) Create()
    {
        var db = new TestDbContext(
            new DbContextOptionsBuilder<TestDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        return (db, new AdvertisementBodyTemplateService(db));
    }

    [Fact]
    public async Task CreateAsync_ThenListForUserAsync_ReturnsTheSavedTemplate()
    {
        var (_, service) = Create();
        var userId = Guid.NewGuid();

        await service.CreateAsync(userId, "JRF Ad - Standard", "<p>Applications are invited...</p>");

        var result = await service.ListForUserAsync(userId);

        result.Should().ContainSingle();
        result[0].Name.Should().Be("JRF Ad - Standard");
        result[0].HtmlBody.Should().Be("<p>Applications are invited...</p>");
    }

    [Fact]
    public async Task ListForUserAsync_OnlyReturnsTheCallersOwnTemplates()
    {
        var (_, service) = Create();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        await service.CreateAsync(ownerId, "Owner's template", "<p>Owner content</p>");
        await service.CreateAsync(otherUserId, "Someone else's template", "<p>Other content</p>");

        var result = await service.ListForUserAsync(ownerId);

        result.Should().ContainSingle();
        result[0].Name.Should().Be("Owner's template");
    }

    [Fact]
    public async Task ListForUserAsync_OrdersNewestFirst()
    {
        var (_, service) = Create();
        var userId = Guid.NewGuid();

        await service.CreateAsync(userId, "First", "<p>1</p>");
        await service.CreateAsync(userId, "Second", "<p>2</p>");

        var result = await service.ListForUserAsync(userId);

        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Second");
        result[1].Name.Should().Be("First");
    }

    [Fact]
    public async Task DeleteAsync_ByOwner_RemovesTheTemplate()
    {
        var (_, service) = Create();
        var userId = Guid.NewGuid();
        var id = await service.CreateAsync(userId, "To delete", "<p>Body</p>");

        await service.DeleteAsync(id, userId);

        var result = await service.ListForUserAsync(userId);
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteAsync_ByNonOwner_ThrowsAndLeavesTheTemplateIntact()
    {
        var (_, service) = Create();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var id = await service.CreateAsync(ownerId, "Owner's template", "<p>Body</p>");

        var act = () => service.DeleteAsync(id, otherUserId);

        await act.Should().ThrowAsync<AdvertisementBodyTemplateNotOwnedException>();
        (await service.ListForUserAsync(ownerId)).Should().ContainSingle();
    }

    [Fact]
    public async Task DeleteAsync_UnknownId_ThrowsNotFound()
    {
        var (_, service) = Create();

        var act = () => service.DeleteAsync(Guid.NewGuid(), Guid.NewGuid());

        await act.Should().ThrowAsync<AdvertisementBodyTemplateNotFoundException>();
    }
}
