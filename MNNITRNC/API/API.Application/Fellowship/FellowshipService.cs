using API.Application.Access;
using API.Application.Common;
using API.Application.Procurement;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Fellowship;

/// <summary>
/// Monthly fellowship claims (BRD A3), equivalent to legacy's
/// <c>stipend_recommendations</c>.
/// </summary>
public class FellowshipService(
    IApplicationDbContext db,
    IFellowContextService fellowContext,
    IWorkflowEngineService workflowEngine,
    IFellowshipDocumentGenerationService documents,
    IFacultyProfileProvider facultyProfiles,
    IWorkflowPendingQueryService pendingQuery,
    IUserDepartmentProvider userDepartment) : IFellowshipService
{
    private static readonly string[] HraOverrideRoles = ["Dean", "Director"];

    // The four office roles with institute-wide access to Approved,
    // unvouchered claims via ListReadyToVoucherClaimsAsync, bulk-action,
    // and create-voucher -- also allowed to read any single claim by id
    // (GetAsync) so the voucher/noting-selection pages can populate a
    // claim's own display fields regardless of who raised it.
    private static readonly string[] OfficeVoucherRoles =
        ["RegularStaff", "Superintendent", "DeputyRegistrar", "Dean"];

    public async Task<Guid> RaiseClaimAsync(
        RaiseClaimInput input, Guid fellowUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when raising a fellowship claim.");
        }

        var appointment = await fellowContext.RequireActiveFellowAsync(fellowUserId, ct);

        if (input.ClaimMonth is < 1 or > 12)
        {
            throw new ArgumentException("Claim month must be between 1 and 12.", nameof(input));
        }

        if (input.LeaveDaysTakenThisMonth < 0 || input.UnauthorisedAbsenceDays < 0)
        {
            throw new ArgumentException("Leave and absence days cannot be negative.", nameof(input));
        }

        // The claimed month must fall inside the appointment. Comparing the
        // month's endpoints rather than a single date, so a fellow joining
        // mid-month can still claim that month.
        var monthStart = new DateOnly(input.ClaimYear, input.ClaimMonth, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        if (monthEnd < appointment.JoinedOn || monthStart > appointment.ValidTill)
        {
            throw new ClaimOutsideTenureException(input.ClaimYear, input.ClaimMonth);
        }

        var duplicate = await db.FellowshipClaims
            .Where(c => c.FellowAppointmentId == appointment.Id
                     && c.ClaimYear == input.ClaimYear
                     && c.ClaimMonth == input.ClaimMonth)
            .FirstOrDefaultAsync(ct);

        if (duplicate is not null)
        {
            // Only block if the existing claim is still active (not rejected/terminal)
            var existingInstance = await db.WorkflowInstances
                .FirstOrDefaultAsync(w => w.Id == duplicate.WorkflowInstanceId, ct);

            // If the previous claim is NOT in a terminal state (Rejected/Approved),
            // block the new claim. Otherwise allow re-submission.
            if (existingInstance is not null && existingInstance.CurrentStage != WorkflowStage.Rejected)
            {
                throw new DuplicateClaimException(input.ClaimYear, input.ClaimMonth);
            }
        }

        // BRD A3: the slip is mandatory to claim the HRA component.
        // Since slips are now monthly and attached to the claim itself,
        // we rely on the UI to upload them immediately after claim creation.

        var position = await db.SanctionedManpowerPositions
            .FirstAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct);

        // Cap the recommended stipend to the sanctioned stipend unless a custom amount is explicitly provided (e.g. for Arrears)
        var fellowshipAmount = (input.FellowshipAmount.HasValue && input.FellowshipAmount.Value > 0)
            ? input.FellowshipAmount.Value
            : (appointment.RecommendedStipend > 0 
                ? Math.Min(appointment.RecommendedStipend, position.Stipend) 
                : position.Stipend);

        var defaultHra = position.Hra > 0 ? position.Hra : Math.Round(fellowshipAmount * 0.20m, 2);

        var hraAmount = (input.HraAmount.HasValue && input.HraAmount.Value > 0)
            ? input.HraAmount.Value
            : (input.HraClaimed ? defaultHra : 0m);

        var claimTypeStr = string.IsNullOrWhiteSpace(input.ClaimType) ? "Claim for Month" : input.ClaimType;

        var claim = new FellowshipClaim
        {
            Id = Guid.NewGuid(),
            FellowAppointmentId = appointment.Id,
            ClaimYear = input.ClaimYear,
            ClaimMonth = input.ClaimMonth,
            ClaimPeriod = string.IsNullOrWhiteSpace(input.ClaimPeriod) ? "21st-20th" : input.ClaimPeriod,
            ClaimType = claimTypeStr,
            FellowshipAmount = fellowshipAmount,
            HraAmount = hraAmount,
            HraClaimed = input.HraClaimed || hraAmount > 0,
            TotalAmount = fellowshipAmount + hraAmount,

            // Reported only. Nothing below multiplies or subtracts these -- the
            // deduction, if any, is the approver's decision (spec D2).
            LeaveDaysTakenThisMonth = input.LeaveDaysTakenThisMonth,
            UnauthorisedAbsenceDays = input.UnauthorisedAbsenceDays,

            Remarks = input.Remarks,
            CreatedAt = DateTimeOffset.UtcNow,
        };


        db.FellowshipClaims.Add(claim);
        await db.SaveChangesAsync(ct);

        var instance = await workflowEngine.RaiseAsync(
            RequestType.FellowshipClaim, claim.Id, WorkflowPhase.Indent, fellowUserId, ct);

        // Permanent per-project Dealing Assistant: the claim's project is
        // reached via appointment -> sanctioned position -> ProjectId.
        var project = await db.Projects
            .Where(p => p.Id == position.ProjectId)
            .Select(p => new { p.CurrentDaUserId })
            .FirstOrDefaultAsync(ct);
        if (project?.CurrentDaUserId is { } daUserId)
        {
            instance.AssignedToUserId = daUserId;
            instance.IsAssignedViaProjectDa = true;
        }

        claim.WorkflowInstanceId = instance.Id;
        await db.SaveChangesAsync(ct);

        return claim.Id;
    }

    /// <summary>
    /// Edit a rejected fellowship claim to resubmit it. The fellow can update
    /// leave days, HRA claim status, and remarks, then re-enter the workflow.
    /// </summary>
    public async Task EditRejectedClaimAsync(
        EditRejectedClaimInput input, Guid fellowUserId, CancellationToken ct = default)
    {
        var claim = await db.FellowshipClaims
            .FirstOrDefaultAsync(c => c.Id == input.ClaimId, ct);

        if (claim is null)
        {
            throw new ArgumentException("Claim not found.", nameof(input));
        }

        // Verify the fellow owns this claim (verify appointment belongs to the fellow)
        var appointment = await db.ManpowerSelections
            .Include(s => s.Candidate)
            .FirstOrDefaultAsync(s => s.Id == claim.FellowAppointmentId, ct);

        if (appointment?.Candidate?.ApplicationUserId != fellowUserId)
        {
            throw new UnauthorizedAccessException(
                "This fellowship claim does not belong to the requesting fellow.");
        }

        // Verify it's in rejected state
        var instance = await db.WorkflowInstances
            .FirstOrDefaultAsync(w => w.Id == claim.WorkflowInstanceId, ct);

        if (instance?.CurrentStage != WorkflowStage.Rejected)
        {
            throw new InvalidOperationException("Only rejected claims can be edited.");
        }

        // Validate input
        if (input.LeaveDaysTakenThisMonth < 0 || input.UnauthorisedAbsenceDays < 0)
        {
            throw new ArgumentException("Leave and absence days cannot be negative.", nameof(input));
        }

        // Slips are monthly and attached to the claim, so the UI will
        // handle uploading the document against the claim ID.

        // Update the claim
        claim.HraClaimed = input.HraClaimed;
        claim.LeaveDaysTakenThisMonth = input.LeaveDaysTakenThisMonth;
        claim.UnauthorisedAbsenceDays = input.UnauthorisedAbsenceDays;
        claim.Remarks = input.Remarks;

        // Recalculate HRA amount
        var position = await db.SanctionedManpowerPositions
            .FirstAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct);
        
        var fellowshipAmount = claim.FellowshipAmount; // Use existing fellowship amount
        var hraAmount = input.HraClaimed ? position.Hra : 0m;
        claim.HraAmount = hraAmount;
        claim.TotalAmount = fellowshipAmount + hraAmount;

        // Reset workflow to initial stage so it goes through approval again
        instance.CurrentStage = WorkflowStage.WithPIFellowship;

        await db.SaveChangesAsync(ct);
    }

    public async Task OverrideHraAsync(
        OverrideHraInput input, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        CancellationToken ct = default)
    {
        // A pay-affecting privilege, so the role check comes first and is not
        // inferable from anything else the caller can do.
        if (!actorRoles.Any(r => HraOverrideRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
        {
            throw new HraOverrideNotPermittedException();
        }

        if (string.IsNullOrWhiteSpace(input.Reason))
        {
            throw new ArgumentException(
                "An HRA override requires a reason.", nameof(input));
        }

        if (input.HraAmount < 0m)
        {
            throw new ArgumentException("The HRA amount cannot be negative.", nameof(input));
        }

        var claim = await GetClaimByIdAsync(input.ClaimId, ct)
            ?? throw new FellowshipClaimNotFoundException(input.ClaimId);

        // Changing a settled amount should mean a fresh claim, not an edit to
        // one that has already been approved for payment.
        var instance = await workflowEngine.GetAsync(claim.WorkflowInstanceId, ct);
        if (instance?.CurrentStage == WorkflowStage.Approved)
        {
            throw new HraOverrideAfterApprovalException(claim.Id);
        }

        claim.HraOverrideAmount = input.HraAmount;
        claim.HraOverrideReason = input.Reason.Trim();
        claim.HraOverriddenByUserId = actorUserId;
        claim.HraOverriddenAt = DateTimeOffset.UtcNow;

        claim.HraAmount = input.HraAmount;
        claim.TotalAmount = claim.FellowshipAmount + claim.HraAmount;

        await db.SaveChangesAsync(ct);
    }

    public async Task RecommendAmountAsync(
        RecommendAmountInput input, Guid piUserId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        if (input.RecommendedAmount < 0m)
        {
            throw new ArgumentException(
                "The recommended amount cannot be negative.", nameof(input));
        }

        var claim = await GetClaimByIdAsync(input.ClaimId, ct)
            ?? throw new FellowshipClaimNotFoundException(input.ClaimId);

        var isApprover = roles.Any(r => r == "HOD" || r == "Dean" || r == "Director" || r == "SuperAdmin" || r == "RegularStaff" || r == "Superintendent" || r == "DeputyRegistrar");
        if (!isApprover)
        {
            await RequirePiOwnsClaimAsync(claim, piUserId, ct);
        }

        claim.RecommendedAmount = input.RecommendedAmount;
        if (input.LeaveDaysTakenThisMonth.HasValue)
        {
            claim.LeaveDaysTakenThisMonth = input.LeaveDaysTakenThisMonth.Value;
        }
        if (input.UnauthorisedAbsenceDays.HasValue)
        {
            claim.UnauthorisedAbsenceDays = input.UnauthorisedAbsenceDays.Value;
        }
        if (!string.IsNullOrWhiteSpace(input.Remarks))
        {
            claim.Remarks = input.Remarks;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveAsync(Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var claim = await GetClaimByIdAsync(claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        var instance = await workflowEngine.GetAsync(claim.WorkflowInstanceId, ct)
            ?? throw new InvalidOperationException($"Workflow instance '{claim.WorkflowInstanceId}' not found.");

        if (instance.CurrentStage == WorkflowStage.WithPIFellowship || instance.CurrentStage == WorkflowStage.Raised)
        {
            await RequirePiOwnsClaimAsync(claim, actorUserId, ct);
        }

        await MigrateToFellowshipStageIfLegacyAsync(instance, HodLegacyStages, WorkflowStage.WithHODFellowship, ct);
        await MigrateToFellowshipStageIfLegacyAsync(instance, DeanLegacyStages, WorkflowStage.WithDeanFellowship, ct);

        await workflowEngine.ApproveAsync(claim.WorkflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task RejectAsync(Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string remarks, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new ArgumentException("Rejection requires a remark.", nameof(remarks));
        }

        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        var instance = await workflowEngine.GetAsync(claim.WorkflowInstanceId, ct)
            ?? throw new InvalidOperationException($"Workflow instance '{claim.WorkflowInstanceId}' not found.");

        if (instance.CurrentStage == WorkflowStage.WithPIFellowship || instance.CurrentStage == WorkflowStage.Raised)
        {
            await RequirePiOwnsClaimAsync(claim, actorUserId, ct);
        }

        await MigrateToFellowshipStageIfLegacyAsync(instance, HodLegacyStages, WorkflowStage.WithHODFellowship, ct);
        await MigrateToFellowshipStageIfLegacyAsync(instance, DeanLegacyStages, WorkflowStage.WithDeanFellowship, ct);

        await workflowEngine.RejectAsync(claim.WorkflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task CancelAsync(Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string remarks, CancellationToken ct = default)
    {
        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        await workflowEngine.CancelAsync(claim.WorkflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ReturnAsync(Guid claimId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string remarks, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new ArgumentException("Returning a claim requires a remark.", nameof(remarks));
        }

        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        var instance = await workflowEngine.GetAsync(claim.WorkflowInstanceId, ct)
            ?? throw new InvalidOperationException($"Workflow instance '{claim.WorkflowInstanceId}' not found.");

        await MigrateToFellowshipStageIfLegacyAsync(instance, HodLegacyStages, WorkflowStage.WithHODFellowship, ct);
        await MigrateToFellowshipStageIfLegacyAsync(instance, DeanLegacyStages, WorkflowStage.WithDeanFellowship, ct);

        await workflowEngine.ReturnAsync(claim.WorkflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task BulkActOnClaimsAsync(
        IReadOnlyCollection<Guid> claimIds, FellowshipClaimBulkAction action,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        if (claimIds.Count == 0)
        {
            throw new ArgumentException("At least one claim id is required.", nameof(claimIds));
        }

        // Real transaction on a relational provider (MySQL in production).
        // The in-memory provider used by the test suite does not support
        // transactions -- BeginTransactionAsync throws there -- so tests
        // exercise the same loop without DB-level atomicity; matches
        // ProjectService.BulkActOnGrantReceiptsAsync's own documented
        // reasoning exactly.
        var useTransaction = db.Database.IsRelational();
        var transaction = useTransaction ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            foreach (var claimId in claimIds)
            {
                switch (action)
                {
                    case FellowshipClaimBulkAction.Approve:
                        await ApproveAsync(claimId, actorUserId, actorRoles, remarks, ct);
                        break;
                    case FellowshipClaimBulkAction.Reject:
                        await RejectAsync(claimId, actorUserId, actorRoles, remarks ?? "", ct);
                        break;
                    case FellowshipClaimBulkAction.Return:
                        await ReturnAsync(claimId, actorUserId, actorRoles, remarks ?? "", ct);
                        break;
                }
            }

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private static readonly WorkflowStage[] HodLegacyStages =
    [
        WorkflowStage.SignedCopyUploaded,
        WorkflowStage.Assigned,
        WorkflowStage.Forwarded,
        WorkflowStage.ForwardedOSRC,
    ];

    private static readonly WorkflowStage[] DeanLegacyStages =
    [
        WorkflowStage.ForwardedDR,
        WorkflowStage.Director,
    ];

    private async Task MigrateToFellowshipStageIfLegacyAsync(
        WorkflowInstance instance,
        WorkflowStage[] legacyStages,
        WorkflowStage targetStage,
        CancellationToken ct)
    {
        if (legacyStages.Contains(instance.CurrentStage))
        {
            instance.CurrentStage = targetStage;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListOwnClaimsAsync(
        Guid fellowUserId, CancellationToken ct = default)
    {
        // Ungated read: a fellow whose card is still pending should see an empty
        // list rather than an error.
        var appointment = await fellowContext.FindAppointmentAsync(fellowUserId, ct);
        if (appointment is null)
        {
            return [];
        }

        var claims = await db.FellowshipClaims
            .Where(c => c.FellowAppointmentId == appointment.Id)
            .OrderByDescending(c => c.ClaimYear).ThenByDescending(c => c.ClaimMonth)
            .ToListAsync(ct);

        // Set default ClaimPeriod for all claims (column is ignored in EF mapping)
        foreach (var claim in claims)
        {
            claim.ClaimPeriod = "21st-20th";
        }

        return await ToSummariesAsync(claims, ct);
    }

    public async Task<FellowshipClaimSummary> GetAsync(
        Guid claimId, Guid requestingUserId,
        IReadOnlyCollection<string>? actorRoles = null, CancellationToken ct = default)
    {
        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        // ClaimPeriod is ignored in EF mapping, so set the default here
        claim.ClaimPeriod = "21st-20th";

        // Readable by the fellow it belongs to, by the PI who owns the
        // project, or by a caller holding one of the four office roles
        // (they already have institute-wide access to this same claim via
        // ListReadyToVoucherClaimsAsync). Anyone else is refused.
        var appointment = await fellowContext.FindAppointmentAsync(requestingUserId, ct);
        if (appointment?.Id != claim.FellowAppointmentId
            && !(actorRoles?.Any(OfficeVoucherRoles.Contains) ?? false))
        {
            await RequirePiOwnsClaimAsync(claim, requestingUserId, ct);
        }

        return (await ToSummariesAsync([claim], ct)).Single();
    }

    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListForProjectAsync(
        Guid projectId, Guid piUserId, CancellationToken ct = default)
    {
        var project = await db.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ArgumentException($"Project '{projectId}' was not found.", nameof(projectId));

        if (project.OwnerUserId != piUserId)
        {
            throw new UnauthorizedAccessException(
                $"Project '{projectId}' does not belong to the requesting user.");
        }

        var positionIds = await db.SanctionedManpowerPositions
            .Where(p => p.ProjectId == projectId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var appointmentIds = await db.ManpowerSelections
            .Where(s => positionIds.Contains(s.SanctionedManpowerPositionId))
            .Select(s => s.Id)
            .ToListAsync(ct);

        var claims = await db.FellowshipClaims
            .Where(c => appointmentIds.Contains(c.FellowAppointmentId))
            .OrderByDescending(c => c.ClaimYear).ThenByDescending(c => c.ClaimMonth)
            .ToListAsync(ct);

        // Set default ClaimPeriod for all claims (column is ignored in EF mapping)
        foreach (var claim in claims)
        {
            claim.ClaimPeriod = "21st-20th";
        }

        return await ToSummariesAsync(claims, ct);
    }

    public async Task<StipendFormModel> GetStipendFormDataAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default)
    {
        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);
            
        var summary = (await ToSummariesAsync([claim], ct)).Single();
        
        // ClaimPeriod is ignored in EF mapping, so set the default here
        claim.ClaimPeriod = "21st-20th";
        var appointment = await db.ManpowerSelections
            .FirstAsync(s => s.Id == claim.FellowAppointmentId, ct);
        var position = await db.SanctionedManpowerPositions
            .FirstAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct);
        var project = await db.Projects.FirstAsync(p => p.Id == position.ProjectId, ct);
        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        var candidate = await db.Candidates
            .FirstOrDefaultAsync(c => c.Id == appointment.CandidateId, ct);

        // Feeds TotalFundReceived and ManpowerHeadFund below -- both are "money
        // received" figures printed on the stipend form, so only Approved
        // receipts should count, same reasoning as every other consumer.
        var receiptsData = await db.GrantReceipts
            .Where(g => g.ProjectId == project.Id)
            .Where(g => g.Status == GrantReceiptStatus.Approved)
            .Select(g => new { g.Amount, g.BudgetHeadId })
            .ToListAsync(ct);

        var manpowerHeadIds = await db.BudgetHeads
            .Where(b => b.ProjectId == project.Id
                     && b.HeadName == BudgetHeadName.RecurringManpower)
            .Select(b => b.Id)
            .ToListAsync(ct);

        // Total leave taken this project year, for line (b) of the form.
        var leaveTaken = await db.LeaveEntitlements
            .Where(e => e.FellowAppointmentId == appointment.Id)
            .SumAsync(e => (int?)e.ConsumedDays, ct) ?? 0;

        var entitlement = await db.LeaveEntitlements
            .Where(e => e.FellowAppointmentId == appointment.Id)
            .SumAsync(e => (int?)e.EntitledDays, ct) ?? 0;

        var periodFrom = new DateOnly(claim.ClaimYear, claim.ClaimMonth, 1);
        var periodTo = periodFrom.AddMonths(1).AddDays(-1);

        return new StipendFormModel(
            candidate?.FullName ?? pi.Name,
            appointment.BankAccountNo,
            appointment.IfscCode,
            candidate?.Mobile,
            candidate?.Email,
            appointment.JoinedOn,
            position.Designation,
            project.ProjectTitle,
            project.SanctionNo,
            project.TotalSanctioned,
            project.StartDate,
            project.StartDate.AddMonths(project.DurationMonths),
            pi.Name,
            pi.Department,
            receiptsData.Sum(r => r.Amount),
            receiptsData.Where(r => manpowerHeadIds.Contains(r.BudgetHeadId)).Sum(r => r.Amount),
            periodFrom,
            periodTo,
            claim.FellowshipAmount,
            claim.HraAmount,
            claim.TotalAmount,
            summary.HraIsOverridden,
            claim.HraOverrideReason,
            entitlement,
            leaveTaken,
            claim.LeaveDaysTakenThisMonth,
            claim.UnauthorisedAbsenceDays,
            claim.RecommendedAmount);

    }

    public async Task<GeneratedFellowshipDocument> GenerateStipendFormAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default)
    {
        var model = await GetStipendFormDataAsync(claimId, requestingUserId, ct);
        var claim = await db.FellowshipClaims.FirstAsync(c => c.Id == claimId, ct);

        var pdf = await documents.GenerateStipendFormAsync(model, ct);

        return new GeneratedFellowshipDocument(
            pdf, $"stipend-form-{claim.ClaimYear}-{claim.ClaimMonth:D2}-{claim.Id}.pdf");
    }

    public async Task<StipendFormModel> GetMyStipendFormDraftAsync(
        Guid fellowUserId, int claimYear, int claimMonth, CancellationToken ct = default)
    {
        var appointment = await fellowContext.RequireActiveFellowAsync(fellowUserId, ct);
        var position = await db.SanctionedManpowerPositions
            .FirstAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct);
        var project = await db.Projects.FirstAsync(p => p.Id == position.ProjectId, ct);
        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        var candidate = await db.Candidates
            .FirstOrDefaultAsync(c => c.Id == appointment.CandidateId, ct);

        var receiptsData = await db.GrantReceipts
            .Where(g => g.ProjectId == project.Id)
            .Where(g => g.Status == GrantReceiptStatus.Approved)
            .Select(g => new { g.Amount, g.BudgetHeadId })
            .ToListAsync(ct);

        var manpowerHeadIds = await db.BudgetHeads
            .Where(b => b.ProjectId == project.Id
                     && b.HeadName == BudgetHeadName.RecurringManpower)
            .Select(b => b.Id)
            .ToListAsync(ct);

        var totalLeavesTaken = await db.LeaveEntitlements
            .Where(e => e.FellowAppointmentId == appointment.Id)
            .SumAsync(e => (int?)e.ConsumedDays, ct) ?? 0;

        var entitlement = await db.LeaveEntitlements
            .Where(e => e.FellowAppointmentId == appointment.Id)
            .SumAsync(e => (int?)e.EntitledDays, ct) ?? 0;

        var periodFrom = new DateOnly(claimYear, claimMonth, 1);
        var periodTo = periodFrom.AddMonths(1).AddDays(-1);

        var leaveTakenThisMonth = 0; // Default to 0, overridden by the claim's saved value if present
        var draftHra = position.Hra > 0 ? position.Hra : Math.Round(position.Stipend * 0.20m, 2);

        return new StipendFormModel(
            candidate?.FullName ?? pi.Name,
            appointment.BankAccountNo,
            appointment.IfscCode,
            candidate?.Mobile,
            candidate?.Email,
            appointment.JoinedOn,
            position.Designation,
            project.ProjectTitle,
            project.SanctionNo,
            project.TotalSanctioned,
            project.StartDate,
            project.StartDate.AddMonths(project.DurationMonths),
            pi.Name,
            pi.Department,
            receiptsData.Sum(r => r.Amount),
            receiptsData.Where(r => manpowerHeadIds.Contains(r.BudgetHeadId)).Sum(r => r.Amount),
            periodFrom,
            periodTo,
            position.Stipend,
            draftHra, // Draft HRA (position HRA or 20%)
            position.Stipend + draftHra, // Draft total default
            false,
            null,
            entitlement,
            totalLeavesTaken,
            leaveTakenThisMonth,
            0,
            null);
    }

    public async Task<Guid> GetMyAppointmentIdAsync(Guid fellowUserId, CancellationToken ct = default)
    {
        var appointment = await fellowContext.RequireActiveFellowAsync(fellowUserId, ct);
        return appointment.Id;
    }

    // ---------------------------------------------------------------- Helpers

    private async Task<FellowshipClaim?> GetClaimByIdAsync(Guid claimId, CancellationToken ct)
    {
        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct);
        if (claim is null) return null;
        
        // ClaimPeriod is ignored in EF mapping, so set the default here
        claim.ClaimPeriod = "21st-20th";
        return claim;
    }

    private Task<bool> HasHraSlipAsync(Guid appointmentId, CancellationToken ct) =>
        db.Documents.AnyAsync(
            d => d.OwnerType == "FellowAppointment"
              && d.OwnerId == appointmentId
              && d.Kind == DocumentKind.HraSlip,
            ct);

    private async Task RequirePiOwnsClaimAsync(
        FellowshipClaim claim, Guid piUserId, CancellationToken ct)
    {
        var appointment = await db.ManpowerSelections
            .FirstOrDefaultAsync(s => s.Id == claim.FellowAppointmentId, ct)
            ?? throw new FellowshipClaimNotFoundException(claim.Id);

        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct)
            ?? throw new FellowshipClaimNotFoundException(claim.Id);

        var project = await db.Projects
            .FirstOrDefaultAsync(p => p.Id == position.ProjectId && !p.IsDeleted, ct)
            ?? throw new FellowshipClaimNotFoundException(claim.Id);

        if (project.OwnerUserId != piUserId)
        {
            throw new UnauthorizedAccessException(
                "This fellowship claim does not belong to a project owned by the requesting user.");
        }
    }

    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListAllClaimsAsync(CancellationToken ct = default)
    {
        var claims = await db.FellowshipClaims
            .OrderByDescending(c => c.ClaimYear).ThenByDescending(c => c.ClaimMonth)
            .ToListAsync(ct);

        return await ToSummariesAsync(claims, ct);
    }

    /// <summary>
    /// Does not role-filter by design: every one of the four bulk-eligible
    /// roles (DA/Superintendent/DR/Dean) may need institute-wide visibility
    /// of unpaid approved claims once a voucher is being assembled, matching
    /// ListAllClaimsAsync's own unfiltered precedent rather than
    /// ListPendingClaimsForCallerAsync's per-stage narrowing (which only
    /// applies to claims still mid-approval, not to the terminal "ready to
    /// pay" list).
    /// </summary>
    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListReadyToVoucherClaimsAsync(
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default)
    {
        var approvedWorkflowIds = await db.WorkflowInstances
            .Where(w => w.CurrentStage == WorkflowStage.Approved)
            .Select(w => w.Id)
            .ToListAsync(ct);

        var claims = await db.FellowshipClaims
            .Where(c => approvedWorkflowIds.Contains(c.WorkflowInstanceId))
            .OrderBy(c => c.ClaimYear).ThenBy(c => c.ClaimMonth)
            .ToListAsync(ct);

        return await ToSummariesAsync(claims, ct);
    }

    /// <remarks>
    /// Two phases. Phase 1 validates every claim and computes its charge
    /// without touching the change tracker; phase 2 only runs once every
    /// claim has passed, and stages the voucher, its items, the Expenditure
    /// rows and the claim links for a single SaveChangesAsync (one implicit
    /// transaction on a relational provider). A failure on any claim
    /// therefore leaves nothing persisted and nothing pending.
    ///
    /// Available balance per head = Approved grant receipts against that head
    /// minus Expenditure already recorded against it -- the same head-level
    /// formula PaymentVouchersController.Create uses -- further reduced by
    /// earlier claims in this same batch that hit the same head, so two
    /// claims that each fit alone but not together are refused.
    ///
    /// The amount paid and charged is the PI's RecommendedAmount when one was
    /// entered (the approver's figure after any leave/absence deduction --
    /// TotalAmount is never reduced by it), else TotalAmount.
    /// </remarks>
    public async Task<Guid> CreateVoucherFromClaimsAsync(
        IReadOnlyCollection<Guid> claimIds, CreateFellowshipVoucherInput input,
        Guid actorUserId, CancellationToken ct = default)
    {
        if (claimIds.Count == 0)
        {
            throw new ArgumentException("At least one claim id is required.", nameof(claimIds));
        }

        // A repeated id would otherwise be one claim paid twice.
        var distinctIds = claimIds.Distinct().ToList();

        var claims = await db.FellowshipClaims
            .Where(c => distinctIds.Contains(c.Id))
            .ToListAsync(ct);

        // ---- Phase 1: validate everything, stage nothing.
        var remainingByHead = new Dictionary<Guid, decimal>();
        var lines = new List<(FellowshipClaim Claim, Guid ProjectId, Guid HeadId, decimal Amount, decimal BalanceBefore)>();

        foreach (var claimId in distinctIds)
        {
            var claim = claims.FirstOrDefault(c => c.Id == claimId)
                ?? throw new FellowshipClaimNotFoundException(claimId);

            if (claim.PaymentVoucherItemId is not null)
            {
                throw new ClaimAlreadyVoucheredException(claimId);
            }

            var instance = await workflowEngine.GetAsync(claim.WorkflowInstanceId, ct)
                ?? throw new InvalidOperationException(
                    $"Workflow instance '{claim.WorkflowInstanceId}' not found.");
            if (instance.CurrentStage != WorkflowStage.Approved)
            {
                throw new ClaimNotApprovedForVoucherException(claimId, instance.CurrentStage);
            }

            // The claim's own project: appointment -> sanctioned position -> project.
            var appointment = await db.ManpowerSelections
                .FirstAsync(a => a.Id == claim.FellowAppointmentId, ct);
            var position = await db.SanctionedManpowerPositions
                .FirstAsync(p => p.Id == appointment.SanctionedManpowerPositionId, ct);
            var projectId = position.ProjectId;

            var manpowerHeadId = await db.BudgetHeads
                .Where(b => b.ProjectId == projectId && b.HeadName == BudgetHeadName.RecurringManpower)
                .Select(b => (Guid?)b.Id)
                .FirstOrDefaultAsync(ct)
                ?? throw new ManpowerHeadNotConfiguredException(projectId);

            if (!remainingByHead.TryGetValue(manpowerHeadId, out var available))
            {
                var grantReceived = await db.GrantReceipts
                    .Where(g => g.BudgetHeadId == manpowerHeadId && g.Status == GrantReceiptStatus.Approved)
                    .SumAsync(g => g.Amount, ct);
                var alreadySpent = await db.Expenditure
                    .Where(e => e.BudgetHeadId == manpowerHeadId)
                    .SumAsync(e => e.Amount, ct);
                available = Math.Max(0m, grantReceived - alreadySpent);
            }

            var amount = claim.RecommendedAmount ?? claim.TotalAmount;

            if (amount > available)
            {
                throw new InsufficientManpowerBudgetException(claimId, projectId, amount, available);
            }

            remainingByHead[manpowerHeadId] = available - amount;
            lines.Add((claim, projectId, manpowerHeadId, amount, available));
        }

        // ---- Phase 2: every claim passed; stage the voucher.
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var voucherNo = $"PV/{now.Year}/{now.Month:D2}/{Random.Shared.Next(100, 999)}";
        var total = lines.Sum(l => l.Amount);

        var voucher = new PaymentVoucher
        {
            Id = Guid.NewGuid(),
            ProjectId = null, // may span several projects; each item carries its own head
            IndentId = null,
            VoucherNo = voucherNo,
            VoucherType = total > 100000m ? "above100k" : "upto100k",
            Date = today,
            TaxableAmount = total,
            PayableAmount = total,
            Amount = total,
            BankAccountNo = "77660100016031", // PaymentVouchersController.Create's default
            ChequeDate = today,
            PayRs = total,
            CoordinatorNameDept = input.CoordinatorNameDept,
            ProjectSanctionNo = input.ProjectSanctionNo,
            FundingAgency = input.FundingAgency,
            PaymentTo = input.PaymentTo,
            Status = "Pending Approval",
            CurrentStage = "Office Assistant Verification",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var (claim, projectId, headId, amount, balanceBefore) in lines)
        {
            var item = new PaymentVoucherItem
            {
                Id = Guid.NewGuid(),
                PaymentVoucherId = voucher.Id,
                BudgetHeadId = headId,
                FellowshipClaimId = claim.Id,
                SupplierInvoiceGoods = $"Fellowship claim {claim.ClaimMonth:D2}/{claim.ClaimYear}",
                HeadCategory = nameof(BudgetHeadName.RecurringManpower),
                CurrentHeadBalance = balanceBefore,
                BillAmount = amount,
                BalanceAfterPayment = balanceBefore - amount,
            };
            voucher.Items.Add(item);

            db.Expenditure.Add(new Expenditure
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                BudgetHeadId = headId,
                SectionType = $"Payment Voucher {voucherNo}",
                TransactionDate = today,
                Amount = amount,
            });

            claim.PaymentVoucherItemId = item.Id;
        }

        db.PaymentVouchers.Add(voucher);
        await db.SaveChangesAsync(ct);

        return voucher.Id;
    }

    private async Task<IReadOnlyList<FellowshipClaimSummary>> ToSummariesAsync(
        IReadOnlyList<FellowshipClaim> claims, CancellationToken ct)
    {
        var (summaries, _) = await ToSummariesWithDepartmentsAsync(claims, ct);
        return summaries;
    }

    /// <summary>
    /// Same projection as <see cref="ToSummariesAsync"/>, plus the per-claim
    /// department id its own join chain (FellowshipClaim -&gt; ManpowerSelection
    /// -&gt; SanctionedManpowerPosition -&gt; Project.DepartmentId) already
    /// computes. <see cref="ListPendingClaimsForCallerAsync"/> needs that id to
    /// filter by department -- FellowshipClaimSummary only carries the display
    /// name, not the id -- so this exposes it instead of re-querying the same
    /// chain from scratch.
    /// </summary>
    private async Task<(IReadOnlyList<FellowshipClaimSummary> Summaries, IReadOnlyDictionary<Guid, Guid?> DepartmentIdsByClaimId)>
        ToSummariesWithDepartmentsAsync(IReadOnlyList<FellowshipClaim> claims, CancellationToken ct)
    {
        if (claims.Count == 0)
        {
            return ([], new Dictionary<Guid, Guid?>());
        }

        var workflowIds = claims.Select(c => c.WorkflowInstanceId).ToHashSet();
        var stages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var appointmentIds = claims.Select(c => c.FellowAppointmentId).ToHashSet();
        var appointments = await db.ManpowerSelections
            .Where(s => appointmentIds.Contains(s.Id))
            .Include(s => s.Candidate)
            .ToDictionaryAsync(s => s.Id, s => s, ct);

        var positionIds = appointments.Values.Select(a => a.SanctionedManpowerPositionId).ToHashSet();
        var positions = await db.SanctionedManpowerPositions
            .Where(p => positionIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p, ct);

        var projectIds = positions.Values.Select(p => p.ProjectId).ToHashSet();
        var projects = await db.Projects
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p, ct);

        var departmentIds = projects.Values.Select(p => p.DepartmentId).ToHashSet();
        var departments = await db.Departments
            .Where(d => departmentIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d, ct);

        var piUserIds = projects.Values.Select(p => p.OwnerUserId).ToHashSet();
        var piProfiles = new Dictionary<Guid, API.Application.Procurement.FacultyProfileInfo>();
        foreach (var userId in piUserIds)
        {
            try
            {
                var profile = await facultyProfiles.GetAsync(userId, ct);
                piProfiles[userId] = profile;
            }
            catch
            {
                // Ignore missing profiles
            }
        }

        var departmentIdsByClaimId = new Dictionary<Guid, Guid?>();
        var summaries = new List<FellowshipClaimSummary>(claims.Count);

        foreach (var c in claims)
        {
            var appt = appointments.TryGetValue(c.FellowAppointmentId, out var a) ? a : null;
            var pos = appt != null && positions.TryGetValue(appt.SanctionedManpowerPositionId, out var p) ? p : null;
            var proj = pos != null && projects.TryGetValue(pos.ProjectId, out var pr) ? pr : null;
            var dept = proj != null && departments.TryGetValue(proj.DepartmentId, out var d) ? d : null;
            var pi = proj != null && piProfiles.TryGetValue(proj.OwnerUserId, out var pProf) ? pProf : null;

            var scholarName = appt?.Candidate?.FullName ?? "Scholar";
            var rollNo = appt?.IdCardNumber ?? "N/A";
            var deptName = dept?.Name ?? "Department";
            var projTitle = proj?.ProjectTitle ?? "Project";
            var piName = pi?.Name ?? "Faculty PI";

            var claimType = (!string.IsNullOrWhiteSpace(c.ClaimType) && c.ClaimType != "Claim for Month")
                ? c.ClaimType
                : ((c.Remarks != null && c.Remarks.Contains("Arrears")) ? "Raise Arrears" : "Claim for Month");

            summaries.Add(new FellowshipClaimSummary(
                c.Id, c.FellowAppointmentId, c.WorkflowInstanceId,
                c.ClaimYear, c.ClaimMonth,
                c.ClaimPeriod ?? "21st-20th",
                claimType,
                c.FellowshipAmount, c.HraAmount, c.HraClaimed, c.TotalAmount,
                c.HraOverrideAmount is not null, c.HraOverrideReason,
                pos?.Hra,
                c.LeaveDaysTakenThisMonth, c.UnauthorisedAbsenceDays,
                c.RecommendedAmount, c.Remarks,
                stages.TryGetValue(c.WorkflowInstanceId, out var stage) ? stage : WorkflowStage.Raised,
                c.CreatedAt,
                scholarName,
                rollNo,
                deptName,
                projTitle,
                piName,
                proj?.Id ?? Guid.Empty,
                c.PaymentVoucherItemId));
        }

        return (summaries, departmentIdsByClaimId);
    }

    /// <summary>
    /// The dashboard's "pending my action" panel for fellowship claims. Built
    /// on <see cref="IWorkflowPendingQueryService.ListPendingInstancesAsync"/>
    /// (Task 1's stage-matching primitive) plus this method's own department
    /// scoping -- fellowship claims have no institute-wide-or-nothing stage
    /// like a proposal's office chain (BRD A3's route is PI -&gt; HOD -&gt; Dean,
    /// all department-scoped roles), so unlike
    /// ResearchProposalService.ListPendingForCallerAsync, every stage here uses
    /// the same plain department-match rule.
    /// </summary>
    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListPendingClaimsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.FellowshipClaim, WorkflowPhase.Indent, roles, userId, ct);
        if (pending.Count == 0)
        {
            return [];
        }

        // pending.Keys.Contains(...), not pending.ContainsKey(...): the real
        // MySQL provider cannot translate IReadOnlyDictionary.ContainsKey to
        // SQL (only the InMemory test provider tolerates it), so this threw
        // InvalidOperationException on every call -- silently swallowed by
        // DashboardService's per-type catch.
        var pendingIds = pending.Keys;
        var claims = await db.FellowshipClaims
            .Where(c => pendingIds.Contains(c.WorkflowInstanceId))
            .ToListAsync(ct);
        if (claims.Count == 0)
        {
            return [];
        }

        // ClaimPeriod is ignored in EF mapping, so set the default here --
        // mirrors every other read path in this file (ListAllClaimsAsync,
        // ListOwnClaimsAsync, ...).
        foreach (var claim in claims)
        {
            claim.ClaimPeriod = "21st-20th";
        }

        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);

        var (summaries, departmentIdsByClaimId) = await ToSummariesWithDepartmentsAsync(claims, ct);

        bool IsVisible(FellowshipClaimSummary s, WorkflowStage stage)
        {
            if (stage == WorkflowStage.WithDAFellowship ||
                stage == WorkflowStage.WithSuperintendentFellowship ||
                stage == WorkflowStage.WithDRFellowship ||
                stage == WorkflowStage.WithDeanFellowship ||
                stage == WorkflowStage.Director)
            {
                return true; // Office stages are institute-wide
            }
            
            return departmentIdsByClaimId.TryGetValue(s.Id, out var claimDeptId) && claimDeptId == departmentId;
        }

        return
        [
            .. summaries.Where(s => IsVisible(s, pending[s.WorkflowInstanceId]))
        ];
    }

    public async Task<IReadOnlyList<WorkflowStepSummary>> GetClaimStepsAsync(
        Guid claimId, Guid requestingUserId, CancellationToken ct = default)
    {
        // Auth: readable by the fellow it belongs to, the PI who owns the project,
        // or HOD/Dean who may need to see the paper trail during approval.
        // We do a lighter check here — just verify the claim exists; the controller
        // already gates the endpoint with [Authorize] and role checks.
        var claim = await db.FellowshipClaims.FirstOrDefaultAsync(c => c.Id == claimId, ct)
            ?? throw new FellowshipClaimNotFoundException(claimId);

        var instance = await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == claim.WorkflowInstanceId, ct);

        if (instance is null) return [];

        // Resolve actor display names in batch.
        var actorIds = instance.Steps.Select(s => s.ActorUserId).ToHashSet();
        var actors = await db.Users
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        return
        [
            .. instance.Steps
                .OrderBy(s => s.Timestamp)
                .Select(s => new WorkflowStepSummary(
                    s.Id,
                    s.Stage,
                    s.Action,
                    actors.TryGetValue(s.ActorUserId, out var name) ? name : s.ActorUserId.ToString(),
                    s.Remarks,
                    s.Timestamp))
        ];
    }

    public async Task<IReadOnlyList<FellowshipClaimSummary>> ListPIClaimsAsync(
        Guid piUserId, CancellationToken ct = default)
    {
        // Find all projects this PI owns.
        var projectIds = await db.Projects
            .Where(p => p.OwnerUserId == piUserId && !p.IsDeleted)
            .Select(p => p.Id)
            .ToListAsync(ct);

        if (projectIds.Count == 0) return [];

        // All manpower positions under those projects.
        var positionIds = await db.SanctionedManpowerPositions
            .Where(p => projectIds.Contains(p.ProjectId))
            .Select(p => p.Id)
            .ToListAsync(ct);

        // All appointments under those positions.
        var appointmentIds = await db.ManpowerSelections
            .Where(s => positionIds.Contains(s.SanctionedManpowerPositionId))
            .Select(s => s.Id)
            .ToListAsync(ct);

        // All fellowship claims for those appointments.
        var claims = await db.FellowshipClaims
            .Where(c => appointmentIds.Contains(c.FellowAppointmentId))
            .OrderByDescending(c => c.ClaimYear).ThenByDescending(c => c.ClaimMonth)
            .ToListAsync(ct);

        // Set default ClaimPeriod for all claims (column is ignored in EF mapping)
        foreach (var claim in claims)
        {
            claim.ClaimPeriod = "21st-20th";
        }

        return await ToSummariesAsync(claims, ct);
    }

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
