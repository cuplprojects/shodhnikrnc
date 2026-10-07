using API.Application.Access;
using API.Application.Fellowship;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static API.Tests.TestRoles;

namespace API.Tests.Fellowship;

public partial class FellowshipServiceTests
{
    private static readonly DateOnly Joined = new(2026, 1, 1);
    private static readonly DateOnly ValidTill = new(2026, 12, 31);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        FellowshipService Fellowship,
        LeaveService Leave,
        StubFellowshipDocumentGenerationService Documents,
        WorkflowEngineService Workflow,
        Guid PiUserId,
        Guid FellowUserId,
        Guid AppointmentId,
        Guid ProjectId);

    private static Fixture Create(bool withIdCard = true, decimal stipend = 37_000m,
                                 decimal sanctionedHra = 7_400m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var piUserId = Guid.NewGuid();
        var fellowUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = piUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-F1",
            SanctionDate = Joined,
            ProjectTitle = "Fellowship Test Project",
            StartDate = Joined,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 2_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
        {
            Id = positionId,
            ProjectId = projectId,
            Designation = "Junior Research Fellow",
            Positions = 1,
            Stipend = stipend,
            Hra = sanctionedHra,
        });

        // ManpowerSelection.CandidateId is a required FK (HasOne(...).WithMany()
        // with no IsRequired(false) in ApplicationDbContext), so
        // .Include(s => s.Candidate) inner-joins -- a CandidateId with no
        // matching Candidate row silently drops the whole ManpowerSelection
        // from any query that includes it (e.g.
        // FellowshipService.ToSummariesAsync), which is what stranded
        // SanctionedHra/scholar name/etc as null/"Scholar" fallbacks.
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
            ApplicationUserId = fellowUserId,
            FullName = "Test Fellow",
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
            RecommendedStipend = stipend,
            IdCardNumber = withIdCard ? "MNNIT/JRF/001" : null,
            IdCardIssuedAt = withIdCard ? DateTimeOffset.UtcNow : null,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        // Without this, no WorkflowDefinition row exists for
        // (FellowshipClaim, Indent), so IWorkflowDefinitionService falls back
        // to WorkflowDefinitionSeeder's generic indent ShippedRoute -- which
        // has no WithPIFellowship/WithHODFellowship/WithDeanFellowship
        // stages at all, stranding every raised claim at Raised. Matches
        // ResearchProposalServiceTests' equivalent seeding call.
        FellowshipWorkflowSeeder.SeedAsync(db).GetAwaiter().GetResult();

        var workflow = new WorkflowEngineService(db);
        var context = new FellowContextService(db);
        var documents = new StubFellowshipDocumentGenerationService();
        var pendingQuery = new WorkflowPendingQueryService(db, new WorkflowDefinitionService(db));
        var userDepartment = new API.Tests.Procurement.StubUserDepartmentProvider();
        var instituteWideScope = new InstituteWideScopeResolver(db, userDepartment);

        return new Fixture(
            db,
            new FellowshipService(db, context, workflow, documents,
                new API.Tests.Procurement.StubFacultyProfileProvider(),
                pendingQuery, userDepartment),
            new LeaveService(db, context, workflow, pendingQuery, userDepartment, instituteWideScope),
            documents,
            workflow, piUserId, fellowUserId, appointmentId, projectId);
    }

    private static void AddHraSlip(Fixture f)
    {
        f.Db.Documents.Add(new Document
        {
            Id = Guid.NewGuid(),
            OwnerType = "FellowAppointment",
            OwnerId = f.AppointmentId,
            Kind = DocumentKind.HraSlip,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = "x.pdf",
            UploadedByUserId = f.FellowUserId,
            UploadedAt = DateTimeOffset.UtcNow,
        });
        f.Db.SaveChanges();
    }

    private static RaiseClaimInput Claim(
        int month = 3, bool hra = false, int leaveDays = 0, int absence = 0) =>
        new(2026, month, hra, leaveDays, absence, "Monthly claim.", "21st-20th");


    // ------------------------------------------------------------- ID card gate

    [Fact]
    public async Task RaiseClaim_WithoutIdCard_Throws()
    {
        var f = Create(withIdCard: false);

        var act = () => f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        await act.Should().ThrowAsync<IdCardNotIssuedException>();
    }

    // ------------------------------------------------------------- Claims

    [Fact]
    public async Task RaiseClaim_WithNullRemarks_Throws()
    {
        var f = Create();
        var input = new RaiseClaimInput(2026, 9, false, 0, 0, Remarks: null);

        var act = () => f.Fellowship.RaiseClaimAsync(input, f.FellowUserId);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*");
    }

    [Fact]
    public async Task RaiseClaim_WithRemarks_Succeeds()
    {
        var f = Create();
        var input = new RaiseClaimInput(2026, 9, false, 0, 0, Remarks: "Regular monthly claim.");

        var claimId = await f.Fellowship.RaiseClaimAsync(input, f.FellowUserId);

        claimId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task RaiseClaim_ProjectHasDaAssigned_NewInstanceAssignedToDaUser()
    {
        var f = Create();
        var daUserId = Guid.NewGuid();
        var project = await f.Db.Projects.FirstAsync(p => p.Id == f.ProjectId);
        project.CurrentDaUserId = daUserId;
        await f.Db.SaveChangesAsync();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var saved = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.AssignedToUserId.Should().Be(daUserId);
        instance.IsAssignedViaProjectDa.Should().BeTrue();
    }

    [Fact]
    public async Task RaiseClaim_ProjectHasNoDa_NewInstanceUnassigned()
    {
        var f = Create();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var saved = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == saved.WorkflowInstanceId);
        instance.AssignedToUserId.Should().BeNull();
        instance.IsAssignedViaProjectDa.Should().BeFalse();
    }

    [Fact]
    public async Task RaiseClaim_ComputesHraAtTwentyPercent()
    {
        var f = Create();
        AddHraSlip(f);

        var id = await f.Fellowship.RaiseClaimAsync(Claim(hra: true), f.FellowUserId);

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == id);
        claim.FellowshipAmount.Should().Be(37_000m);
        claim.HraAmount.Should().Be(7_400m);
        claim.TotalAmount.Should().Be(44_400m);
    }

    [Fact]
    public async Task RaiseClaim_WithoutClaimingHra_HasNoHraComponent()
    {
        var f = Create();

        var id = await f.Fellowship.RaiseClaimAsync(Claim(hra: false), f.FellowUserId);

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == id);
        claim.HraAmount.Should().Be(0m);
        claim.TotalAmount.Should().Be(37_000m);
    }

    /// <summary>BRD A3: the slip is mandatory to claim the HRA component.</summary>
    [Fact]
    public async Task RaiseClaim_ClaimingHraWithoutASlip_Throws()
    {
        var f = Create();

        var act = () => f.Fellowship.RaiseClaimAsync(Claim(hra: true), f.FellowUserId);

        await act.Should().ThrowAsync<HraSlipRequiredException>();
    }

    [Fact]
    public async Task RaiseClaim_TwiceForTheSameMonth_Throws()
    {
        var f = Create();
        await f.Fellowship.RaiseClaimAsync(Claim(month: 3), f.FellowUserId);

        var act = () => f.Fellowship.RaiseClaimAsync(Claim(month: 3), f.FellowUserId);

        await act.Should().ThrowAsync<DuplicateClaimException>();
    }

    [Fact]
    public async Task RaiseClaim_ForADifferentMonth_Succeeds()
    {
        var f = Create();
        await f.Fellowship.RaiseClaimAsync(Claim(month: 3), f.FellowUserId);

        var id = await f.Fellowship.RaiseClaimAsync(Claim(month: 4), f.FellowUserId);

        id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task RaiseClaim_OutsideTheTenure_Throws()
    {
        var f = Create();

        // The appointment runs Jan-Dec 2026; 2027 is outside it.
        var act = () => f.Fellowship.RaiseClaimAsync(
            new RaiseClaimInput(2027, 3, false, 0, 0, "Out of tenure claim.", "21st-20th"), f.FellowUserId);


        await act.Should().ThrowAsync<ClaimOutsideTenureException>();
    }

    /// <summary>
    /// Spec D2: legacy prints leave figures beside a human-entered amount and no
    /// code reduces the pay. This asserts the portal does not either.
    /// </summary>
    [Fact]
    public async Task RaiseClaim_LeaveAndAbsenceDaysDoNotChangeTheTotal()
    {
        var f = Create();

        var withoutLeave = await f.Fellowship.RaiseClaimAsync(
            Claim(month: 3, leaveDays: 0, absence: 0), f.FellowUserId);
        var withLeave = await f.Fellowship.RaiseClaimAsync(
            Claim(month: 4, leaveDays: 12, absence: 5), f.FellowUserId);

        var a = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == withoutLeave);
        var b = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == withLeave);

        b.TotalAmount.Should().Be(a.TotalAmount);
        b.LeaveDaysTakenThisMonth.Should().Be(12);
        b.UnauthorisedAbsenceDays.Should().Be(5);
    }

    // ------------------------------------------------------------- HRA override

    [Fact]
    public async Task OverrideHra_AsDean_AppliesAndRecordsProvenance()
    {
        var f = Create();
        AddHraSlip(f);
        var id = await f.Fellowship.RaiseClaimAsync(Claim(hra: true), f.FellowUserId);
        var dean = Guid.NewGuid();

        await f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 9_000m, "Sanctioned at a higher rate"), dean, ["Dean"]);

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == id);
        claim.HraAmount.Should().Be(9_000m);
        claim.TotalAmount.Should().Be(46_000m);
        claim.HraOverrideReason.Should().Be("Sanctioned at a higher rate");
        claim.HraOverriddenByUserId.Should().Be(dean);
        claim.HraOverriddenAt.Should().NotBeNull();
    }

    [Fact]
    public async Task OverrideHra_AsDirector_IsPermitted()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 5_000m, "Director decision"), Guid.NewGuid(), ["Director"]);

        await act.Should().NotThrowAsync();
    }

    [Theory]
    [InlineData("Faculty")]
    [InlineData("RegularStaff")]
    [InlineData("Fellow")]
    public async Task OverrideHra_WithoutTheDeanOrDirectorRole_Throws(string role)
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 9_000m, "Because"), Guid.NewGuid(), [role]);

        await act.Should().ThrowAsync<HraOverrideNotPermittedException>();
    }

    [Fact]
    public async Task OverrideHra_WithoutAReason_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 9_000m, "   "), Guid.NewGuid(), ["Dean"]);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*reason*");
    }

    /// <summary>Changing a settled amount should mean a fresh claim, not an edit.</summary>
    [Fact]
    public async Task OverrideHra_AfterApproval_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        // Fellowship's own PI -> HOD -> Dean chain, not the generic indent
        // route DriveToApprovedAsync drives -- FellowshipWorkflowSeeder gives
        // FellowshipClaim its own route, so a claim never visits
        // UploadSignedCopy/Assign/Forward at all.
        await f.Fellowship.ApproveAsync(id, f.PiUserId, ["Faculty"], null);
        await f.Fellowship.ApproveAsync(id, Guid.NewGuid(), ["HOD"], null);
        await f.Fellowship.ApproveAsync(id, Guid.NewGuid(), ["Dean"], null);

        var act = () => f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 9_000m, "Too late"), Guid.NewGuid(), ["Dean"]);

        await act.Should().ThrowAsync<HraOverrideAfterApprovalException>();
    }

    [Fact]
    public async Task OverrideHra_NegativeAmount_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, -1m, "Nonsense"), Guid.NewGuid(), ["Dean"]);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    /// <summary>
    /// The sanctioned figure travels with the summary so an approver can see when
    /// the computed 20% disagrees with it (spec D1).
    /// </summary>
    [Fact]
    public async Task ClaimSummary_CarriesTheSanctionedHraForComparison()
    {
        var f = Create(stipend: 40_000m, sanctionedHra: 5_000m);
        await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var claims = await f.Fellowship.ListOwnClaimsAsync(f.FellowUserId);

        var summary = claims.Single();
        summary.SanctionedHra.Should().Be(5_000m);
        summary.HraIsOverridden.Should().BeFalse();
    }

    // ------------------------------------------------------------- Scoping

    [Fact]
    public async Task ListOwnClaims_ReturnsOnlyTheCallersClaims()
    {
        var f = Create();
        await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var otherFellow = Guid.NewGuid();
        var claims = await f.Fellowship.ListOwnClaimsAsync(otherFellow);

        claims.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_ByAnUnrelatedUser_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.GetAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Get_ByTheOwningPi_Succeeds()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var summary = await f.Fellowship.GetAsync(id, f.PiUserId);

        summary.Id.Should().Be(id);
    }

    [Fact]
    public async Task Get_ByADaWithNoClaimRelation_WithoutOfficeRole_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.GetAsync(id, Guid.NewGuid(), actorRoles: ["Faculty"]);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Theory]
    [InlineData("RegularStaff")]
    [InlineData("Superintendent")]
    [InlineData("DeputyRegistrar")]
    [InlineData("Dean")]
    public async Task Get_ByAnOfficeRole_SucceedsEvenWithoutClaimRelation(string officeRole)
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var summary = await f.Fellowship.GetAsync(id, Guid.NewGuid(), actorRoles: [officeRole]);

        summary.Id.Should().Be(id);
    }

    [Fact]
    public async Task RecommendAmount_IsStoredWithoutAlteringTheClaimTotal()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        await f.Fellowship.RecommendAmountAsync(
            new RecommendAmountInput(id, 30_000m, null, null, "Two days unauthorised absence"), f.PiUserId, ["Faculty"]);

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == id);
        claim.RecommendedAmount.Should().Be(30_000m);
        claim.TotalAmount.Should().Be(37_000m, "the computed entitlement is unchanged");
    }

    // ------------------------------------------------------------- Stipend form

    /// <summary>
    /// The D2 guarantee at the document level: the form carries the leave
    /// figures, and the amount printed beside them is the computed entitlement,
    /// not something reduced by them.
    /// </summary>
    [Fact]
    public async Task StipendForm_PrintsLeaveFiguresWithoutReducingTheAmount()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(
            Claim(month: 3, leaveDays: 8, absence: 3), f.FellowUserId);

        var document = await f.Fellowship.GenerateStipendFormAsync(id, f.FellowUserId);

        document.Content.Should().NotBeEmpty();
        document.FileName.Should().Contain("stipend-form-2026-03");

        var model = f.Documents.Generated.Single();
        model.UnauthorisedAbsenceDays.Should().Be(3);
        model.TotalAmount.Should().Be(37_000m, "leave never reduces the computed amount");
        model.RecommendedAmount.Should().BeNull("the PI has not entered one yet");
    }

    [Fact]
    public async Task StipendForm_NotesAnHraOverrideAndItsReason()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.OverrideHraAsync(
            new OverrideHraInput(id, 9_000m, "Sanctioned at a higher rate"),
            Guid.NewGuid(), ["Dean"]);

        await f.Fellowship.GenerateStipendFormAsync(id, f.FellowUserId);

        var model = f.Documents.Generated.Single();
        model.HraIsOverridden.Should().BeTrue();
        model.HraOverrideReason.Should().Be("Sanctioned at a higher rate");
        model.HraAmount.Should().Be(9_000m);
    }

    [Fact]
    public async Task StipendForm_ForAnUnrelatedUser_Throws()
    {
        var f = Create();
        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var act = () => f.Fellowship.GenerateStipendFormAsync(id, Guid.NewGuid());

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    /// <summary>
    /// Task 5 regression: GenerateStipendFormAsync's TotalFundReceived and
    /// ManpowerHeadFund figures are "money received" totals, so only an
    /// Approved GrantReceipt may count toward them -- a PendingApproval
    /// receipt must be excluded even though the row exists.
    /// </summary>
    [Fact]
    public async Task StipendForm_OnlyCountsApprovedGrantReceiptsTowardFundsReceived()
    {
        var f = Create();
        var manpowerHeadId = Guid.NewGuid();
        var otherHeadId = Guid.NewGuid();
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = manpowerHeadId,
            ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringManpower,
            Year1Amount = 500_000m,
            Total = 500_000m,
        });
        f.Db.BudgetHeads.Add(new BudgetHead
        {
            Id = otherHeadId,
            ProjectId = f.ProjectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 100_000m,
            Total = 100_000m,
        });
        f.Db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = f.ProjectId,
            BudgetHeadId = manpowerHeadId,
            Type = GrantReceiptType.Head,
            ReceivedDate = new DateOnly(2026, 1, 1),
            Amount = 200_000m,
            Status = GrantReceiptStatus.Approved,
        });
        f.Db.GrantReceipts.Add(new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = f.ProjectId,
            BudgetHeadId = manpowerHeadId,
            Type = GrantReceiptType.Head,
            ReceivedDate = new DateOnly(2026, 1, 15),
            Amount = 90_000m,
            Status = GrantReceiptStatus.PendingApproval,
        });
        await f.Db.SaveChangesAsync();

        var id = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.GenerateStipendFormAsync(id, f.FellowUserId);

        var model = f.Documents.Generated.Single();
        // Only the 200,000 Approved row counts; the 90,000 PendingApproval
        // row must be excluded from both totals.
        model.TotalFundReceived.Should().Be(200_000m);
        model.ManpowerHeadFund.Should().Be(200_000m);
    }

    private static async Task DriveToApprovedAsync(Fixture f, Guid workflowInstanceId)
    {
        var actor = f.PiUserId;
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, Raiser, null);
        await f.Workflow.AssignAsync(workflowInstanceId, actor, actor, Dean, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, Office, null);
        await f.Workflow.ApproveAsync(workflowInstanceId, actor, Dean, null);
    }

    // ------------------------------------------------------------- Approval Workflow: PI → HOD → Dean

    /// <summary>
    /// Fellowship claim approval workflow follows BRD A3:
    /// 1. Fellow raises claim (Raised stage)
    /// 2. PI forwards to HOD (WithPIFellowship → WithHODFellowship)
    /// 3. HOD can approve → forward to Dean, reject, or return to PI
    /// 4. Dean can approve → Approved, reject, or return to PI
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_HappyPath_FellowToApproved()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        // Fellow raises claim -- FellowshipWorkflowSeeder marks
        // WithPIFellowship (not the generic Raised) as this route's initial
        // stage, and RaiseAsync resolves the instance's starting stage from
        // the route rather than hardcoding it.
        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var workflowId = claim.WorkflowInstanceId;

        var instance = await f.Workflow.GetAsync(workflowId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);

        // PI approves and forwards to HOD
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], "Reviewed and approved");
        instance = await f.Workflow.GetAsync(workflowId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithHODFellowship);

        // HOD approves and forwards to Dean
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], "Looks good");
        instance = await f.Workflow.GetAsync(workflowId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithDeanFellowship);

        // Dean approves (terminal)
        await f.Fellowship.ApproveAsync(claimId, deanUserId, ["Dean"], "Final approval");
        instance = await f.Workflow.GetAsync(workflowId);
        instance.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    /// <summary>
    /// PI can approve and reject, but not return (no return to fellow option for PI).
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_PI_CanApproveOrReject()
    {
        var f = Create();
        var piUserId = f.PiUserId;

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // PI should be able to approve
        var act = () => f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await act.Should().NotThrowAsync();

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithHODFellowship);
    }

    [Fact]
    public async Task ApprovalWorkflow_PI_CanReject()
    {
        var f = Create();
        var piUserId = f.PiUserId;

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // PI should be able to reject
        await f.Fellowship.RejectAsync(claimId, piUserId, ["Faculty"], "Issues with submission");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Rejected);
    }

    [Fact]
    public async Task ApprovalWorkflow_PI_Reject_RequiresRemarks()
    {
        var f = Create();
        var piUserId = f.PiUserId;

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // Reject without remarks should fail
        var act = () => f.Fellowship.RejectAsync(claimId, piUserId, ["Faculty"], "");
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*remark*");
    }

    [Fact]
    public async Task ApprovalWorkflow_PI_ApproveFailsFromWrongStage()
    {
        var f = Create();
        var piUserId = f.PiUserId;

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // First approve to move to HOD stage
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // Second approve should fail because claim is now at WithHODFellowship
        var act = () => f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*Cannot approve from stage*");
    }

    /// <summary>
    /// HOD can approve, reject, or return (all require valid remarks for reject/return).
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_HOD_Approve_MovesToDean()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // HOD approves
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], "Approved by HOD");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithDeanFellowship);
    }

    [Fact]
    public async Task ApprovalWorkflow_HOD_Reject_TerminalState()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // HOD rejects
        await f.Fellowship.RejectAsync(claimId, hodUserId, ["HOD"], "Issues with documentation");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Rejected);
    }

    [Fact]
    public async Task ApprovalWorkflow_HOD_Reject_RequiresRemarks()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // Reject without remarks should fail
        var act = () => f.Fellowship.RejectAsync(claimId, hodUserId, ["HOD"], "");
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*remark*");
    }

    [Fact]
    public async Task ApprovalWorkflow_HOD_Return_SendsBackToPI()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // HOD returns to PI -- ReturnAsync (the shared engine method) re-enters
        // at the route's ResubmitEntrySequence directly, matching
        // ApproveAsync's own doc comment ("Return: moves back to
        // WithPIFellowship (PI must re-forward)"). ReturnedByHODToPI exists as
        // a WorkflowStage value but nothing sets CurrentStage to it.
        await f.Fellowship.ReturnAsync(claimId, hodUserId, ["HOD"], "Please revise and resubmit");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);
    }

    [Fact]
    public async Task ApprovalWorkflow_HOD_Return_RequiresRemarks()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);

        // Return without remarks should fail
        var act = () => f.Fellowship.ReturnAsync(claimId, hodUserId, ["HOD"], "   ");
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*remark*");
    }

    /// <summary>
    /// Dean can approve, reject, or return (same as HOD).
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_Dean_Approve_TerminalApproved()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);

        // Dean approves
        await f.Fellowship.ApproveAsync(claimId, deanUserId, ["Dean"], "Approved");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    [Fact]
    public async Task ApprovalWorkflow_Dean_Reject_TerminalRejected()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);

        // Dean rejects
        await f.Fellowship.RejectAsync(claimId, deanUserId, ["Dean"], "Does not meet criteria");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Rejected);
    }

    [Fact]
    public async Task ApprovalWorkflow_Dean_Return_SendsBackToPI()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);

        // Dean returns to PI -- see ApprovalWorkflow_HOD_Return_SendsBackToPI's
        // comment: ReturnAsync re-enters at WithPIFellowship directly.
        await f.Fellowship.ReturnAsync(claimId, deanUserId, ["Dean"], "Need more supporting docs");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);
    }

    /// <summary>
    /// When a claim is returned to PI by HOD or Dean, they can re-approve and resubmit it.
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_ReturnedClaim_PICanResubmit()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // First round: PI approves, HOD approves, Dean returns
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);
        await f.Fellowship.ReturnAsync(claimId, deanUserId, ["Dean"], "Needs revision");

        var claim = await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId);
        var instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        // ReturnAsync re-enters at WithPIFellowship directly -- also the only
        // stage (besides the legacy Raised) ApproveAsync's own guard
        // accepts, which the next resubmit call below relies on.
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);

        // PI re-approves the claim (resubmission)
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], "Revised and resubmitted");
        instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithHODFellowship);

        // HOD approves again, Dean approves
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);
        instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithDeanFellowship);

        await f.Fellowship.ApproveAsync(claimId, deanUserId, ["Dean"], "Now approved");
        instance = await f.Workflow.GetAsync(claim.WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    /// <summary>
    /// HOD can return directly from WithHODFellowship, and Dean can return directly from WithDeanFellowship.
    /// Both lead back to PI (WithPIFellowship via re-entry point).
    /// PI then resubmits by approving again.
    /// </summary>
    [Fact]
    public async Task ApprovalWorkflow_MultipleReturns_CanHappenAtEachStage()
    {
        var f = Create();
        var piUserId = f.PiUserId;
        var hodUserId = Guid.NewGuid();
        var deanUserId = Guid.NewGuid();

        var claimId = await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);
        
        // Round 1: HOD returns
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        await f.Fellowship.ReturnAsync(claimId, hodUserId, ["HOD"], "First return from HOD");
        var instance = await f.Workflow.GetAsync((await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId)).WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);

        // PI resubmits
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        instance = await f.Workflow.GetAsync((await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId)).WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithHODFellowship);

        // Round 2: HOD approves, Dean returns
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);
        await f.Fellowship.ReturnAsync(claimId, deanUserId, ["Dean"], "First return from Dean");
        instance = await f.Workflow.GetAsync((await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId)).WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithPIFellowship);

        // PI resubmits again
        await f.Fellowship.ApproveAsync(claimId, piUserId, ["Faculty"], null);
        instance = await f.Workflow.GetAsync((await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId)).WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.WithHODFellowship);

        // Finally approved
        await f.Fellowship.ApproveAsync(claimId, hodUserId, ["HOD"], null);
        await f.Fellowship.ApproveAsync(claimId, deanUserId, ["Dean"], "Finally approved");
        instance = await f.Workflow.GetAsync((await f.Db.FellowshipClaims.FirstAsync(c => c.Id == claimId)).WorkflowInstanceId);
        instance.CurrentStage.Should().Be(WorkflowStage.Approved);
    }

    // --------------------------------------------------------- ProjectId on summaries

    [Fact]
    public async Task ListAllClaimsAsync_IncludesProjectId()
    {
        var f = Create();
        await f.Fellowship.RaiseClaimAsync(Claim(), f.FellowUserId);

        var summaries = await f.Fellowship.ListAllClaimsAsync();

        Assert.Single(summaries);
        Assert.Equal(f.ProjectId, summaries[0].ProjectId);
    }
}
