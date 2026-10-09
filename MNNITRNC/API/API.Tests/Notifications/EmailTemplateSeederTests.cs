using API.Application.Notifications;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Notifications;

public class EmailTemplateSeederTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task SeedAsync_InsertsOneRowPerCatalogueEntry()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();

        await EmailTemplateSeeder.SeedAsync(db);

        var count = await db.EmailTemplates.CountAsync();
        Assert.Equal(EmailTemplateCatalogue.Templates.Length, count);
    }

    [Fact]
    public async Task SeedAsync_IsIdempotent_DoesNotDuplicateOrOverwrite()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        await EmailTemplateSeeder.SeedAsync(db);

        var edited = await db.EmailTemplates.FirstAsync(t => t.Key == "proposal.approved");
        edited.Subject = "Customized subject";
        edited.IsSystemDefault = false;
        await db.SaveChangesAsync();

        await EmailTemplateSeeder.SeedAsync(db);

        var countAfter = await db.EmailTemplates.CountAsync();
        Assert.Equal(EmailTemplateCatalogue.Templates.Length, countAfter);

        var stillEdited = await db.EmailTemplates.FirstAsync(t => t.Key == "proposal.approved");
        Assert.Equal("Customized subject", stillEdited.Subject);
        Assert.False(stillEdited.IsSystemDefault);
    }
}
