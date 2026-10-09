using API.Application.Access;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Access;

/// <summary>
/// Deleting a role that a workflow stage grants would orphan that stage: the
/// engine reads AllowedRoles by name, so the stage would refuse everyone with
/// nothing pointing back at the deletion.
/// </summary>
public class RoleDeletionGuardTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task SeedRouteAsync(TestDbContext db, string allowedRoles)
    {
        var definition = new WorkflowDefinition
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            Phase = WorkflowPhase.Indent,
            Name = "Route",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        definition.Stages.Add(new WorkflowStageDefinition
        {
            Id = Guid.NewGuid(),
            WorkflowDefinitionId = definition.Id,
            Sequence = 1,
            Stage = WorkflowStage.Assigned,
            AllowedRoles = allowedRoles,
        });
        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ProtectedRolesAreRecognised()
    {
        RoleProtection.IsProtected("Dean").Should().BeTrue();
        RoleProtection.IsProtected("HOD").Should().BeTrue();
        RoleProtection.IsProtected("dean").Should().BeTrue("Identity treats role names case-insensitively");
        RoleProtection.IsProtected("Auditor").Should().BeFalse("a custom role is fully editable");
        await Task.CompletedTask;
    }

    [Fact]
    public async Task ARoleAStageGrantsCannotBeDeleted()
    {
        var db = CreateDb();
        await SeedRouteAsync(db, "Auditor,Dean");

        var guard = new RoleDeletionGuard(db);
        var stages = await guard.StagesGrantingAsync("Auditor");

        stages.Should().Be(1);
    }

    [Fact]
    public async Task ARoleNoStageGrantsCanBeDeleted()
    {
        var db = CreateDb();
        await SeedRouteAsync(db, "Dean");

        var stages = await new RoleDeletionGuard(db).StagesGrantingAsync("Auditor");

        stages.Should().Be(0);
    }

    [Fact]
    public async Task MatchingIsOnWholeRoleNames()
    {
        // "Dean" must not match inside "DeanOfStudents", or deleting an unused
        // custom role would be refused for a reason nobody could see.
        var db = CreateDb();
        await SeedRouteAsync(db, "DeanOfStudents");

        var stages = await new RoleDeletionGuard(db).StagesGrantingAsync("Dean");

        stages.Should().Be(0);
    }

    [Fact]
    public async Task MatchingIgnoresCaseAndSurroundingSpace()
    {
        var db = CreateDb();
        await SeedRouteAsync(db, "Dean, auditor ,Director");

        var stages = await new RoleDeletionGuard(db).StagesGrantingAsync("Auditor");

        stages.Should().Be(1);
    }

    [Fact]
    public async Task EveryGrantingStageIsCounted()
    {
        // The count is what tells an operator how much is at stake.
        var db = CreateDb();
        await SeedRouteAsync(db, "Auditor");
        await SeedRouteAsync(db, "Auditor");

        var stages = await new RoleDeletionGuard(db).StagesGrantingAsync("Auditor");

        stages.Should().Be(2);
    }
}
