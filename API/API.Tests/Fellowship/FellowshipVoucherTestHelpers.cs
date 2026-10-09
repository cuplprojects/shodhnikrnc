using API.Application.Fellowship;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Fellowship;

/// <summary>
/// Seeding for <see cref="FellowshipVoucherCreationTests"/>. Kept separate
/// from <see cref="FellowshipServiceTests"/>' own single-project
/// <c>Create()</c> fixture because voucher creation needs several projects,
/// each with its own RecurringManpower <see cref="BudgetHead"/> and
/// <see cref="GrantReceipt"/>, and claims seeded straight at a given
/// workflow stage rather than raised through the fellow-facing flow.
/// </summary>
internal static class FellowshipVoucherTestHelpers
{
    private static readonly DateOnly Joined = new(2026, 1, 1);
    private static readonly DateOnly ValidTill = new(2026, 12, 31);

    public static TestProcurementDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestProcurementDbContext(options);
    }

    public static IFellowshipService NewService(TestProcurementDbContext db)
    {
        var userDepartment = new StubUserDepartmentProvider();
        return new FellowshipService(
            db,
            new FellowContextService(db),
            new WorkflowEngineService(db),
            new StubFellowshipDocumentGenerationService(),
            new StubFacultyProfileProvider(),
            new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db)),
            userDepartment);
    }

    /// <summary>
    /// Two projects, each with a RecurringManpower head and one Approved
    /// grant receipt of <paramref name="grantPerProject"/> against it, one
    /// fellow per project, one Approved claim per fellow.
    /// </summary>
    public static (IFellowshipService Service, TestProcurementDbContext Db,
        FellowshipClaim Claim1, Guid Project1Id, FellowshipClaim Claim2, Guid Project2Id)
        CreateTwoApprovedClaimsOnDifferentProjects(
            decimal claim1Amount, decimal claim2Amount, decimal grantPerProject = 100_000m)
    {
        var db = NewDb();

        var project1Id = SeedProject(db, "SAN-V1", grantPerProject);
        var project2Id = SeedProject(db, "SAN-V2", grantPerProject);

        var claim1 = SeedClaim(db, SeedAppointment(db, project1Id), claim1Amount, WorkflowStage.Approved);
        var claim2 = SeedClaim(db, SeedAppointment(db, project2Id), claim2Amount, WorkflowStage.Approved);

        db.SaveChanges();
        return (NewService(db), db, claim1, project1Id, claim2, project2Id);
    }

    /// <summary>
    /// One project whose RecurringManpower head has only
    /// <paramref name="manpowerHeadAvailable"/> of Approved grant against it,
    /// and one Approved claim for <paramref name="claimAmount"/>.
    /// </summary>
    public static (IFellowshipService Service, TestProcurementDbContext Db,
        FellowshipClaim Claim, Guid ProjectId)
        CreateApprovedClaimWithInsufficientBudget(decimal claimAmount, decimal manpowerHeadAvailable)
    {
        var db = NewDb();
        var projectId = SeedProject(db, "SAN-V3", manpowerHeadAvailable);
        var claim = SeedClaim(db, SeedAppointment(db, projectId), claimAmount, WorkflowStage.Approved);
        db.SaveChanges();
        return (NewService(db), db, claim, projectId);
    }

    /// <summary>
    /// One more claim at <paramref name="stage"/> against a project already
    /// seeded in <paramref name="db"/> -- <paramref name="projectId"/> if
    /// given, otherwise whichever seeded project comes first. Gets its own
    /// appointment so it never collides with an existing claim's month.
    /// </summary>
    public static async Task<FellowshipClaim> AddClaimAtStage(
        TestProcurementDbContext db, WorkflowStage stage, decimal amount = 1_000m, Guid? projectId = null)
    {
        var targetProjectId = projectId ?? await db.Projects.Select(p => p.Id).FirstAsync();
        var claim = SeedClaim(db, SeedAppointment(db, targetProjectId), amount, stage);
        await db.SaveChangesAsync();
        return claim;
    }

    /// <summary>Returns the project's RecurringManpower head id.</summary>
    public static Task<Guid> ManpowerHeadIdAsync(TestProcurementDbContext db, Guid projectId) =>
        db.BudgetHeads
            .Where(b => b.ProjectId == projectId && b.HeadName == BudgetHeadName.RecurringManpower)
            .Select(b => b.Id)
            .SingleAsync();

    private static Guid SeedProject(TestProcurementDbContext db, string sanctionNo, decimal manpowerGrant)
    {
        var projectId = Guid.NewGuid();
        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = sanctionNo,
            SanctionDate = Joined,
            ProjectTitle = $"Voucher Test Project {sanctionNo}",
            StartDate = Joined,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var manpowerHeadId = Guid.NewGuid();
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = manpowerHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringManpower,
            Year1Amount = 1_000_000m,
            Total = 1_000_000m,
        });

        // A second, non-manpower head with its own generous grant, so a
        // balance check that wrongly summed every head on the project (rather
        // than only RecurringManpower) would be caught by the
        // insufficient-balance tests.
        var consumableHeadId = Guid.NewGuid();
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = consumableHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 1_000_000m,
            Total = 1_000_000m,
        });

        db.GrantReceipts.Add(ApprovedReceipt(projectId, manpowerHeadId, manpowerGrant));
        db.GrantReceipts.Add(ApprovedReceipt(projectId, consumableHeadId, 500_000m));

        return projectId;
    }

    public static GrantReceipt ApprovedReceipt(Guid projectId, Guid budgetHeadId, decimal amount) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = projectId,
        BudgetHeadId = budgetHeadId,
        ReceivedDate = Joined,
        Amount = amount,
        Type = GrantReceiptType.Head,
        Status = GrantReceiptStatus.Approved,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static Guid SeedAppointment(TestProcurementDbContext db, Guid projectId)
    {
        var positionId = Guid.NewGuid();
        var recruitmentRequestId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();
        var fellowUserId = Guid.NewGuid();

        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = 37_000m,
            Hra = 7_400m,
        });
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
            ApplicationUserId = fellowUserId,
            FullName = "Voucher Test Fellow",
            Mobile = "9999999999",
            AppliedAt = DateTimeOffset.UtcNow,
        });
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            CandidateId = candidateId,
            ApplicationUserId = fellowUserId,
            SanctionedManpowerPositionId = positionId,
            JoinedOn = Joined,
            ValidTill = ValidTill,
            RecommendedStipend = 37_000m,
            IdCardNumber = "MNNIT/JRF/V",
            IdCardIssuedAt = DateTimeOffset.UtcNow,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        return appointmentId;
    }

    private static FellowshipClaim SeedClaim(
        TestProcurementDbContext db, Guid appointmentId, decimal totalAmount, WorkflowStage stage)
    {
        var claimId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = instanceId,
            RequestType = RequestType.FellowshipClaim,
            RequestId = claimId,
            Phase = WorkflowPhase.Indent,
            CurrentStage = stage,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var claim = new FellowshipClaim
        {
            Id = claimId,
            FellowAppointmentId = appointmentId,
            WorkflowInstanceId = instanceId,
            ClaimYear = 2026,
            ClaimMonth = 3,
            FellowshipAmount = totalAmount,
            HraAmount = 0m,
            TotalAmount = totalAmount,
            Remarks = "Monthly claim.",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.FellowshipClaims.Add(claim);
        return claim;
    }
}
