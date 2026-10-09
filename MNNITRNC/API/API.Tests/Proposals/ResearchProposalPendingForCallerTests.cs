using API.Application.Access;
using API.Application.Audit;
using API.Application.Documents;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Proposals;

/// <summary>
/// <see cref="IResearchProposalService.ListPendingForCallerAsync"/> -- the
/// dashboard's "pending my action" panel for research proposals. Built on top
/// of <see cref="IWorkflowPendingQueryService"/> (Task 1's stage-matching
/// primitive) plus this service's own department/institute-wide scoping,
/// exactly like <see cref="IResearchProposalService.ListForHodAsync"/> and
/// <see cref="IResearchProposalService.ListForRnCOfficeAsync"/> -- but
/// strictly stage-matched against the caller's own roles rather than
/// status-matched against a fixed role.
/// </summary>
public class ResearchProposalPendingForCallerTests
{
    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static async Task<(TestDbContext Db, Guid DeptA, Guid DeptB)> SeededTwoDepartmentsAsync()
    {
        var db = new TestDbContext(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        // The real proposal route (WithHOD -> HOD, WithRnCOffice -> office
        // roles, ...) -- without this, IWorkflowDefinitionService's
        // unconfigured-route fallback applies instead, and the stages this
        // test asserts on would not carry the AllowedRoles it expects.
        await ResearchProposalWorkflowSeeder.SeedAsync(db);

        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.AddRange(
            new Department { Id = deptA, Code = "CSE", Name = "Computer Science", IsInstituteWide = false },
            new Department { Id = deptB, Code = "ECE", Name = "Electronics", IsInstituteWide = false });
        await db.SaveChangesAsync();

        return (db, deptA, deptB);
    }

    /// <summary>
    /// A ResearchProposal already UnderApproval, paired with a WorkflowInstance
    /// sitting directly at <paramref name="stage"/> -- bypasses the actual
    /// Forward chain (irrelevant to this method, which only reads
    /// WorkflowInstanceId + CurrentStage) so each test can plant a proposal at
    /// exactly the stage it needs.
    /// </summary>
    private static async Task<Guid> CreateProposalAsync(TestDbContext db, Guid departmentId, WorkflowStage stage)
    {
        var proposalId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId,
            RequestType = RequestType.ResearchProposal,
            RequestId = proposalId,
            Phase = WorkflowPhase.Indent,
            CurrentStage = stage,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.ResearchProposals.Add(new ResearchProposal
        {
            Id = proposalId,
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = departmentId,
            Title = "Pending-for-caller fixture proposal",
            Agency = "DST",
            ProposedAmount = 1_000_000m,
            OverheadAmount = 0m,
            DurationMonths = 12,
            Status = ProposalStatus.UnderApproval,
            WorkflowInstanceId = instanceId,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();
        return proposalId;
    }

    private static ResearchProposalService BuildService(
        TestDbContext db, Guid callerUserId, Guid callerDepartmentId, bool isInstituteWide = false)
    {
        var workflow = new WorkflowEngineService(db);
        var department = new FakeDepartment(callerDepartmentId);
        var instituteWideScope = isInstituteWide
            ? new AlwaysInstituteWide()
            : (IInstituteWideScopeResolver)new InstituteWideScopeResolver(db, department);
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var projectService = new ProjectService(
            db, workflow, new ProjectYearCalculator(), new OverheadSplitValidator(), department,
            instituteWideScope, new AuditService(db), pendingQuery);

        return new ResearchProposalService(
            db, workflow, department, projectService, instituteWideScope,
            new DocumentChecklistService(db), new AuditService(db), pendingQuery);
    }

    private sealed class AlwaysInstituteWide : IInstituteWideScopeResolver
    {
        public Task<bool> IsInstituteWideAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(true);
    }

    [Fact]
    public async Task HodSeesOnlyOwnDepartmentsProposalAtWithHodStage()
    {
        var (db, deptA, deptB) = await SeededTwoDepartmentsAsync();

        var pendingInDeptA = await CreateProposalAsync(db, deptA, WorkflowStage.WithHOD);
        await CreateProposalAsync(db, deptA, WorkflowStage.WithRnCOffice); // not HOD's stage
        await CreateProposalAsync(db, deptB, WorkflowStage.WithHOD); // wrong department

        var hodUserId = Guid.NewGuid();
        var sut = BuildService(db, hodUserId, deptA);

        var result = await sut.ListPendingForCallerAsync(hodUserId, ["HOD"]);

        result.Should().ContainSingle(p => p.Id == pendingInDeptA);
    }

    [Fact]
    public async Task NonRnCOfficeAccountGetsEmptyForOfficeStages()
    {
        var (db, deptA, _) = await SeededTwoDepartmentsAsync();
        await CreateProposalAsync(db, deptA, WorkflowStage.WithRnCOffice);

        var officeUserId = Guid.NewGuid();
        var sut = BuildService(db, officeUserId, deptA, isInstituteWide: false);

        var result = await sut.ListPendingForCallerAsync(officeUserId, ["RegularStaff"]);

        result.Should().BeEmpty();
    }
}
