using API.Application.Recruitment;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

public class AdvertisementTemplateSeederTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task SeedAsync_RunTwice_ExactlyOneSystemDefaultTemplateExists()
    {
        var db = CreateDb();

        await AdvertisementTemplateSeeder.SeedAsync(db);
        await AdvertisementTemplateSeeder.SeedAsync(db);

        var defaults = await db.AdvertisementTemplates
            .Where(t => t.IsSystemDefault)
            .Include(t => t.Sections)
            .ToListAsync();

        defaults.Should().ContainSingle();
        defaults[0].Sections.Should().HaveCount(8);
        defaults[0].OwnerUserId.Should().BeNull();
    }
}
