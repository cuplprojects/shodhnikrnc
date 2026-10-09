using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowStageDefinitionPersistenceTests
{
    [Fact]
    public async Task CanReturn_RoundTripsWithTheStageDefinition()
    {
        using var db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId,
            RequestType = RequestType.ResearchProposal,
            Phase = WorkflowPhase.Indent,
            Name = "Test route",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            Stages =
            {
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(),
                    WorkflowDefinitionId = definitionId,
                    Sequence = 1,
                    Stage = WorkflowStage.WithDean,
                    AllowedRoles = "Dean",
                    IsInitial = true,
                    CanReject = true,
                    CanReturn = true,
                },
            },
        });
        await db.SaveChangesAsync();

        var reloaded = await db.WorkflowStageDefinitions.SingleAsync();
        reloaded.CanReject.Should().BeTrue();
        reloaded.CanReturn.Should().BeTrue();
    }
}
