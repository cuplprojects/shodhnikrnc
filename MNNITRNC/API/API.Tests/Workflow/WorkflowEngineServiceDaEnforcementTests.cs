using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowEngineServiceDaEnforcementTests
{
    private static async Task<(TestProcurementDbContext Db, WorkflowEngineService Engine, Guid InstanceId)>
        CreateAssignedIndentInstanceAsync(Guid assignedToUserId, bool isAssignedViaProjectDa = true)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        await WorkflowDefinitionSeeder.SeedAsync(db);
        try { await IndentWorkflowSeeder.SeedAsync(db); } catch { }

        var instance = new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.IndentAssignedToDA,
            AssignedToUserId = assignedToUserId,
            IsAssignedViaProjectDa = isAssignedViaProjectDa,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.WorkflowInstances.Add(instance);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        return (db, engine, instance.Id);
    }

    // AssignedToDealingAssistant (ResearchProposalWorkflowSeeder) rather than
    // IndentAssignedToDA (IndentWorkflowSeeder) here deliberately: the Indent
    // chain's own AllowedRoles ("RegularStaff,Faculty" / "RegularStaff,Clerk")
    // never included Superintendent/DeputyRegistrar/Dean to begin with, so it
    // cannot exercise RolesNotNarrowedByAssignment's carve-out -- the base
    // role-membership check rejects a Superintendent there regardless of
    // narrowing. AssignedToDealingAssistant is the stage
    // StagesNarrowedByAssignment was historically hardcoded around before
    // this task's generalization, and ResearchProposalWorkflowSeeder seeds it
    // with AllowedRoles = "RegularStaff,Superintendent,DeputyRegistrar,Dean"
    // (ResearchProposalWorkflowSeeder.cs:50), so it is the correct fixture
    // for proving the carve-out survives the generalized rule.
    private static async Task<(TestProcurementDbContext Db, WorkflowEngineService Engine, Guid InstanceId)>
        CreateAssignedResearchProposalInstanceAsync(Guid assignedToUserId, bool isAssignedViaProjectDa = true)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        await WorkflowDefinitionSeeder.SeedAsync(db);
        await ResearchProposalWorkflowSeeder.SeedAsync(db);

        var instance = new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = RequestType.ResearchProposal,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.AssignedToDealingAssistant,
            AssignedToUserId = assignedToUserId,
            IsAssignedViaProjectDa = isAssignedViaProjectDa,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.WorkflowInstances.Add(instance);
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        return (db, engine, instance.Id);
    }

    [Fact]
    public async Task ForwardAsync_IndentAssignedToDA_DifferentRegularStaffUser_ThrowsAuthorizationException()
    {
        var assignedDaUserId = Guid.NewGuid();
        var (db, engine, instanceId) = await CreateAssignedIndentInstanceAsync(assignedDaUserId);
        var someOtherRegularStaffUserId = Guid.NewGuid();

        var act = () => engine.ForwardAsync(instanceId, someOtherRegularStaffUserId, ["RegularStaff"], "Trying anyway");

        await act.Should().ThrowAsync<WorkflowAuthorizationException>();
    }

    [Fact]
    public async Task ForwardAsync_IndentAssignedToDA_TheAssignedUser_Succeeds()
    {
        var assignedDaUserId = Guid.NewGuid();
        var (db, engine, instanceId) = await CreateAssignedIndentInstanceAsync(assignedDaUserId);

        var act = () => engine.ForwardAsync(instanceId, assignedDaUserId, ["RegularStaff"], "Proceeding");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ForwardAsync_AssignedToDealingAssistant_SuperintendentActor_Succeeds()
    {
        var assignedDaUserId = Guid.NewGuid();
        var (db, engine, instanceId) = await CreateAssignedResearchProposalInstanceAsync(assignedDaUserId);
        var superintendentUserId = Guid.NewGuid();

        var act = () => engine.ForwardAsync(instanceId, superintendentUserId, ["Superintendent"], "Escalating");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ForwardAsync_ManuallyAssignedNonDaInstance_DifferentRegularStaffUser_IsNotNarrowed()
    {
        // AssignedToUserId set by a pre-existing manual Assign action (not the
        // project-DA auto-population): the narrowing rule must leave it alone,
        // exactly as before the DA feature existed.
        var manuallyAssignedUserId = Guid.NewGuid();
        var (db, engine, instanceId) = await CreateAssignedIndentInstanceAsync(
            manuallyAssignedUserId, isAssignedViaProjectDa: false);
        var someOtherRegularStaffUserId = Guid.NewGuid();

        var act = () => engine.ForwardAsync(instanceId, someOtherRegularStaffUserId, ["RegularStaff"], "Picking it up");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task AssignDaAsync_Reassignment_CompletedInstanceKeepsOriginalDa_OpenInstanceMovesToNewDa()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        await WorkflowDefinitionSeeder.SeedAsync(db);
        try { await IndentWorkflowSeeder.SeedAsync(db); } catch { }

        var projectId = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = projectId, OwnerUserId = Guid.NewGuid(), ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-DA-ENF-1", SanctionDate = new DateOnly(2024, 6, 1), ProjectTitle = "DA Enforcement Project",
            StartDate = new DateOnly(2024, 6, 1), Agency = "DST", DurationMonths = 36, TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        var originalDaUserId = Guid.NewGuid();
        var newDaUserId = Guid.NewGuid();
        foreach (var (id, name) in new[] { (originalDaUserId, "Original DA"), (newDaUserId, "New DA") })
        {
            db.Users.Add(new ApplicationUser
            {
                Id = id, UserName = name.Replace(" ", "").ToLowerInvariant(), Email = $"{id}@mnnit.ac.in",
                FullName = name, IsActive = true, CreatedAt = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();

        var engine = new WorkflowEngineService(db);
        var departmentProvider = new API.Tests.Procurement.StubUserDepartmentProvider();
        var projectService = new API.Application.Projects.ProjectService(
            db, engine, new API.Application.Projects.ProjectYearCalculator(),
            new API.Application.Projects.OverheadSplitValidator(), departmentProvider,
            new API.Application.Access.InstituteWideScopeResolver(db, departmentProvider),
            new API.Application.Audit.AuditService(db),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)));

        await projectService.AssignDaAsync(projectId, Guid.NewGuid(), ["Superintendent"], originalDaUserId, "Initial");

        async Task<Guid> AddIndentInstanceAsync(WorkflowStage stage)
        {
            var indentId = Guid.NewGuid();
            var instanceId = Guid.NewGuid();
            db.ConsumableIndents.Add(new ConsumableIndent
            {
                Id = indentId, ProjectId = projectId, BudgetHeadId = Guid.NewGuid(), WorkflowInstanceId = instanceId,
                Name = "Reagent", TechnicalSpecs = "AR", UnitOfMeasurement = "Bottle", Quantity = 1,
                Purpose = "Experiment", EstimatedCost = 500m, CreatedAt = DateTimeOffset.UtcNow,
            });
            db.WorkflowInstances.Add(new WorkflowInstance
            {
                Id = instanceId, RequestType = RequestType.Consumable, RequestId = indentId,
                Phase = WorkflowPhase.Indent, CurrentStage = stage,
                AssignedToUserId = originalDaUserId, IsAssignedViaProjectDa = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
            return instanceId;
        }

        var completedId = await AddIndentInstanceAsync(WorkflowStage.IndentApproved);
        var openId = await AddIndentInstanceAsync(WorkflowStage.IndentAssignedToDA);

        await projectService.AssignDaAsync(projectId, Guid.NewGuid(), ["Dean"], newDaUserId, "Original DA transferred");

        // Completed before the reassignment: history is never rewritten.
        var completed = await db.WorkflowInstances.FirstAsync(w => w.Id == completedId);
        completed.AssignedToUserId.Should().Be(originalDaUserId,
            "an instance already at a terminal stage keeps its original DA forever");

        // Still open at reassignment time: picks up the new DA, and the
        // narrowing rule now follows it.
        var open = await db.WorkflowInstances.FirstAsync(w => w.Id == openId);
        open.AssignedToUserId.Should().Be(newDaUserId);
        open.IsAssignedViaProjectDa.Should().BeTrue();

        var oldDaActs = () => engine.ForwardAsync(openId, originalDaUserId, ["RegularStaff"], "Still mine?");
        await oldDaActs.Should().ThrowAsync<WorkflowAuthorizationException>();

        var newDaActs = () => engine.ForwardAsync(openId, newDaUserId, ["RegularStaff"], "Taking over");
        await newDaActs.Should().NotThrowAsync();
    }
}
