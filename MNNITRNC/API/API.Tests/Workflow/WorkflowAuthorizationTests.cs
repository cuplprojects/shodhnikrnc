using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Workflow;

/// <summary>
/// The engine checks the actor's roles against the current stage's AllowedRoles.
/// This is what makes the stored route govern who may act: while the check lived
/// in [Authorize] attributes, editing a stage's roles changed nothing at runtime.
/// </summary>
public class WorkflowAuthorizationTests
{
    private static readonly Guid ActorId = Guid.NewGuid();

    private static async Task<(WorkflowEngineService Engine, TestDbContext Db)> SeededAsync()
    {
        var db = new TestDbContext(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        await WorkflowDefinitionSeeder.SeedAsync(db);
        return (new WorkflowEngineService(db), db);
    }

    private static async Task<WorkflowInstance> AtStageAsync(
        WorkflowEngineService engine, TestDbContext db, WorkflowStage stage)
    {
        // ManpowerDocument, not Consumable: Consumable/Equipment/Contingency/
        // DynamicIndent are deliberately excluded from
        // WorkflowDefinitionSeeder.SeedAsync's generic ShippedRoute (they get
        // IndentWorkflowSeeder's own cost-based routing instead), and
        // UploadSignedCopyAsync hardcodes those four types straight to
        // IndentWithHOD regardless of what is seeded. This file is testing
        // generic role-authorization mechanics against the shipped route
        // itself, not indent-specific routing, so ManpowerDocument (which
        // still gets the generic route) is the correct vehicle.
        var instance = await engine.RaiseAsync(
            RequestType.ManpowerDocument, Guid.NewGuid(), WorkflowPhase.Indent, ActorId);
        instance.CurrentStage = stage;
        await db.SaveChangesAsync();
        return instance;
    }

    [Fact]
    public async Task APermittedRoleMayAct()
    {
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.Assigned);

        await engine.ForwardAsync(instance.Id, ActorId, Office, null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Forwarded);
    }

    [Fact]
    public async Task ARoleTheStageDoesNotGrantIsRefused()
    {
        // Forwarding from Assigned is RegularStaff's job specifically (each
        // office-escalation stage now has its own single role), and a bare
        // Applicant holds no forwarding role at all.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.Assigned);

        var act = () => engine.ForwardAsync(instance.Id, ActorId, ["Applicant"], null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task TheMessageNamesTheRolesTheStageAllows()
    {
        // "Not permitted" without saying who is permitted leaves the caller with
        // nowhere to go.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        var act = () => engine.ApproveAsync(instance.Id, ActorId, Office, null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>()
            .WithMessage("*Dean*Director*");
    }

    [Fact]
    public async Task NoRolesAtAllIsRefusedWhereTheStageRequiresOne()
    {
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        var act = () => engine.ApproveAsync(instance.Id, ActorId, [], null);

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task AStageWithNoRolesIsOpenToTheRaiser()
    {
        // The initial stage carries no roles because it belongs to whoever
        // raised the request. Empty AllowedRoles means "not role-restricted",
        // not "nobody" -- reading it as the latter would make upload-signed-copy
        // impossible for everyone and strand every instance at Raised.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.Raised);

        await engine.UploadSignedCopyAsync(instance.Id, ActorId, [], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.SignedCopyUploaded);
    }

    [Fact]
    public async Task HoldingAnyOneOfTheAllowedRolesIsEnough()
    {
        // A user carries every role they hold, and the stage lists several
        // (ForwardedDR still does, unlike the now single-role office stages).
        // The check is an intersection, not a superset test.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        await engine.ApproveAsync(instance.Id, ActorId, ["Director"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task AnUnrelatedRoleAlongsideAPermittedOneStillPasses()
    {
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        await engine.ApproveAsync(instance.Id, ActorId, ["Faculty", "Dean"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task RoleMatchingIsCaseInsensitive()
    {
        // Identity treats role names case-insensitively, so the engine must too
        // -- otherwise a claim spelled "dean" would be silently refused.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        await engine.ApproveAsync(instance.Id, ActorId, ["dean"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task EditingAStagesRolesChangesWhoMayAct()
    {
        // The claim the whole phase rests on: no redeploy, no code change.
        var (engine, db) = await SeededAsync();
        var stage = await db.WorkflowStageDefinitions
            .SingleAsync(s => s.Definition!.RequestType == RequestType.ManpowerDocument
                           && s.Definition.Phase == WorkflowPhase.Indent
                           && s.Stage == WorkflowStage.Assigned);
        stage.AllowedRoles = "Faculty";
        await db.SaveChangesAsync();

        var instance = await AtStageAsync(engine, db, WorkflowStage.Assigned);

        // The office could forward here a moment ago; now only Faculty can.
        var refused = () => engine.ForwardAsync(instance.Id, ActorId, Office, null);
        await refused.Should().ThrowAsync<WorkflowAuthorizationException>();

        await engine.ForwardAsync(instance.Id, ActorId, ["Faculty"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Forwarded);
    }

    [Fact]
    public async Task CancelIsNotRoleGated()
    {
        // Cancel applies at any non-terminal stage, so gating it on the current
        // stage's roles would mean whoever happens to hold that stage decides
        // whether a request can be withdrawn.
        var (engine, db) = await SeededAsync();
        var instance = await AtStageAsync(engine, db, WorkflowStage.ForwardedDR);

        await engine.CancelAsync(instance.Id, ActorId, [], "withdrawn");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Cancelled);
    }
}
