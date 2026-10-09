using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

/// <summary>
/// Task A3: every <see cref="WorkflowStep"/> written by <c>AppendStep</c> gets
/// its <see cref="WorkflowStep.IsInternal"/> flag set automatically from the
/// action that created it -- false (visible to the requester/HOD) only for
/// Reject and Return, true (internal office communication) for everything
/// else. Task A6 later reads this flag to filter what a PI/HOD sees; this
/// suite only proves the flag itself is set correctly on every action.
/// </summary>
public class WorkflowStepIsInternalTests
{
    private static readonly Guid ActorId = Guid.NewGuid();

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<(WorkflowEngineService Engine, WorkflowInstance Instance, TestDbContext Db)>
        RaisedAsync()
    {
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);

        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);

        return (engine, instance, db);
    }

    private static WorkflowStep LatestStep(WorkflowInstance instance) =>
        instance.Steps.OrderByDescending(s => s.Timestamp).First();

    [Fact]
    public async Task Raise_IsNotInternal_False()
    {
        // RaiseAsync itself appends a Raise step -- not Reject/Return, so
        // internal.
        var (_, instance, _) = await RaisedAsync();

        var reloaded = LatestStep(instance);
        reloaded.Action.Should().Be(WorkflowAction.Raise);
        reloaded.IsInternal.Should().BeTrue();
    }

    [Fact]
    public async Task Assign_SetsIsInternal_True()
    {
        var (engine, instance, db) = await RaisedAsync();
        instance.CurrentStage = WorkflowStage.SignedCopyUploaded; // required by AssignAsync
        await db.SaveChangesAsync();

        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, Hod, "assigning for review");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = LatestStep(reloaded!);
        step.Action.Should().Be(WorkflowAction.Assign);
        step.IsInternal.Should().BeTrue();
    }

    [Fact]
    public async Task Forward_SetsIsInternal_True()
    {
        var (engine, instance, db) = await RaisedAsync();
        instance.CurrentStage = WorkflowStage.Assigned; // Forward from here needs Superintendent; Office covers it
        await db.SaveChangesAsync();

        await engine.ForwardAsync(instance.Id, ActorId, Office, "forwarding to next desk");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = LatestStep(reloaded!);
        step.Action.Should().Be(WorkflowAction.Forward);
        step.IsInternal.Should().BeTrue();
    }

    [Fact]
    public async Task Approve_SetsIsInternal_True()
    {
        var (engine, instance, db) = await RaisedAsync();
        instance.CurrentStage = WorkflowStage.ForwardedDR; // CanApprove = true here
        await db.SaveChangesAsync();

        await engine.ApproveAsync(instance.Id, ActorId, Dean, "approved");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = LatestStep(reloaded!);
        step.Action.Should().Be(WorkflowAction.Approve);
        step.IsInternal.Should().BeTrue();
    }

    [Fact]
    public async Task Reject_SetsIsInternal_False()
    {
        var (engine, instance, db) = await RaisedAsync();
        instance.CurrentStage = WorkflowStage.ForwardedDR; // CanReject = true here
        await db.SaveChangesAsync();

        await engine.RejectAsync(instance.Id, ActorId, Dean, "not acceptable");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = LatestStep(reloaded!);
        step.Action.Should().Be(WorkflowAction.Reject);
        step.IsInternal.Should().BeFalse();
    }

    [Fact]
    public async Task Return_SetsIsInternal_False()
    {
        var (engine, instance, db) = await RaisedAsync();
        instance.CurrentStage = WorkflowStage.ForwardedDR; // CanReturn = true here
        await db.SaveChangesAsync();

        await engine.ReturnAsync(instance.Id, ActorId, Dean, "please fix and resubmit");

        var reloaded = await engine.GetAsync(instance.Id);
        var step = LatestStep(reloaded!);
        step.Action.Should().Be(WorkflowAction.Return);
        step.IsInternal.Should().BeFalse();
    }
}
