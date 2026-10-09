using API.Domain.Entities;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowQueryPersistenceTests
{
    [Fact]
    public async Task WorkflowQuery_RoundTrips()
    {
        using var db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var query = new WorkflowQuery
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = Guid.NewGuid(),
            AskedByUserId = Guid.NewGuid(),
            AskedOfUserId = Guid.NewGuid(),
            Question = "Which head does this fall under?",
            AskedAt = DateTimeOffset.UtcNow,
        };
        db.WorkflowQueries.Add(query);
        await db.SaveChangesAsync();

        var reloaded = await db.WorkflowQueries.SingleAsync();
        reloaded.Question.Should().Be("Which head does this fall under?");
        reloaded.Answer.Should().BeNull();
        reloaded.AnsweredAt.Should().BeNull();
    }
}
