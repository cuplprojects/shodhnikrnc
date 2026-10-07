using API.Application.Access;
using API.Application.Fellowship;
using API.Application.Procurement;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// <see cref="IFellowshipService.ListPendingClaimsForCallerAsync"/> -- the
/// dashboard's "pending my action" panel for fellowship claims. Built on top
/// of <see cref="IWorkflowPendingQueryService"/> (Task 1's stage-matching
/// primitive) plus this service's own department scoping via the claim's join
/// chain (FellowshipClaim -> ManpowerSelection -> SanctionedManpowerPosition
/// -> Project.DepartmentId), mirroring
/// ResearchProposalPendingForCallerTests/TravelPendingForCallerTests.
/// </summary>
public class FellowshipClaimPendingForCallerTests
{
    private sealed class FakeDepartment(Guid? departmentId) : IUserDepartmentProvider
    {
        public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(departmentId);
    }

    private static FellowshipService BuildService(TestProcurementDbContext db, Guid callerDepartmentId)
    {
        var workflow = new WorkflowEngineService(db);
        var context = new FellowContextService(db);
        var documents = new StubFellowshipDocumentGenerationService();
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var userDepartment = new FakeDepartment(callerDepartmentId);

        return new FellowshipService(
            db, context, workflow, documents, new StubFacultyProfileProvider(),
            pendingQuery, userDepartment);
    }

    /// <summary>
    /// Seeds the full chain (Project in <paramref name="departmentId"/> ->
    /// SanctionedManpowerPosition -> ManpowerSelection -> FellowshipClaim)
    /// plus a WorkflowInstance planted directly at <paramref name="stage"/> --
    /// bypasses the actual ApproveByPI/ApproveByHOD chain (irrelevant to this
    /// method, which only reads WorkflowInstanceId + CurrentStage) so each
    /// test can plant a claim at exactly the stage it needs.
    /// </summary>
    private static Guid CreateClaimAsync(
        TestProcurementDbContext db, Guid departmentId, WorkflowStage stage,
        int claimMonth = 3, int claimYear = 2026)
    {
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var claimId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            DepartmentId = departmentId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = $"SAN-{claimId:N}",
            SanctionDate = new DateOnly(2026, 1, 1),
            ProjectTitle = "Pending-for-caller fixture project",
            StartDate = new DateOnly(2026, 1, 1),
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 37_000m,
            Hra = 7_400m,
        });

        // ManpowerSelection.CandidateId is a required FK (HasOne(...).WithMany()
        // with no IsRequired(false) in ApplicationDbContext), so
        // .Include(s => s.Candidate) inner-joins -- a CandidateId with no
        // matching Candidate row silently drops the whole ManpowerSelection
        // from ToSummariesWithDepartmentsAsync, which stranded the department
        // lookup as if the claim did not exist. Matches
        // FellowshipServiceTests.Create's fixture exactly.
        var recruitmentRequestId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = recruitmentRequestId,
            ProjectId = projectId,
            SanctionedManpowerPositionId = positionId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.Candidates.Add(new Candidate
        {
            Id = candidateId,
            RecruitmentRequestId = recruitmentRequestId,
            ApplicationUserId = Guid.NewGuid(),
            FullName = "Test Fellow",
            Mobile = "9999999999",
            AppliedAt = DateTimeOffset.UtcNow,
        });

        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            CandidateId = candidateId,
            ApplicationUserId = Guid.NewGuid(),
            SanctionedManpowerPositionId = positionId,
            JoinedOn = new DateOnly(2026, 1, 1),
            ValidTill = new DateOnly(2026, 12, 31),
            RecommendedStipend = 37_000m,
            IdCardNumber = "MNNIT/JRF/001",
            IdCardIssuedAt = DateTimeOffset.UtcNow,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId,
            RequestType = RequestType.FellowshipClaim,
            RequestId = claimId,
            Phase = WorkflowPhase.Indent,
            CurrentStage = stage,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.FellowshipClaims.Add(new FellowshipClaim
        {
            Id = claimId,
            FellowAppointmentId = appointmentId,
            WorkflowInstanceId = instanceId,
            ClaimYear = claimYear,
            ClaimMonth = claimMonth,
            ClaimPeriod = "21st-20th",
            FellowshipAmount = 37_000m,
            HraAmount = 0m,
            HraClaimed = false,
            TotalAmount = 37_000m,
            LeaveDaysTakenThisMonth = 0,
            UnauthorisedAbsenceDays = 0,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        db.SaveChanges();
        return claimId;
    }

    [Fact]
    public async Task HodSeesOnlyOwnDepartmentsClaimAtItsOwnStage()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var deptA = Guid.NewGuid();
        var deptB = Guid.NewGuid();
        db.Departments.AddRange(
            new Department { Id = deptA, Code = "CSE", Name = "Computer Science", IsInstituteWide = false },
            new Department { Id = deptB, Code = "ECE", Name = "Electronics", IsInstituteWide = false });
        db.SaveChanges();

        // Real fellowship claim route (WithPIFellowship -> PI,
        // WithHODFellowship -> HOD, WithDeanFellowship -> Dean) -- without
        // this, IWorkflowDefinitionService's unconfigured-route fallback
        // applies instead and WithHODFellowship would carry no AllowedRoles.
        await FellowshipWorkflowSeeder.SeedAsync(db);

        var pendingInDeptA = CreateClaimAsync(db, deptA, WorkflowStage.WithHODFellowship);
        CreateClaimAsync(db, deptA, WorkflowStage.WithPIFellowship); // not HOD's stage
        CreateClaimAsync(db, deptB, WorkflowStage.WithHODFellowship); // wrong department

        var hodUserId = Guid.NewGuid();
        var sut = BuildService(db, deptA);

        var result = await sut.ListPendingClaimsForCallerAsync(hodUserId, ["HOD"]);

        result.Should().ContainSingle(c => c.Id == pendingInDeptA);
    }

    [Fact]
    public async Task WrongRoleForTheStageGetsEmpty()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var deptA = Guid.NewGuid();
        db.Departments.Add(
            new Department { Id = deptA, Code = "CSE", Name = "Computer Science", IsInstituteWide = false });
        db.SaveChanges();

        await FellowshipWorkflowSeeder.SeedAsync(db);

        CreateClaimAsync(db, deptA, WorkflowStage.WithHODFellowship);

        var facultyUserId = Guid.NewGuid();
        var sut = BuildService(db, deptA);

        // Faculty is not in WithHODFellowship's AllowedRoles ("HOD").
        var result = await sut.ListPendingClaimsForCallerAsync(facultyUserId, ["Faculty"]);

        result.Should().BeEmpty();
    }
}
