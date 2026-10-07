using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowPendingQueryServiceTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<(TestDbContext Db, Guid DefinitionId)> SeededAsync()
    {
        var db = CreateDb();
        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId,
            RequestType = RequestType.Consumable,
            Phase = WorkflowPhase.Indent,
            Name = "Test route",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            Stages =
            [
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId,
                    Sequence = 1, Stage = WorkflowStage.IndentRaised,
                    AllowedRoles = "", IsInitial = true,
                },
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId,
                    Sequence = 2, Stage = WorkflowStage.IndentWithHOD,
                    AllowedRoles = "HOD",
                },
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId,
                    Sequence = 3, Stage = WorkflowStage.IndentWithRnCOffice,
                    AllowedRoles = "RegularStaff,Clerk",
                },
            ],
        });
        await db.SaveChangesAsync();
        return (db, definitionId);
    }

    [Fact]
    public async Task ReturnsInstancesAtAStageTheCallersRoleMayActOn()
    {
        var (db, _) = await SeededAsync();
        var matchingInstanceId = Guid.NewGuid();
        var nonMatchingInstanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = matchingInstanceId, RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(), Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentWithHOD, CreatedAt = DateTimeOffset.UtcNow,
        });
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = nonMatchingInstanceId, RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(), Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentWithRnCOffice, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var definitions = new WorkflowDefinitionService(db);
        var sut = new WorkflowPendingQueryService(db, definitions);

        var result = await sut.ListPendingInstancesAsync(
            RequestType.Consumable, WorkflowPhase.Indent, ["HOD"]);

        result.Should().ContainKey(matchingInstanceId)
            .WhoseValue.Should().Be(WorkflowStage.IndentWithHOD);
        result.Should().NotContainKey(nonMatchingInstanceId);
    }

    [Fact]
    public async Task RoleMatchIsCaseInsensitive()
    {
        var (db, _) = await SeededAsync();
        var instanceId = Guid.NewGuid();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId, RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(), Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentWithHOD, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var definitions = new WorkflowDefinitionService(db);
        var sut = new WorkflowPendingQueryService(db, definitions);

        var result = await sut.ListPendingInstancesAsync(
            RequestType.Consumable, WorkflowPhase.Indent, ["hod"]);

        result.Should().ContainKey(instanceId);
    }

    [Fact]
    public async Task CallerWithNoMatchingRoleGetsEmptyResult()
    {
        var (db, _) = await SeededAsync();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = Guid.NewGuid(), RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(), Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentWithHOD, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var definitions = new WorkflowDefinitionService(db);
        var sut = new WorkflowPendingQueryService(db, definitions);

        var result = await sut.ListPendingInstancesAsync(
            RequestType.Consumable, WorkflowPhase.Indent, ["Faculty"]);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task StageWithNoAllowedRolesNeverMatchesAnyCaller()
    {
        // A stage with an empty AllowedRoles string (e.g. a terminal stage,
        // or an initial stage owned by whoever raised it) is never
        // "pending" for any role -- WorkflowEngineService.RequireRoleAsync
        // treats an empty AllowedRoleList as "anyone", but a dashboard
        // pending-query must not surface every raised-but-untouched
        // instance to every single user, so this primitive intentionally
        // does NOT reuse that "empty means anyone" rule.
        var (db, _) = await SeededAsync();
        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = Guid.NewGuid(), RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(), Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentRaised, CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var definitions = new WorkflowDefinitionService(db);
        var sut = new WorkflowPendingQueryService(db, definitions);

        var result = await sut.ListPendingInstancesAsync(
            RequestType.Consumable, WorkflowPhase.Indent, ["Faculty"]);

        result.Should().BeEmpty();
    }

    // ------------------------------------------------ project-DA narrowing

    private static async Task<(TestDbContext Db, Guid DaLocked, Guid ManualAssigned, Guid Unassigned, Guid DaUserId)>
        SeededWithDaLockedInstanceAsync()
    {
        var db = CreateDb();
        var definitionId = Guid.NewGuid();
        db.WorkflowDefinitions.Add(new WorkflowDefinition
        {
            Id = definitionId, RequestType = RequestType.GrantReceipt, Phase = WorkflowPhase.Indent,
            Name = "Test grant route", IsActive = true, CreatedAt = DateTimeOffset.UtcNow,
            Stages =
            [
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId,
                    Sequence = 1, Stage = WorkflowStage.Draft, AllowedRoles = "", IsInitial = true,
                },
                new WorkflowStageDefinition
                {
                    Id = Guid.NewGuid(), WorkflowDefinitionId = definitionId,
                    Sequence = 2, Stage = WorkflowStage.WithRnCOfficeGrantReceipt,
                    AllowedRoles = "RegularStaff,Superintendent,DeputyRegistrar,Dean",
                },
            ],
        });

        var daUserId = Guid.NewGuid();
        WorkflowInstance Instance(Guid? assignedTo, bool viaDa) => new()
        {
            Id = Guid.NewGuid(), RequestType = RequestType.GrantReceipt, RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent, CurrentStage = WorkflowStage.WithRnCOfficeGrantReceipt,
            AssignedToUserId = assignedTo, IsAssignedViaProjectDa = viaDa, CreatedAt = DateTimeOffset.UtcNow,
        };
        var daLocked = Instance(daUserId, viaDa: true);
        var manual = Instance(Guid.NewGuid(), viaDa: false);
        var unassigned = Instance(null, viaDa: false);
        db.WorkflowInstances.AddRange(daLocked, manual, unassigned);
        await db.SaveChangesAsync();
        return (db, daLocked.Id, manual.Id, unassigned.Id, daUserId);
    }

    [Fact]
    public async Task DaLockedInstance_HiddenFromUnrelatedRegularStaff()
    {
        var (db, daLocked, manual, unassigned, _) = await SeededWithDaLockedInstanceAsync();
        var sut = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));

        var result = await sut.ListPendingInstancesAsync(
            RequestType.GrantReceipt, WorkflowPhase.Indent, ["RegularStaff"], Guid.NewGuid());

        result.Should().NotContainKey(daLocked);
        result.Should().ContainKey(manual, "manually-assigned instances are not narrowed by the DA rule");
        result.Should().ContainKey(unassigned);
    }

    [Fact]
    public async Task DaLockedInstance_VisibleToTheAssignedDa()
    {
        var (db, daLocked, _, _, daUserId) = await SeededWithDaLockedInstanceAsync();
        var sut = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));

        var result = await sut.ListPendingInstancesAsync(
            RequestType.GrantReceipt, WorkflowPhase.Indent, ["RegularStaff"], daUserId);

        result.Should().ContainKey(daLocked);
    }

    [Theory]
    [InlineData("Superintendent")]
    [InlineData("DeputyRegistrar")]
    [InlineData("Dean")]
    public async Task DaLockedInstance_VisibleToOverrideRoles(string role)
    {
        var (db, daLocked, manual, unassigned, _) = await SeededWithDaLockedInstanceAsync();
        var sut = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));

        var result = await sut.ListPendingInstancesAsync(
            RequestType.GrantReceipt, WorkflowPhase.Indent, [role], Guid.NewGuid());

        result.Should().ContainKeys(daLocked, manual, unassigned);
    }
}
