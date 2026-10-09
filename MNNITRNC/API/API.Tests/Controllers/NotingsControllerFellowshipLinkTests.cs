using System.Security.Claims;
using API.Application.Common;
using API.Controllers;
using API.Domain.Entities;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Controllers;

public class NotingsControllerFellowshipLinkTests
{
    private static ApplicationDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static void SetUser(ControllerBase controller, Guid? userId, IReadOnlyCollection<string>? roles = null)
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
    public async Task Create_WithFellowshipClaimIdOnItem_PersistsTheLink()
    {
        var db = BuildDb();
        await db.Database.EnsureCreatedAsync();
        var controller = new NotingsController(db);
        SetUser(controller, Guid.NewGuid(), ["RegularStaff"]);

        var claimId = Guid.NewGuid();
        var createDto = new CreateNotingDto
        {
            FundedAgency = "DST",
            ProjectTitle = "Fellowship Payments Batch",
            ProjectNo = "N/A",
            Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Items = new()
            {
                new CreateNotingItemDto
                {
                    SlNo = 1,
                    NameOfItem = "Fellowship claim payment",
                    IndentNoAndDate = "-",
                    BudgetHeadAndBalance = "RecurringManpower",
                    IndentAmount = "10000",
                    ModeOfPurchase = "-",
                    FellowshipClaimId = claimId,
                },
            },
        };

        var result = await controller.Create(createDto, CancellationToken.None);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<NotingResponseDto>(createdResult.Value);
        response.Items.Should().ContainSingle();
        response.Items[0].FellowshipClaimId.Should().Be(claimId);
    }
}
