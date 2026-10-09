using API.Controllers;
using API.Domain.Entities;
using API.Tests.Workflow;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;
using NotingsController = API.Controllers.NotingsController;
using CreateNotingDto = API.Controllers.CreateNotingDto;
using CreateNotingItemDto = API.Controllers.CreateNotingItemDto;
using DomainNoting = API.Domain.Entities.Noting;



// Named Notings, not Noting -- a namespace segment matching the entity
// type's own name (API.Domain.Entities.Noting) shadows it for every sibling
// test file in this assembly that writes a bare `Noting` (e.g.
// TestDbContext's `DbSet<Noting>`), since both are visible from the shared
// API.Tests root. Caught as CS0118 ("'Noting' is a namespace but is used
// like a type") the moment this folder was added.
namespace API.Tests.Notings;

public class NotingsControllerTests
{
    private TestDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new TestDbContext(options);
    }

    [Fact]
    public async Task Create_SavesNotingWithItems()
    {
        using var db = CreateDbContext();
        var controller = new NotingsController(db);

        var dto = new CreateNotingDto
        {
            FundedAgency = "NBCC funded",
            ProjectTitle = "Development of Sustainable Composite Material from Agro Waste",
            ProjectNo = "CP-00281-2025-26",
            Date = "2026-02-20",
            Items = new List<CreateNotingItemDto>
            {
                new CreateNotingItemDto
                {
                    SlNo = 1,
                    NameOfItem = "Thermal Conductivity System",
                    IndentNoAndDate = "33/CED/FY:2026-27 dt 04/08/2026",
                    BudgetHeadAndBalance = "Non-Recurring Rs. 48,000,000/-",
                    IndentAmount = "14,90,000.16/-",
                    ModeOfPurchase = "Non GeM-Rule 155 of GFR 2017"
                }
            }
        };

        var result = await controller.Create(dto, CancellationToken.None);

        var createdAtResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<NotingResponseDto>(createdAtResult.Value);

        Assert.Equal("NBCC funded", response.FundedAgency);
        Assert.Single(response.Items);
        Assert.Equal("Thermal Conductivity System", response.Items[0].NameOfItem);

        var inDb = await db.Notings.Include(n => n.Items).FirstOrDefaultAsync(n => n.Id == response.Id);
        Assert.NotNull(inDb);
        Assert.Single(inDb.Items);
    }

    [Fact]
    public async Task GetAll_ReturnsSavedNotings()
    {
        using var db = CreateDbContext();
        db.Notings.Add(new Domain.Entities.Noting
        {
            Id = Guid.NewGuid(),
            FundedAgency = "DST",
            ProjectTitle = "AI Research",
            ProjectNo = "PROJ-101",
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = "Saved",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotingsController(db);
        var result = await controller.GetAll(ct: CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result);
        // GetAll now returns a paged envelope { items, totalCount, pageNumber, pageSize, totalPages }.
        var itemsValue = okResult.Value!.GetType().GetProperty("items")!.GetValue(okResult.Value);
        var items = Assert.IsAssignableFrom<IReadOnlyList<NotingResponseDto>>(itemsValue);
        Assert.Single(items);
        Assert.Equal("DST", items[0].FundedAgency);
    }
}
