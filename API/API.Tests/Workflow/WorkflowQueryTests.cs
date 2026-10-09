using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// AskQueryAsync/AnswerQueryAsync/ListQueriesAsync: a lightweight internal
/// question/answer exchange between two people who have both acted on the
/// same workflow instance, sitting alongside the approval chain without ever
/// moving CurrentStage.
/// </summary>
public class WorkflowQueryTests
{
    private static readonly Guid ActorId = Guid.NewGuid();

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<(WorkflowEngineService Engine, WorkflowInstance Instance, TestDbContext Db)>
        RaisedInstanceAsync()
    {
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);

        var instance = await engine.RaiseAsync(
            RequestType.Consumable, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);

        return (engine, instance, db);
    }

    [Fact]
    public async Task AskQueryAsync_TargetHasActedOnThisInstance_Succeeds()
    {
        // RaiseAsync itself appends a WorkflowStep with ActorUserId = ActorId,
        // so ActorId already qualifies as a legitimate query target.
        var (engine, instance, db) = await RaisedInstanceAsync();

        var query = await engine.AskQueryAsync(
            instance.Id, Guid.NewGuid(), ActorId, "Which head does this fall under?");

        var reloaded = await db.WorkflowQueries.SingleAsync();
        reloaded.Id.Should().Be(query.Id);
        reloaded.AskedOfUserId.Should().Be(ActorId);
        reloaded.Question.Should().Be("Which head does this fall under?");
        reloaded.Answer.Should().BeNull();
    }

    [Fact]
    public async Task AskQueryAsync_TargetHasNeverActedOnThisInstance_Throws()
    {
        var (engine, instance, _) = await RaisedInstanceAsync();

        var act = () => engine.AskQueryAsync(
            instance.Id, Guid.NewGuid(), Guid.NewGuid(), "Can you clarify?");

        await act.Should().ThrowAsync<QueryTargetNotAnActorException>();
    }

    /// <summary>
    /// Queries are always internal -- ListQueries/AskQuery/WorkflowController.Get
    /// all hide them from the proposal's PI. The PI is technically an "actor"
    /// on their own instance (their own Raise step), so without this guard a
    /// query could be addressed to them: a state ListQueries would then always
    /// hide, yet AnswerQuery would still let them answer, silently breaking
    /// the "never shown to PI" invariant. Confirmed here at the engine layer
    /// (AskQueryAsync), which is where the fix lives.
    /// </summary>
    [Fact]
    public async Task AskQueryAsync_TargetIsTheProposalsOwnPi_Throws()
    {
        var db = CreateDb();
        await WorkflowDefinitionSeeder.SeedAsync(db);
        var engine = new WorkflowEngineService(db);
        var piUserId = Guid.NewGuid();

        var proposal = new ResearchProposal
        {
            Id = Guid.NewGuid(),
            OwnerUserId = piUserId,
            DepartmentId = Guid.NewGuid(),
            Title = "Test proposal",
            Agency = "DST",
            ProposedAmount = 100_000m,
            OverheadAmount = 10_000m,
            DurationMonths = 12,
            Status = ProposalStatus.UnderApproval,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        // Raise as the PI, so the PI genuinely does appear in this instance's
        // own ActorUserId history -- the scenario the plain "has this user
        // acted on this instance" check alone would wrongly let through.
        var instance = await engine.RaiseAsync(
            RequestType.ResearchProposal, proposal.Id, WorkflowPhase.Indent, piUserId);

        var act = () => engine.AskQueryAsync(instance.Id, Guid.NewGuid(), piUserId, "Can you clarify?");

        await act.Should().ThrowAsync<QueryTargetNotAnActorException>();
        (await engine.ListQueriesAsync(instance.Id)).Should().BeEmpty(
            "the ask must be refused outright, not merely hidden later");
    }

    [Fact]
    public async Task AnswerQueryAsync_ByTheAskedOfUser_Succeeds()
    {
        var (engine, instance, db) = await RaisedInstanceAsync();
        var query = await engine.AskQueryAsync(
            instance.Id, Guid.NewGuid(), ActorId, "Which head does this fall under?");

        await engine.AnswerQueryAsync(query.Id, ActorId, "Consumables head.");

        var reloaded = await db.WorkflowQueries.SingleAsync(q => q.Id == query.Id);
        reloaded.Answer.Should().Be("Consumables head.");
        reloaded.AnsweredAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AnswerQueryAsync_ByAnyoneElse_Throws()
    {
        var (engine, instance, _) = await RaisedInstanceAsync();
        var query = await engine.AskQueryAsync(
            instance.Id, Guid.NewGuid(), ActorId, "Which head does this fall under?");

        var act = () => engine.AnswerQueryAsync(query.Id, Guid.NewGuid(), "Not my question to answer.");

        await act.Should().ThrowAsync<NotTheQueryRecipientException>();
    }

    [Fact]
    public async Task ListQueriesAsync_ReturnsInAskedAtOrder()
    {
        var (engine, instance, _) = await RaisedInstanceAsync();

        var first = await engine.AskQueryAsync(instance.Id, Guid.NewGuid(), ActorId, "First question?");
        var second = await engine.AskQueryAsync(instance.Id, Guid.NewGuid(), ActorId, "Second question?");

        var queries = await engine.ListQueriesAsync(instance.Id);

        queries.Should().HaveCount(2);
        queries[0].Id.Should().Be(first.Id);
        queries[1].Id.Should().Be(second.Id);
    }
}
