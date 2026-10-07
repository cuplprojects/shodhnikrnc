using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class ProjectService(
    IApplicationDbContext db,
    IWorkflowEngineService workflowEngine,
    IProjectYearCalculator yearCalculator,
    IOverheadSplitValidator overheadSplitValidator,
    IUserDepartmentProvider userDepartment,
    IInstituteWideScopeResolver instituteWideScope,
    IAuditService audit,
    IWorkflowPendingQueryService pendingQuery) : IProjectService
{
    private static void ValidateBudgetHeadInput(BudgetHeadInput input)
    {
        if (input.HeadName == BudgetHeadName.Other && string.IsNullOrWhiteSpace(input.CustomLabel))
        {
            throw new ArgumentException(
                "CustomLabel is required when HeadName is Other.", nameof(input));
        }
    }

    private static void RequireNoDuplicateBudgetHeads(IReadOnlyList<BudgetHeadInput> inputs)
    {
        var seen = new HashSet<(BudgetHeadName HeadName, string NormalizedLabel)>();
        foreach (var input in inputs)
        {
            var normalizedLabel = (input.CustomLabel ?? string.Empty).Trim().ToUpperInvariant();
            var key = (input.HeadName, normalizedLabel);
            if (!seen.Add(key))
            {
                var message = input.HeadName == BudgetHeadName.Other
                    ? $"Two budget heads are both labeled '{input.CustomLabel}'; each Other head needs a distinct label."
                    : $"Two budget heads both use head '{input.HeadName}'; each head may appear only once.";
                throw new ArgumentException(message, nameof(inputs));
            }
        }
    }

    /// <summary>RecurringOverhead is an independent, additive mechanism from
    /// OverheadPercent -- a project can have neither, either, or both. This
    /// mirrors how a Proposal can have both a RecurringOverhead line item AND
    /// a per-line OverheadPercent surcharge on other lines.</summary>
    private static void RecomputeTotalAmount(Project project)
    {
        var nonOverheadTotal = project.BudgetHeads
            .Where(h => h.HeadName != BudgetHeadName.RecurringOverhead)
            .Sum(h => h.Total);
        var overheadRowTotal = project.BudgetHeads
            .Where(h => h.HeadName == BudgetHeadName.RecurringOverhead)
            .Sum(h => h.Total);
        var percentDerivedOverhead = nonOverheadTotal * (project.OverheadPercent ?? 0m) / 100m;
        var overhead = overheadRowTotal > 0 ? overheadRowTotal : percentDerivedOverhead;

        project.TotalAmount = nonOverheadTotal + overhead;
    }

    public async Task<Project> CreateAsync(
        Guid ownerUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        decimal? overheadPercent = null, CancellationToken ct = default)
    {
        var departmentId = await userDepartment.GetDepartmentIdAsync(ownerUserId, ct)
            ?? throw new OwnerHasNoDepartmentException(ownerUserId);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerUserId,
            DepartmentId = departmentId,
            ProjectType = projectType,
            SanctionNo = sanctionNo,
            SanctionDate = sanctionDate,
            ProjectTitle = projectTitle,
            StartDate = startDate,
            Agency = agency,
            DurationMonths = durationMonths,
            TotalSanctioned = totalSanctioned,
            OverheadPercent = overheadPercent,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var c in collaborators)
        {
            project.Collaborators.Add(new Collaborator { Id = Guid.NewGuid(), ProjectId = project.Id, Institute = c.Institute, Faculty = c.Faculty, IsInsideInstitute = c.IsInsideInstitute, Department = c.Department, Designation = c.Designation });
        }

        foreach (var b in budgetHeads)
        {
            ValidateBudgetHeadInput(b);
        }
        RequireNoDuplicateBudgetHeads(budgetHeads);

        foreach (var b in budgetHeads)
        {
            project.BudgetHeads.Add(new BudgetHead
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                HeadName = b.HeadName,
                Year1Amount = b.Year1Amount,
                Year2Amount = b.Year2Amount,
                Year3Amount = b.Year3Amount,
                Year4Amount = b.Year4Amount,
                Year5Amount = b.Year5Amount,
                Total = b.Year1Amount + b.Year2Amount + b.Year3Amount + b.Year4Amount + b.Year5Amount,
                CustomLabel = b.CustomLabel,
            });
        }

        foreach (var e in equipment)
        {
            project.SanctionedEquipment.Add(new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = project.Id, Name = e.Name, Unit = e.Unit, Amount = e.Amount });
        }

        foreach (var m in manpower)
        {
            project.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                Designation = m.Designation,
                Positions = m.Positions,
                Stipend = m.Stipend,
                Hra = m.Hra,
            });
        }

        RecomputeTotalAmount(project);

        if (project.TotalSanctioned < project.TotalAmount)
        {
            project.Status = ProjectStatus.PendingRevision;
        }
        else
        {
            project.Status = ProjectStatus.Active;
        }

        db.Projects.Add(project);
        db.Collaborators.AddRange(project.Collaborators);
        db.BudgetHeads.AddRange(project.BudgetHeads);
        db.SanctionedEquipment.AddRange(project.SanctionedEquipment);
        db.SanctionedManpowerPositions.AddRange(project.SanctionedManpowerPositions);

        await db.SaveChangesAsync(ct);
        return project;
    }

    /// <summary>The RnC office roles a project is visible to institute-wide,
    /// read-only. Mirrors ProposalsController.RnCOfficeRoles -- the same
    /// roles that administer a proposal all the way to sanction should not
    /// lose sight of the project that sanction creates.</summary>
    private static readonly HashSet<string> RnCOfficeRoles =
        new(StringComparer.OrdinalIgnoreCase) { "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff", "Director", "SuperAdmin" };

    public async Task<Project?> GetAsync(
        Guid projectId, Guid requestingUserId,
        IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct);
        if (project is null || project.IsDeleted)
        {
            return null;
        }

        var isOwner = project.OwnerUserId == requestingUserId;
        var isRnCOffice = requestingUserRoles?.Any(RnCOfficeRoles.Contains) ?? false;
        var isHod = requestingUserRoles?.Contains("HOD", StringComparer.OrdinalIgnoreCase) ?? false;

        if (isHod)
        {
            var hodDepartmentId = await userDepartment.GetDepartmentIdAsync(requestingUserId, ct);
            if (hodDepartmentId.HasValue && hodDepartmentId.Value == project.DepartmentId)
            {
                return project;
            }
        }

        if (!isOwner && !isRnCOffice)
        {
            // ComputerCentre holds no general project visibility -- it only
            // ever needs to reach a project to act on one of its
            // recruitments' advertisement approval (RecruitmentService.GetAsync
            // calls this method purely to load the project the recruitment
            // belongs to before returning the recruitment's own detail).
            // Granting it project-wide read access via RnCOfficeRoles would
            // be far wider than the role's actual job, so this checks the
            // conditions that job actually depends on: either a
            // RecruitmentRequest under this project has an advertisement
            // instance currently at the ComputerCentre's own stage (still
            // pending their action), or this specific caller has already
            // published one of this project's advertisements (so they can
            // still reach what they acted on -- otherwise the moment they
            // publish, GetAsync 403s them on the very project they just
            // approved, since the pending-stage condition above no longer
            // holds once the instance has moved past WithComputerCentre).
            var isComputerCentre = requestingUserRoles?.Contains("ComputerCentre", StringComparer.OrdinalIgnoreCase) ?? false;
            if (isComputerCentre)
            {
                var hasPendingAdvertisement = await db.RecruitmentRequests
                    .Where(r => r.ProjectId == projectId && r.AdvertisementWorkflowInstanceId != null)
                    .Join(db.WorkflowInstances,
                        r => r.AdvertisementWorkflowInstanceId!.Value,
                        w => w.Id,
                        (r, w) => w.CurrentStage)
                    .AnyAsync(stage => stage == WorkflowStage.WithComputerCentre, ct);

                if (hasPendingAdvertisement)
                {
                    return project;
                }

                var hasPublishedByThisCaller = await db.RecruitmentRequests
                    .Where(r => r.ProjectId == projectId && r.AdvertisementWorkflowInstanceId != null)
                    .Join(db.WorkflowSteps,
                        r => r.AdvertisementWorkflowInstanceId!.Value,
                        s => s.WorkflowInstanceId,
                        (r, s) => s)
                    .AnyAsync(s => s.ActorUserId == requestingUserId && s.Action == WorkflowAction.Approve, ct);

                if (hasPublishedByThisCaller)
                {
                    return project;
                }
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var isFellow = await db.ManpowerSelections
                .Join(db.SanctionedManpowerPositions,
                    m => m.SanctionedManpowerPositionId,
                    s => s.Id,
                    (m, s) => new { m, s })
                .AnyAsync(x => x.m.ApplicationUserId == requestingUserId
                    && x.s.ProjectId == projectId
                    && x.m.Status == ManpowerSelectionStatus.Active
                    && x.m.ValidTill >= today, ct);

            if (isFellow)
            {
                return project;
            }

            throw new ProjectAccessDeniedException(projectId);
        }

        return project;
    }

    public async Task<IReadOnlyList<Project>> ListForOwnerAsync(Guid ownerUserId, CancellationToken ct = default)
    {
        return await db.Projects
            .Where(p => p.OwnerUserId == ownerUserId && !p.IsDeleted)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Project>> ListAllAsync(CancellationToken ct = default)
    {
        return await db.Projects.ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Project>> ListVisibleToAsync(
        Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default)
    {
        var roles = requestingUserRoles ?? [];
        var isRnCOffice = roles.Any(RnCOfficeRoles.Contains);

        if (isRnCOffice)
        {
            return await db.Projects.Where(p => !p.IsDeleted).ToListAsync(ct);
        }

        var isHod = roles.Contains("HOD", StringComparer.OrdinalIgnoreCase);
        if (isHod)
        {
            var hodDepartmentId = await userDepartment.GetDepartmentIdAsync(requestingUserId, ct);
            if (hodDepartmentId.HasValue)
            {
                return await db.Projects
                    .Where(p => !p.IsDeleted && p.DepartmentId == hodDepartmentId.Value)
                    .ToListAsync(ct);
            }
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.Projects
            .Where(p => !p.IsDeleted && (
                p.OwnerUserId == requestingUserId ||
                db.ManpowerSelections.Join(db.SanctionedManpowerPositions,
                    m => m.SanctionedManpowerPositionId, s => s.Id, (m, s) => new { m, s })
                .Any(x => x.m.ApplicationUserId == requestingUserId
                    && x.s.ProjectId == p.Id
                    && x.m.Status == ManpowerSelectionStatus.Active
                    && x.m.ValidTill >= today)
            ))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Project>> ListForProcessBillAsync(
        Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default)
    {
        var roles = requestingUserRoles ?? [];
        var isRnCOffice = roles.Any(RnCOfficeRoles.Contains);

        if (isRnCOffice)
        {
            return await db.Projects.Where(p => !p.IsDeleted).ToListAsync(ct);
        }

        var isHod = roles.Contains("HOD", StringComparer.OrdinalIgnoreCase);
        if (isHod)
        {
            var hodDepartmentId = await userDepartment.GetDepartmentIdAsync(requestingUserId, ct);
            if (hodDepartmentId.HasValue)
            {
                return await db.Projects
                    .Where(p => !p.IsDeleted && (p.DepartmentId == hodDepartmentId.Value || p.OwnerUserId == requestingUserId))
                    .ToListAsync(ct);
            }
        }

        return await db.Projects
            .Where(p => !p.IsDeleted && p.OwnerUserId == requestingUserId)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SanctionedManpowerPosition>> GetManpowerPositionsAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await db.Projects
            .Include(p => p.SanctionedManpowerPositions)
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct);

        if (project is null)
        {
            return Array.Empty<SanctionedManpowerPosition>();
        }

        return project.SanctionedManpowerPositions.ToList();
    }

    public async Task<IReadOnlyList<SanctionedManpowerPosition>> GetManpowerPositionsAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default)
    {
        Project? project;
        try
        {
            project = await GetAsync(projectId, requestingUserId, requestingUserRoles, ct);
        }
        catch (ProjectAccessDeniedException)
        {
            return Array.Empty<SanctionedManpowerPosition>();
        }

        if (project is null)
        {
            return Array.Empty<SanctionedManpowerPosition>();
        }

        return project.SanctionedManpowerPositions.ToList();
    }

    public async Task<Project> UpdateAsync(
        Guid projectId, Guid requestingUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        decimal? overheadPercent = null, CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        project.ProjectType = projectType;
        project.SanctionNo = sanctionNo;
        project.SanctionDate = sanctionDate;
        project.ProjectTitle = projectTitle;
        project.StartDate = startDate;
        project.Agency = agency;
        project.DurationMonths = durationMonths;
        project.TotalSanctioned = totalSanctioned;
        project.OverheadPercent = overheadPercent;

        UpsertCollaborators(project, collaborators);
        UpsertBudgetHeads(project, budgetHeads);
        RecomputeTotalAmount(project);
        UpsertEquipment(project, equipment);
        UpsertManpower(project, manpower);

        if (project.TotalSanctioned < project.TotalAmount)
        {
            project.Status = ProjectStatus.PendingRevision;
        }
        else
        {
            var instance = await workflowEngine.RaiseAsync(
                RequestType.ProjectUpdate, project.Id, WorkflowPhase.Indent, requestingUserId, ct);
            project.WorkflowInstanceId = instance.Id;
            project.Status = ProjectStatus.UnderApproval;

            await workflowEngine.ForwardAsync(
                instance.Id, requestingUserId, ["Faculty"], "Project details updated by PI; submitted for re-approval.", ct);
        }

        await db.SaveChangesAsync(ct);
        await audit.LogAsync(nameof(Project), project.Id, "Updated", requestingUserId, ct: ct);
        return project;
    }

    public async Task SubmitForApprovalAsync(Guid projectId, Guid requestingUserId, string? remarks = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException("A remark is required when submitting a project for approval.");
        }

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        if (project.TotalSanctioned < project.TotalAmount)
        {
            throw new InvalidOperationException($"Total sanctioned amount (₹{project.TotalSanctioned:N2}) is less than total budget (₹{project.TotalAmount:N2}). Please edit the grant amount or budget heads before submitting for approval.");
        }

        WorkflowInstance instance;
        if (project.WorkflowInstanceId.HasValue)
        {
            instance = await workflowEngine.GetAsync(project.WorkflowInstanceId.Value, ct)
                ?? await workflowEngine.RaiseAsync(RequestType.ProjectUpdate, project.Id, WorkflowPhase.Indent, requestingUserId, ct);
        }
        else
        {
            instance = await workflowEngine.RaiseAsync(RequestType.ProjectUpdate, project.Id, WorkflowPhase.Indent, requestingUserId, ct);
            project.WorkflowInstanceId = instance.Id;
        }

        project.Status = ProjectStatus.UnderApproval;
        await workflowEngine.ForwardAsync(instance.Id, requestingUserId, ["Faculty"], remarks, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task ForwardProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException("A remark is required when forwarding a project.");
        }

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (!project.WorkflowInstanceId.HasValue)
        {
            throw new InvalidOperationException("Project has no active approval workflow.");
        }

        await workflowEngine.ForwardAsync(project.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (!project.WorkflowInstanceId.HasValue)
        {
            throw new InvalidOperationException("Project has no active approval workflow.");
        }

        await workflowEngine.ApproveAsync(project.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        project.Status = ProjectStatus.Approved;
        await db.SaveChangesAsync(ct);
    }

    public async Task RejectProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (!project.WorkflowInstanceId.HasValue)
        {
            throw new InvalidOperationException("Project has no active approval workflow.");
        }

        await workflowEngine.RejectAsync(project.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        project.Status = ProjectStatus.Rejected;
        await db.SaveChangesAsync(ct);
    }

    public async Task ReturnProjectAsync(Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (!project.WorkflowInstanceId.HasValue)
        {
            throw new InvalidOperationException("Project has no active approval workflow.");
        }

        await workflowEngine.ReturnAsync(project.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        project.Status = ProjectStatus.PendingRevision;
        await db.SaveChangesAsync(ct);
    }

    public async Task SoftDeleteAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        project.IsDeleted = true;
        project.DeletedAt = DateTimeOffset.UtcNow;
        project.DeletedByUserId = requestingUserId;

        await db.SaveChangesAsync(ct);
        await audit.LogAsync(nameof(Project), project.Id, "SoftDeleted", requestingUserId, ct: ct);
    }

    public async Task<bool> HasAnyDownstreamActivityAsync(Guid projectId, CancellationToken ct = default)
    {
        if (await db.GrantReceipts.AnyAsync(g => g.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.BudgetReappropriationLogs.AnyAsync(l => l.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.ConsumableIndents.AnyAsync(i => i.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.ContingencyIndents.AnyAsync(i => i.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.EquipmentIndents.AnyAsync(i => i.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.Expenditure.AnyAsync(e => e.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.Refunds.AnyAsync(r => r.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.RecruitmentRequests.AnyAsync(r => r.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.TravelRequests.AnyAsync(t => t.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.HistoricalExpenditures.AnyAsync(h => h.ProjectId == projectId, ct))
        {
            return true;
        }
        if (await db.HistoricalGrantReceipts.AnyAsync(h => h.ProjectId == projectId, ct))
        {
            return true;
        }
        return await db.OfferLetters.AnyAsync(o => o.ProjectId == projectId, ct);
    }

    public async Task HardDeleteUntouchedAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(nameof(Project), projectId, "HardDeletedAfterSanctionUndo", requestingUserId, ct: ct);
    }

    public async Task<GrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid requestingUserId, Guid budgetHeadId, DateOnly receivedDate, decimal amount,
        IReadOnlyDictionary<OverheadSubHead, decimal>? overheadSplit,
        string? transactionReference = null, PaymentMode? paymentMode = null, string? schemeCode = null,
        int? projectYear = null, string? remarks = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when recording a grant receipt.");
        }

        var project = await LoadProjectWithChildrenAsync(projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        if (project.Status != ProjectStatus.Approved && project.Status != ProjectStatus.Active)
        {
            throw new InvalidOperationException("Grant receipts cannot be recorded until the project is approved by the Dean.");
        }

        var budgetHead = project.BudgetHeads.FirstOrDefault(b => b.Id == budgetHeadId)
            ?? throw new ArgumentException($"Budget head '{budgetHeadId}' does not belong to project '{projectId}'.", nameof(budgetHeadId));

        var targetDate = (projectYear.HasValue && projectYear.Value > 0)
            ? project.StartDate.AddYears(projectYear.Value - 1)
            : receivedDate;

        var resolvedYear = yearCalculator.GetProjectYear(project.StartDate, targetDate);

        var sourceProposal = await db.ResearchProposals
            .Where(p => p.ProjectId == projectId)
            .Select(p => new { p.SubmittedToAgencyOn })
            .FirstOrDefaultAsync(ct);

        if (sourceProposal?.SubmittedToAgencyOn is { } submittedOn && targetDate < submittedOn)
        {
            throw new GrantReceivedBeforeSubmissionException(targetDate, submittedOn);
        }

        var sanctionedForYear = resolvedYear switch
        {
            1 => budgetHead.Year1Amount,
            2 => budgetHead.Year2Amount,
            3 => budgetHead.Year3Amount,
            4 => budgetHead.Year4Amount,
            5 => budgetHead.Year5Amount,
            _ => 0m,
        };

        var alreadyReceivedForYear = project.GrantReceipts
            .Where(g => g.BudgetHeadId == budgetHeadId && g.Type == GrantReceiptType.Head)
            .Where(g => g.Status == GrantReceiptStatus.Approved)
            .Where(g => yearCalculator.GetProjectYear(project.StartDate, g.ReceivedDate) == resolvedYear)
            .Sum(g => g.Amount);

        var alreadyReceivedHistoricalForYear = project.HistoricalGrantReceipts
            .Where(h => h.BudgetHeadId == budgetHeadId)
            .Where(h => yearCalculator.GetProjectYear(project.StartDate, h.ReceivedDate) == resolvedYear)
            .Sum(h => h.Amount);

        var alreadyReceivedOverall = project.GrantReceipts
            .Where(g => g.BudgetHeadId == budgetHeadId && g.Type == GrantReceiptType.Head)
            .Where(g => g.Status == GrantReceiptStatus.Approved)
            .Sum(g => g.Amount);

        var alreadyReceivedHistoricalOverall = project.HistoricalGrantReceipts
            .Where(h => h.BudgetHeadId == budgetHeadId)
            .Sum(h => h.Amount);

        var overallSanctioned = budgetHead.Total;

        if (alreadyReceivedOverall + alreadyReceivedHistoricalOverall + amount > overallSanctioned)
        {
            throw new GrantReceiptExceedsSanctionException(
                alreadyReceivedOverall + alreadyReceivedHistoricalOverall + amount, overallSanctioned, resolvedYear);
        }

        if (alreadyReceivedForYear + alreadyReceivedHistoricalForYear + amount > sanctionedForYear)
        {
            if (string.IsNullOrWhiteSpace(remarks))
            {
                throw new WorkflowTransitionException(
                    $"Remarks are mandatory when grant receipt amount for Year {resolvedYear} exceeds the sanctioned amount of ₹{sanctionedForYear:N2}.");
            }
        }

        var receipt = new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            ReceivedDate = targetDate,
            Amount = amount,
            Type = GrantReceiptType.Head,
            TransactionReference = string.IsNullOrWhiteSpace(transactionReference)
                ? null
                : transactionReference.Trim(),
            PaymentMode = paymentMode,
            SchemeCode = string.IsNullOrWhiteSpace(schemeCode) ? null : schemeCode.Trim(),
            Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.GrantReceipts.Add(receipt);

        if (budgetHead.HeadName == BudgetHeadName.RecurringOverhead)
        {
            if (overheadSplit is null)
            {
                throw new ArgumentException("Overhead split is required when recording a receipt against the Overhead budget head.", nameof(overheadSplit));
            }

            var validation = overheadSplitValidator.Validate(amount, overheadSplit);
            if (!validation.IsValid)
            {
                throw new ArgumentException(validation.ErrorMessage, nameof(overheadSplit));
            }

            foreach (var (subHead, subAmount) in overheadSplit)
            {
                db.GrantReceipts.Add(new GrantReceipt
                {
                    Id = Guid.NewGuid(),
                    ProjectId = projectId,
                    BudgetHeadId = budgetHeadId,
                    ReceivedDate = targetDate,
                    Amount = subAmount,
                    Type = GrantReceiptType.OverheadSplit,
                    ParentReceiptId = receipt.Id,
                    SubHead = subHead,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            }
        }

        // Raise the approval chain against the PARENT receipt only -- overhead-
        // split children (added above, if any) inherit the parent's approval
        // state implicitly via ParentReceiptId and are never independently
        // raised. Raising lands on Draft (sequence 1, roleless, ownership-gated
        // -- see GrantReceiptWorkflowSeeder's own note on reusing
        // WorkflowStage.Draft). The PI's "submit for approval" is this same
        // call immediately forwarding to HOD, mirroring
        // ResearchProposalService.SubmitForApprovalAsync's Raise-then-Forward
        // pair.
        var instance = await workflowEngine.RaiseAsync(
            RequestType.GrantReceipt, receipt.Id, WorkflowPhase.Indent, requestingUserId, ct);
        if (project.CurrentDaUserId is { } daUserId)
        {
            instance.AssignedToUserId = daUserId;
            instance.IsAssignedViaProjectDa = true;
        }
        receipt.WorkflowInstanceId = instance.Id;

        await workflowEngine.ForwardAsync(
            instance.Id, requestingUserId, ["Faculty"],
            string.IsNullOrWhiteSpace(remarks) ? "Submitted for HOD approval" : remarks, ct);

        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            nameof(Project), projectId, "GrantReceiptRecorded", requestingUserId,
            $"BudgetHeadId={budgetHeadId};Amount={amount}", ct);
        return receipt;
    }

    private async Task<GrantReceipt> RequireGrantReceiptWorkflowAsync(Guid grantReceiptId, CancellationToken ct)
    {
        var receipt = await db.GrantReceipts.FirstOrDefaultAsync(g => g.Id == grantReceiptId, ct)
            ?? throw new GrantReceiptNotFoundException(grantReceiptId);

        if (receipt.WorkflowInstanceId is null)
        {
            throw new GrantReceiptWorkflowNotStartedException(grantReceiptId);
        }

        return receipt;
    }

    /// <summary>Stages the route gives no role -- see
    /// ResearchProposalService.PiOnlyStages' equivalent note: the engine's own
    /// role gate (WorkflowEngineService.RequireRoleAsync) is correctly a no-op
    /// when AllowedRoles is empty, so at a roleless stage nothing but this
    /// explicit ownership check keeps the action to the owning PI. Draft and
    /// ReturnedToPIGrantReceipt both carry empty AllowedRoles in
    /// GrantReceiptWorkflowSeeder.Route for the same reason proposals do:
    /// each is the PI's own step (first submission, and resubmitting after a
    /// Return), not a role-gated one. Without this gate, any authenticated
    /// Faculty account could forward another PI's returned, uncorrected
    /// receipt straight back into the HOD's queue.</summary>
    private static readonly HashSet<WorkflowStage> GrantReceiptPiOnlyStages =
        [WorkflowStage.Draft, WorkflowStage.ReturnedToPIGrantReceipt];

    private async Task RequirePiIfAtPiOnlyStageAsync(GrantReceipt receipt, Guid actorUserId, CancellationToken ct)
    {
        var instance = await workflowEngine.GetAsync(receipt.WorkflowInstanceId!.Value, ct);
        if (instance is null || !GrantReceiptPiOnlyStages.Contains(instance.CurrentStage))
        {
            return;
        }

        var project = await db.Projects
            .Select(p => new { p.Id, p.OwnerUserId })
            .FirstOrDefaultAsync(p => p.Id == receipt.ProjectId, ct)
            ?? throw new ProjectNotFoundException(receipt.ProjectId);

        if (project.OwnerUserId != actorUserId)
        {
            throw new ProjectAccessDeniedException(project.Id);
        }
    }

    public async Task ForwardGrantReceiptAsync(
        Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var receipt = await RequireGrantReceiptWorkflowAsync(grantReceiptId, ct);
        await RequirePiIfAtPiOnlyStageAsync(receipt, actorUserId, ct);
        await workflowEngine.ForwardAsync(receipt.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task<Guid?> GetGrantReceiptOwnershipAsync(Guid grantReceiptId, CancellationToken ct = default)
    {
        var projectOwnerUserId = await db.GrantReceipts
            .Where(g => g.Id == grantReceiptId)
            .Join(db.Projects, g => g.ProjectId, p => p.Id, (g, p) => p.OwnerUserId)
            .FirstOrDefaultAsync(ct);

        return projectOwnerUserId == default ? null : projectOwnerUserId;
    }

    public async Task RejectGrantReceiptAsync(
        Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var receipt = await RequireGrantReceiptWorkflowAsync(grantReceiptId, ct);
        await workflowEngine.RejectAsync(receipt.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);

        receipt.Status = GrantReceiptStatus.Rejected;
        await db.SaveChangesAsync(ct);
    }

    public async Task ReturnGrantReceiptAsync(
        Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var receipt = await RequireGrantReceiptWorkflowAsync(grantReceiptId, ct);
        // Status is not touched: a returned receipt has moved backward within
        // the internal chain, not left it -- PendingApproval already covers
        // this, matching ResearchProposalService.ReturnAsync's own reasoning.
        await workflowEngine.ReturnAsync(receipt.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task BulkActOnGrantReceiptsAsync(
        IReadOnlyCollection<Guid> grantReceiptIds, GrantReceiptBulkAction action,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks,
        CancellationToken ct = default)
    {
        // Real transaction on a relational provider (MySQL in production).
        // The in-memory provider used by the test suite does not support
        // transactions at all -- BeginTransactionAsync throws there -- so
        // tests exercise the same loop without DB-level atomicity; that is a
        // testability gap in the provider, not a production behavior change.
        var useTransaction = db.Database.IsRelational();
        var transaction = useTransaction ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            foreach (var receiptId in grantReceiptIds)
            {
                switch (action)
                {
                    case GrantReceiptBulkAction.Forward:
                        await ForwardGrantReceiptAsync(receiptId, actorUserId, actorRoles, remarks, ct);
                        break;
                    case GrantReceiptBulkAction.Approve:
                        await ApproveGrantReceiptAsync(receiptId, actorUserId, actorRoles, remarks, ct);
                        break;
                    case GrantReceiptBulkAction.Reject:
                        await RejectGrantReceiptAsync(receiptId, actorUserId, actorRoles, remarks, ct);
                        break;
                    case GrantReceiptBulkAction.Return:
                        await ReturnGrantReceiptAsync(receiptId, actorUserId, actorRoles, remarks, ct);
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

    public async Task ApproveGrantReceiptAsync(
        Guid grantReceiptId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var receipt = await RequireGrantReceiptWorkflowAsync(grantReceiptId, ct);

        // Global Constraint: re-check the sum ceiling immediately before
        // approving -- other receipts against the same budget head/year may
        // have been approved while this one sat in the chain. Load the project
        // and budget head fresh (not via the receipt's own now-stale in-memory
        // graph) so the sum reflects every OTHER approval that has landed since
        // this instance was raised. This check -- and the throw it can raise --
        // happens BEFORE workflowEngine.ApproveAsync is called, so a
        // financially-rejected approval leaves the workflow instance itself
        // unadvanced too, not just GrantReceipt.Status.
        var project = await LoadProjectWithChildrenAsync(receipt.ProjectId, ct)
            ?? throw new ProjectNotFoundException(receipt.ProjectId);
        var budgetHead = project.BudgetHeads.FirstOrDefault(b => b.Id == receipt.BudgetHeadId)
            ?? throw new GrantReceiptBudgetHeadNotFoundException(receipt.Id, receipt.BudgetHeadId);
        var resolvedYear = yearCalculator.GetProjectYear(project.StartDate, receipt.ReceivedDate);
        var overallSanctioned = budgetHead.Total;

        var alreadyApprovedOverall = project.GrantReceipts
            .Where(g => g.BudgetHeadId == receipt.BudgetHeadId && g.Type == GrantReceiptType.Head)
            .Where(g => g.Status == GrantReceiptStatus.Approved && g.Id != receipt.Id)
            .Sum(g => g.Amount);

        var alreadyApprovedHistoricalOverall = project.HistoricalGrantReceipts
            .Where(h => h.BudgetHeadId == receipt.BudgetHeadId)
            .Sum(h => h.Amount);

        if (alreadyApprovedOverall + alreadyApprovedHistoricalOverall + receipt.Amount > overallSanctioned)
        {
            throw new GrantReceiptExceedsSanctionException(
                alreadyApprovedOverall + alreadyApprovedHistoricalOverall + receipt.Amount, overallSanctioned, resolvedYear);
        }

        await workflowEngine.ApproveAsync(receipt.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);

        // This route has only ONE CanApprove stage (WithDeanGrantReceipt) --
        // unlike the Advertisement route's two-approve-distinction problem,
        // any successful ApproveAsync call on this instance IS the terminal
        // approval. Flip unconditionally, exactly as
        // ResearchProposalService.ApproveAsync does; no post-call CurrentStage
        // check is needed or added.
        receipt.Status = GrantReceiptStatus.Approved;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Stages considered "still in the internal chain" for queue
    /// purposes -- Draft is the PI's own state and Approved/Rejected are
    /// terminal, so none of the three queues below ever needs to filter
    /// those out explicitly; only the exact stage each queue owns is
    /// matched.</summary>
    private async Task<IReadOnlyList<GrantReceiptQueueItem>> ListAtStageAsync(
        WorkflowStage stage, IReadOnlyCollection<Guid>? projectIds, CancellationToken ct)
    {
        var candidates = await db.GrantReceipts
            .Where(g => g.WorkflowInstanceId != null && g.Status == GrantReceiptStatus.PendingApproval)
            .Where(g => projectIds == null || projectIds.Contains(g.ProjectId))
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return [];
        }

        var projectTitles = await db.Projects
            .Where(p => candidates.Select(g => g.ProjectId).Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);

        var atStage = new List<GrantReceiptQueueItem>();
        foreach (var receipt in candidates)
        {
            var instance = await workflowEngine.GetAsync(receipt.WorkflowInstanceId!.Value, ct);
            if (instance is not null && instance.CurrentStage == stage)
            {
                atStage.Add(new GrantReceiptQueueItem(
                    receipt.Id, receipt.ProjectId,
                    projectTitles.TryGetValue(receipt.ProjectId, out var title) ? title : string.Empty,
                    receipt.BudgetHeadId, receipt.ReceivedDate, receipt.Amount, receipt.Status,
                    receipt.WorkflowInstanceId, instance.CurrentStage, receipt.CreatedAt));
            }
        }

        return atStage;
    }

    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForHodGrantReceiptQueueAsync(
        Guid hodUserId, CancellationToken ct = default)
    {
        var departmentId = await userDepartment.GetDepartmentIdAsync(hodUserId, ct)
            ?? throw new OwnerHasNoDepartmentException(hodUserId);

        var projectIds = await db.Projects
            .Where(p => p.DepartmentId == departmentId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        return await ListAtStageAsync(WorkflowStage.WithHODGrantReceipt, projectIds, ct);
    }

    /// <summary>
    /// SECURITY: gated by <c>IInstituteWideScopeResolver.IsInstituteWideAsync</c>,
    /// exactly matching <c>ResearchProposalService.ListForRnCOfficeAsync</c>'s
    /// pattern -- an Office-group caller (Dean/DeputyRegistrar/Superintendent/
    /// RegularStaff) whose own department is not R&amp;C gets an empty list here.
    /// [PageAccess("...", AccessScope.Department)] alone does NOT enforce
    /// cross-department isolation -- it is a pure page-key membership check,
    /// and the Department-to-Institute widening it triggers only affects what
    /// scope is reported, not what is blocked. Without this explicit check, any
    /// Office-group role holder in any department could see every other
    /// department's pending grant receipts (the exact Critical
    /// cross-department information-disclosure bug the Advertisement plan's
    /// Task 6 originally shipped and its final review caught).
    /// </summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForRnCOfficeGrantReceiptQueueAsync(
        Guid officeUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(officeUserId, ct))
        {
            return [];
        }

        return await ListAtStageAsync(WorkflowStage.WithRnCOfficeGrantReceipt, null, ct);
    }

    /// <summary>Same department-scope gate as
    /// <see cref="ListForRnCOfficeGrantReceiptQueueAsync"/> -- see that
    /// method's remarks for why this check is required, not optional.</summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDeanGrantReceiptQueueAsync(
        Guid deanUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(deanUserId, ct))
        {
            return [];
        }

        return await ListAtStageAsync(WorkflowStage.WithDeanGrantReceipt, null, ct);
    }

    /// <summary>
    /// SECURITY: gated by <c>IInstituteWideScopeResolver.IsInstituteWideAsync</c>,
    /// same pattern as <see cref="ListForRnCOfficeGrantReceiptQueueAsync"/> --
    /// a RegularStaff caller whose own department is not R&amp;C gets an empty
    /// list here, not every department's queue.
    ///
    /// Also narrowed per-DA: AssignedToDAGrantReceipt's AllowedRoles is
    /// "RegularStaff", the same stage shape
    /// <c>WorkflowEngineService.RequireRoleAsync</c> generically narrows to
    /// <c>WorkflowInstance.AssignedToUserId</c> once <c>IsAssignedViaProjectDa</c>
    /// is set -- a receipt locked to a different DA must not appear here, or
    /// "select all" + bulk Forward would include a receipt the engine itself
    /// rejects the moment it's acted on, failing the whole all-or-nothing
    /// batch. Unassigned receipts (IsAssignedViaProjectDa == false, the
    /// default) are unaffected and still show for every DA.
    /// </summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDaGrantReceiptQueueAsync(
        Guid daUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(daUserId, ct))
        {
            return [];
        }

        var atStage = await ListAtStageAsync(WorkflowStage.AssignedToDAGrantReceipt, null, ct);
        if (atStage.Count == 0)
        {
            return atStage;
        }

        var instanceIds = atStage.Select(r => r.WorkflowInstanceId!.Value).ToHashSet();
        var lockedToOtherDa = await db.WorkflowInstances
            .Where(w => instanceIds.Contains(w.Id) && w.IsAssignedViaProjectDa && w.AssignedToUserId != daUserId)
            .Select(w => w.Id)
            .ToListAsync(ct);
        if (lockedToOtherDa.Count == 0)
        {
            return atStage;
        }

        var excluded = lockedToOtherDa.ToHashSet();
        return [.. atStage.Where(r => !excluded.Contains(r.WorkflowInstanceId!.Value))];
    }

    /// <summary>Same department-scope gate as
    /// <see cref="ListForDaGrantReceiptQueueAsync"/>.</summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForSuperintendentGrantReceiptQueueAsync(
        Guid superintendentUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(superintendentUserId, ct))
        {
            return [];
        }

        return await ListAtStageAsync(WorkflowStage.WithSuperintendentGrantReceipt, null, ct);
    }

    /// <summary>Same department-scope gate as
    /// <see cref="ListForDaGrantReceiptQueueAsync"/>.</summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListForDeputyRegistrarGrantReceiptQueueAsync(
        Guid drUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(drUserId, ct))
        {
            return [];
        }

        return await ListAtStageAsync(WorkflowStage.WithDeputyRegistrarGrantReceipt, null, ct);
    }

    /// <summary>
    /// Multi-role stages on the grant-receipt route (GrantReceiptWorkflowSeeder):
    /// AssignedToDAGrantReceipt ("RegularStaff"), WithSuperintendentGrantReceipt
    /// ("Superintendent"), WithDeputyRegistrarGrantReceipt ("DeputyRegistrar"),
    /// and WithDeanGrantReceipt ("Dean,Director"). Mirrors
    /// ResearchProposalService.OfficeChainStages exactly, for the same reason:
    /// a RegularStaff/Superintendent/DeputyRegistrar/Dean/Director account
    /// sits in one of these stages' AllowedRoles regardless of which
    /// department raised the receipt, so "my own department happens to
    /// match" must not be treated as visibility for these stages the way it
    /// legitimately is for a single-role stage like WithHODGrantReceipt.
    /// </summary>
    private static readonly HashSet<WorkflowStage> GrantReceiptOfficeChainStages =
    [
        WorkflowStage.AssignedToDAGrantReceipt,
        WorkflowStage.WithSuperintendentGrantReceipt,
        WorkflowStage.WithDeputyRegistrarGrantReceipt,
        WorkflowStage.WithDeanGrantReceipt,
    ];

    /// <summary>
    /// Grant receipts pending at any stage the caller's own roles can act
    /// on, resolved via IWorkflowPendingQueryService.ListPendingInstancesAsync
    /// (multi-stage/multi-role aware) rather than delegating to
    /// ListForHodGrantReceiptQueueAsync/ListForRnCOfficeGrantReceiptQueueAsync/
    /// ListForDeanGrantReceiptQueueAsync, each of which only ever checks its
    /// own single hardcoded WorkflowStage via ListAtStageAsync and so cannot
    /// answer "everything this caller can act on" for a caller with more
    /// than one relevant role. Department/institute-wide scoping is applied
    /// independently here, per-stage rather than as a blanket
    /// "same department OR institute-wide" check -- see
    /// GrantReceiptOfficeChainStages's own remarks for why the blanket form
    /// was a real cross-department information-disclosure gap (found by
    /// this plan's final whole-branch review: a RegularStaff/Superintendent/
    /// DeputyRegistrar/Dean account outside R&amp;C would otherwise see every
    /// other department's receipts sitting at the office-chain stages,
    /// exactly the class of bug ListForRnCOfficeGrantReceiptQueueAsync's own
    /// comment already warns about).
    /// </summary>
    public async Task<IReadOnlyList<GrantReceiptQueueItem>> ListPendingGrantReceiptsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.GrantReceipt, WorkflowPhase.Indent, roles, userId, ct);
        if (pending.Count == 0)
        {
            return [];
        }

        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        var isInstituteWide = await instituteWideScope.IsInstituteWideAsync(userId, ct);

        // pending.Keys.Contains(...), not pending.ContainsKey(...): the real
        // MySQL provider cannot translate IReadOnlyDictionary.ContainsKey to
        // SQL (only the InMemory test provider tolerates it), so this threw
        // InvalidOperationException on every call -- silently swallowed by
        // DashboardService's per-type catch.
        var pendingIds = pending.Keys;
        var receipts = await db.GrantReceipts
            .Where(r => r.WorkflowInstanceId != null && pendingIds.Contains(r.WorkflowInstanceId.Value))
            .ToListAsync(ct);

        if (receipts.Count == 0)
        {
            return [];
        }

        var projectIds = receipts.Select(r => r.ProjectId).ToHashSet();
        var projects = await db.Projects
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p, ct);

        bool IsVisible(GrantReceipt r) =>
            projects.TryGetValue(r.ProjectId, out var project) &&
            (GrantReceiptOfficeChainStages.Contains(pending[r.WorkflowInstanceId!.Value])
                ? isInstituteWide
                : departmentId is not null && project.DepartmentId == departmentId);

        var visible = receipts.Where(IsVisible);

        return
        [
            .. visible.Select(r => new GrantReceiptQueueItem(
                r.Id, r.ProjectId,
                projects.TryGetValue(r.ProjectId, out var p) ? p.ProjectTitle : string.Empty,
                r.BudgetHeadId, r.ReceivedDate, r.Amount, r.Status,
                r.WorkflowInstanceId, pending[r.WorkflowInstanceId!.Value], r.CreatedAt)),
        ];
    }

    private static readonly HashSet<WorkflowStage> ProjectOfficeChainStages =
    [
        WorkflowStage.WithRnCOffice,
        WorkflowStage.AssignedToDealingAssistant,
        WorkflowStage.WithSuperintendent,
        WorkflowStage.WithDeputyRegistrar,
        WorkflowStage.WithDean,
    ];

    public async Task<IReadOnlyList<ProjectPendingQueueItem>> ListPendingProjectsForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.ProjectUpdate, WorkflowPhase.Indent, roles, userId, ct);

        var pendingIds = pending.Keys;
        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        var isInstituteWide = await instituteWideScope.IsInstituteWideAsync(userId, ct);

        // Query projects matching pending workflow instances OR owned projects sitting at ReturnedToPI / PendingRevision
        var projects = await db.Projects
            .Where(p => !p.IsDeleted &&
                ((p.WorkflowInstanceId != null && pendingIds.Contains(p.WorkflowInstanceId.Value)) ||
                 (p.OwnerUserId == userId && (p.Status == ProjectStatus.PendingRevision || p.WorkflowInstanceId != null))))
            .ToListAsync(ct);

        if (projects.Count == 0)
        {
            return [];
        }

        var instanceIds = projects.Where(p => p.WorkflowInstanceId != null).Select(p => p.WorkflowInstanceId!.Value).Distinct().ToList();
        var instances = instanceIds.Count > 0
            ? await db.WorkflowInstances.Where(w => instanceIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, ct)
            : new Dictionary<Guid, WorkflowInstance>();

        bool IsVisible(Project p)
        {
            WorkflowInstance? instance = null;
            if (p.WorkflowInstanceId.HasValue)
            {
                instances.TryGetValue(p.WorkflowInstanceId.Value, out instance);
            }

            var stage = instance?.CurrentStage;
            if (stage == WorkflowStage.Approved)
            {
                return false;
            }

            if (instance != null && pending.TryGetValue(instance.Id, out var pendingStage))
            {
                if (ProjectOfficeChainStages.Contains(pendingStage))
                {
                    return isInstituteWide;
                }
                if (pendingStage == WorkflowStage.WithHOD)
                {
                    return departmentId is not null && p.DepartmentId == departmentId;
                }
                return true;
            }

            if (p.OwnerUserId == userId && (stage == WorkflowStage.ReturnedToPI || stage == WorkflowStage.Draft || p.Status == ProjectStatus.PendingRevision))
            {
                return true;
            }

            return false;
        }

        var visible = projects.Where(IsVisible).ToList();

        return visible.Select(p =>
        {
            var stage = p.WorkflowInstanceId.HasValue && instances.TryGetValue(p.WorkflowInstanceId.Value, out var inst)
                ? inst.CurrentStage
                : (WorkflowStage?)null;
            return new ProjectPendingQueueItem(
                p.Id,
                p.ProjectTitle,
                p.SanctionNo,
                p.Status.ToString(),
                p.WorkflowInstanceId,
                stage,
                p.CreatedAt);
        }).ToList();
    }

    public async Task<OfferLetter> CreateOfferLetterAsync(
        Guid? generatedByUserId, Guid projectId, Guid manpowerId, string candidateName,
        string gender, string parentName, string address, string city, string state,
        string pincode, decimal fellowshipAmount, decimal hraPercentage, DateOnly joiningDate,
        string? filePath = null, CancellationToken ct = default)
    {
        var offerLetter = new OfferLetter
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            ManpowerId = manpowerId,
            CandidateName = candidateName,
            Gender = gender,
            ParentName = parentName,
            Address = address,
            City = city,
            State = state,
            Pincode = pincode,
            FellowshipAmount = fellowshipAmount,
            HraPercentage = hraPercentage,
            JoiningDate = joiningDate,
            FilePath = filePath,
            GeneratedBy = generatedByUserId,
            GeneratedAt = DateTimeOffset.UtcNow,
        };

        db.OfferLetters.Add(offerLetter);
        await db.SaveChangesAsync(ct);
        return offerLetter;
    }

    public async Task<IReadOnlyList<OfferLetter>> GetOfferLettersAsync(
        Guid? projectId = null, Guid? manpowerId = null, CancellationToken ct = default)
    {
        var query = db.OfferLetters.AsQueryable();

        if (projectId.HasValue)
        {
            query = query.Where(o => o.ProjectId == projectId.Value);
        }

        if (manpowerId.HasValue)
        {
            query = query.Where(o => o.ManpowerId == manpowerId.Value);
        }

        return await query.OrderByDescending(o => o.GeneratedAt).ToListAsync(ct);
    }

    public async Task<ReappropriationRequest> RaiseReappropriationAsync(
        Guid projectId, Guid requestingUserId, string reason,
        IReadOnlyList<ReappropriationLineInput> sources,
        IReadOnlyList<ReappropriationLineInput> destinations,
        CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct)
            ?? throw new KeyNotFoundException($"Project {projectId} not found.");

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        if (project.Status != ProjectStatus.Approved && project.Status != ProjectStatus.Active)
        {
            throw new InvalidOperationException("Budget reappropriation cannot be performed until the project is approved by the Dean.");
        }

        var sourceTotal = sources.Sum(s => s.Amount);
        var destTotal = destinations.Sum(d => d.Amount);
        if (sourceTotal != destTotal)
        {
            throw new ArgumentException($"Source total ({sourceTotal}) does not match destination total ({destTotal}).");
        }
        if (sourceTotal <= 0)
        {
            throw new ArgumentException("Reappropriation amount must be greater than zero.");
        }

        foreach (var source in sources)
        {
            var fromHead = project.BudgetHeads.FirstOrDefault(b => b.Id == source.BudgetHeadId)
                ?? throw new KeyNotFoundException($"Budget head {source.BudgetHeadId} not found in project.");
            var fromEffectiveReceived = BudgetHeadEffectiveReceived.Calculate(project, source.BudgetHeadId);
            if (source.Amount > fromEffectiveReceived)
            {
                throw new ReappropriationExceedsReceivedException(source.HeadName, source.Amount, fromEffectiveReceived);
            }
        }
        
        foreach (var dest in destinations)
        {
            var toHead = project.BudgetHeads.FirstOrDefault(b => b.Id == dest.BudgetHeadId)
                ?? throw new KeyNotFoundException($"Budget head {dest.BudgetHeadId} not found in project.");
            var toEffectiveReceived = BudgetHeadEffectiveReceived.Calculate(project, dest.BudgetHeadId);
            if (toEffectiveReceived + dest.Amount > toHead.Total)
            {
                throw new ReappropriationExceedsSanctionException(dest.HeadName, toEffectiveReceived + dest.Amount, toHead.Total);
            }
        }

        var request = new ReappropriationRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Reason = reason,
            Status = ReappropriationRequestStatus.PendingApproval,
            RequestedByUserId = requestingUserId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var source in sources)
        {
            request.SourceLines.Add(new ReappropriationSourceLine
            {
                Id = Guid.NewGuid(),
                ReappropriationRequestId = request.Id,
                BudgetHeadId = source.BudgetHeadId,
                HeadName = source.HeadName,
                Amount = source.Amount
            });
        }

        foreach (var dest in destinations)
        {
            request.DestinationLines.Add(new ReappropriationDestinationLine
            {
                Id = Guid.NewGuid(),
                ReappropriationRequestId = request.Id,
                BudgetHeadId = dest.BudgetHeadId,
                HeadName = dest.HeadName,
                Amount = dest.Amount
            });
        }

        db.ReappropriationRequests.Add(request);
        await db.SaveChangesAsync(ct);

        var engineResponse = await workflowEngine.RaiseAsync(
            RequestType.Reappropriation, request.Id, WorkflowPhase.Indent, requestingUserId, ct);

        request.WorkflowInstanceId = engineResponse.Id;
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(nameof(Project), projectId, "ReappropriationRaised", requestingUserId, $"RequestId={request.Id};Amount={sourceTotal}", ct);

        // Reappropriation is a one-click submit, so we immediately forward it out of Draft to HOD
        // The actor has the "Faculty" role typically, but the engine checks if they are the requester.
        await workflowEngine.ForwardAsync(engineResponse.Id, requestingUserId, ["Faculty"], "Submitted for approval", ct);

        return request;
    }

    public async Task UpdateAndResubmitReappropriationAsync(
        Guid requestId, Guid requestingUserId, string reason,
        IReadOnlyList<ReappropriationLineInput> sources,
        IReadOnlyList<ReappropriationLineInput> destinations,
        string? remarks = null,
        CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests
            .Include(r => r.Project)
            .Include(r => r.SourceLines)
            .Include(r => r.DestinationLines)
            .FirstOrDefaultAsync(r => r.Id == requestId, ct)
            ?? throw new KeyNotFoundException($"ReappropriationRequest {requestId} not found.");

        if (request.Project!.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(request.ProjectId);
        }

        if (request.Status != ReappropriationRequestStatus.PendingApproval)
        {
            throw new InvalidOperationException($"ReappropriationRequest is not pending approval (Status: {request.Status}).");
        }

        if (request.WorkflowInstanceId is null) throw new InvalidOperationException($"ReappropriationRequest {requestId} has no workflow instance.");

        var instance = await workflowEngine.GetAsync(request.WorkflowInstanceId.Value, ct);
        if (instance == null || instance.CurrentStage != WorkflowStage.ReappropriationReturnedToPI)
        {
            throw new InvalidOperationException($"Cannot resubmit unless current stage is Returned To PI (Stage is {instance?.CurrentStage}).");
        }

        var sourceTotal = sources.Sum(s => s.Amount);
        var destTotal = destinations.Sum(d => d.Amount);
        if (sourceTotal != destTotal)
        {
            throw new ArgumentException($"Source total ({sourceTotal}) does not match destination total ({destTotal}).");
        }
        if (sourceTotal <= 0)
        {
            throw new ArgumentException("Reappropriation amount must be greater than zero.");
        }

        // Check head validations
        var project = await LoadProjectWithChildrenAsync(request.ProjectId, ct) ?? throw new KeyNotFoundException();
        
        foreach (var source in sources)
        {
            var fromHead = project.BudgetHeads.FirstOrDefault(b => b.Id == source.BudgetHeadId)
                ?? throw new KeyNotFoundException($"Budget head {source.BudgetHeadId} not found in project.");
            var fromEffectiveReceived = BudgetHeadEffectiveReceived.Calculate(project, source.BudgetHeadId);
            if (source.Amount > fromEffectiveReceived)
            {
                throw new ReappropriationExceedsReceivedException(source.HeadName, source.Amount, fromEffectiveReceived);
            }
        }
        
        foreach (var dest in destinations)
        {
            var toHead = project.BudgetHeads.FirstOrDefault(b => b.Id == dest.BudgetHeadId)
                ?? throw new KeyNotFoundException($"Budget head {dest.BudgetHeadId} not found in project.");
            var toEffectiveReceived = BudgetHeadEffectiveReceived.Calculate(project, dest.BudgetHeadId);
            if (toEffectiveReceived + dest.Amount > toHead.Total)
            {
                throw new ReappropriationExceedsSanctionException(dest.HeadName, toEffectiveReceived + dest.Amount, toHead.Total);
            }
        }

        // Update fields
        request.Reason = reason;

        // Update SourceLines in-place
        var existingSources = request.SourceLines.ToList();
        for (int i = 0; i < sources.Count; i++)
        {
            if (i < existingSources.Count)
            {
                existingSources[i].BudgetHeadId = sources[i].BudgetHeadId;
                existingSources[i].HeadName = sources[i].HeadName;
                existingSources[i].Amount = sources[i].Amount;
            }
            else
            {
                request.SourceLines.Add(new ReappropriationSourceLine
                {
                    Id = Guid.NewGuid(),
                    ReappropriationRequestId = request.Id,
                    BudgetHeadId = sources[i].BudgetHeadId,
                    HeadName = sources[i].HeadName,
                    Amount = sources[i].Amount
                });
            }
        }
        for (int i = sources.Count; i < existingSources.Count; i++)
        {
            request.SourceLines.Remove(existingSources[i]);
            db.ReappropriationSourceLines.Remove(existingSources[i]);
        }

        // Update DestinationLines in-place
        var existingDests = request.DestinationLines.ToList();
        for (int i = 0; i < destinations.Count; i++)
        {
            if (i < existingDests.Count)
            {
                existingDests[i].BudgetHeadId = destinations[i].BudgetHeadId;
                existingDests[i].HeadName = destinations[i].HeadName;
                existingDests[i].Amount = destinations[i].Amount;
            }
            else
            {
                request.DestinationLines.Add(new ReappropriationDestinationLine
                {
                    Id = Guid.NewGuid(),
                    ReappropriationRequestId = request.Id,
                    BudgetHeadId = destinations[i].BudgetHeadId,
                    HeadName = destinations[i].HeadName,
                    Amount = destinations[i].Amount
                });
            }
        }
        for (int i = destinations.Count; i < existingDests.Count; i++)
        {
            request.DestinationLines.Remove(existingDests[i]);
            db.ReappropriationDestinationLines.Remove(existingDests[i]);
        }

        await db.SaveChangesAsync(ct);
        await audit.LogAsync(nameof(Project), request.ProjectId, "ReappropriationResubmitted", requestingUserId, $"RequestId={request.Id};Amount={sourceTotal}", ct);

        // Forward it out of ReturnedToPI to DA (bypass HOD)
        await workflowEngine.ForwardAsync(instance.Id, requestingUserId, ["Faculty"], remarks ?? "Resubmitted after corrections", ct);
    }

    private static readonly WorkflowStage[] ReappropriationPiOnlyStages = [WorkflowStage.Draft, WorkflowStage.ReappropriationReturnedToPI];

    public async Task ForwardReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests.Include(r => r.Project).FirstOrDefaultAsync(r => r.Id == requestId, ct)
            ?? throw new KeyNotFoundException($"ReappropriationRequest {requestId} not found.");

        if (request.WorkflowInstanceId is null) throw new InvalidOperationException($"ReappropriationRequest {requestId} has no workflow instance.");

        var instance = await workflowEngine.GetAsync(request.WorkflowInstanceId.Value, ct);
        if (instance != null && ReappropriationPiOnlyStages.Contains(instance.CurrentStage) && request.Project!.OwnerUserId != actorUserId)
        {
            throw new WorkflowAuthorizationException($"PI stage but actor {actorUserId} is not the PI.");
        }

        await workflowEngine.ForwardAsync(request.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ApproveReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests
            .Include(r => r.Project)
            .ThenInclude(p => p!.BudgetHeads)
            .Include(r => r.SourceLines)
            .Include(r => r.DestinationLines)
            .FirstOrDefaultAsync(r => r.Id == requestId, ct)
            ?? throw new KeyNotFoundException($"ReappropriationRequest {requestId} not found.");

        if (request.WorkflowInstanceId is null) throw new InvalidOperationException($"ReappropriationRequest {requestId} has no workflow instance.");

        await workflowEngine.ApproveAsync(request.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        request.Status = ReappropriationRequestStatus.Approved;
        await db.SaveChangesAsync(ct);
    }

    public async Task RejectReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct)
            ?? throw new KeyNotFoundException($"ReappropriationRequest {requestId} not found.");

        if (request.WorkflowInstanceId is null) throw new InvalidOperationException($"ReappropriationRequest {requestId} has no workflow instance.");

        await workflowEngine.RejectAsync(request.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
        request.Status = ReappropriationRequestStatus.Rejected;
        await db.SaveChangesAsync(ct);
    }

    public async Task ReturnReappropriationAsync(Guid requestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct)
            ?? throw new KeyNotFoundException($"ReappropriationRequest {requestId} not found.");

        if (request.WorkflowInstanceId is null) throw new InvalidOperationException($"ReappropriationRequest {requestId} has no workflow instance.");

        await workflowEngine.ReturnAsync(request.WorkflowInstanceId.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task<IReadOnlyList<ReappropriationQueueItem>> ListPendingReappropriationsAsync(Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pendingInstances = await pendingQuery.ListPendingInstancesAsync(
            RequestType.Reappropriation, WorkflowPhase.Indent, roles, userId, ct);

        if (pendingInstances.Count == 0) return [];

        var instanceIds = pendingInstances.Keys.ToList();
        var requests = await db.ReappropriationRequests
            .Include(r => r.Project)
            .Include(r => r.SourceLines)
            .Include(r => r.DestinationLines)
            .Where(r => r.WorkflowInstanceId != null && instanceIds.Contains(r.WorkflowInstanceId.Value))
            .ToListAsync(ct);

        var result = new List<ReappropriationQueueItem>();
        foreach (var req in requests)
        {
            var info = pendingInstances.First(i => i.Key == req.WorkflowInstanceId);
            result.Add(new ReappropriationQueueItem(
                req.Id,
                req.ProjectId,
                req.Project!.ProjectTitle,
                req.Reason,
                req.SourceLines.Sum(l => l.Amount),
                req.SourceLines.Select(l => new ReappropriationQueueLineItem(l.HeadName, l.Amount)).ToList(),
                req.DestinationLines.Select(l => new ReappropriationQueueLineItem(l.HeadName, l.Amount)).ToList(),
                req.Status.ToString(),
                req.WorkflowInstanceId,
                info.Value.ToString(),
                req.CreatedAt
            ));
        }
        return result.OrderByDescending(r => r.CreatedAt).ToList();
    }

    public async Task<IReadOnlyList<ReappropriationQueueItem>> ListHistoryReappropriationsAsync(Guid userId, CancellationToken ct = default)
    {
        // 1. Find all workflow instance IDs (of Reappropriation) where this user was a step actor
        var historyInstanceIds = await db.WorkflowSteps
            .Join(db.WorkflowInstances, s => s.WorkflowInstanceId, i => i.Id, (s, i) => new { s, i })
            .Where(x => x.s.ActorUserId == userId && x.i.RequestType == RequestType.Reappropriation)
            .Select(x => x.s.WorkflowInstanceId)
            .Distinct()
            .ToListAsync(ct);

        if (!historyInstanceIds.Any()) return new List<ReappropriationQueueItem>();

        // 2. Fetch the corresponding Reappropriation requests
        var requests = await db.ReappropriationRequests
            .Include(r => r.Project)
            .Include(r => r.SourceLines)
            .Include(r => r.DestinationLines)
            .Where(r => r.WorkflowInstanceId != null && historyInstanceIds.Contains(r.WorkflowInstanceId.Value))
            .ToListAsync(ct);

        // 3. Fetch current stage from instances
        var instances = await db.WorkflowInstances
            .Where(i => historyInstanceIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.CurrentStage, ct);

        var result = new List<ReappropriationQueueItem>();
        foreach (var req in requests)
        {
            var stage = instances.GetValueOrDefault(req.WorkflowInstanceId!.Value);
            result.Add(new ReappropriationQueueItem(
                req.Id,
                req.ProjectId,
                req.Project!.ProjectTitle,
                req.Reason,
                req.SourceLines.Sum(l => l.Amount),
                req.SourceLines.Select(l => new ReappropriationQueueLineItem(l.HeadName, l.Amount)).ToList(),
                req.DestinationLines.Select(l => new ReappropriationQueueLineItem(l.HeadName, l.Amount)).ToList(),
                req.Status.ToString(),
                req.WorkflowInstanceId,
                stage.ToString(),
                req.CreatedAt
            ));
        }
        return result.OrderByDescending(r => r.CreatedAt).ToList();
    }

    public async Task<ReappropriationRequest?> GetReappropriationAsync(Guid requestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var request = await db.ReappropriationRequests
            .Include(r => r.Project)
            .Include(r => r.SourceLines)
            .Include(r => r.DestinationLines)
            .FirstOrDefaultAsync(r => r.Id == requestId, ct);

        if (request is null)
        {
            return null;
        }

        // Was unauthenticated in effect (requestingUserId/requestingUserRoles were
        // accepted but never checked): any signed-in user could read any project's
        // reappropriation financial detail by guessing requestId. GetAsync is the
        // same owner/RnC-office/HOD/active-fellow gate ProjectService.GetAsync
        // enforces everywhere else project data is read.
        await GetAsync(request.ProjectId, requestingUserId, requestingUserRoles, ct);

        return request;
    }


    private async Task<Project?> LoadProjectWithChildrenAsync(Guid projectId, CancellationToken ct)
    {
        return await db.Projects
            .Include(p => p.Collaborators)
            .Include(p => p.BudgetHeads)
            .Include(p => p.SanctionedEquipment)
            .Include(p => p.SanctionedManpowerPositions)
            .Include(p => p.GrantReceipts)
            .Include(p => p.HistoricalGrantReceipts)
            .Include(p => p.BudgetReappropriationLogs)
            .Include(p => p.ReappropriationRequests!)
                .ThenInclude(r => r.SourceLines)
            .Include(p => p.ReappropriationRequests!)
                .ThenInclude(r => r.DestinationLines)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);
    }

    private void UpsertCollaborators(Project project, IReadOnlyList<CollaboratorInput> inputs)
    {
        var existingCollaborators = project.Collaborators.ToList();
        var matchedExisting = new HashSet<Collaborator>();
        var inputMatches = new Dictionary<CollaboratorInput, Collaborator>();

        // 1. Match by Id if provided
        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var match = existingCollaborators.FirstOrDefault(c => c.Id == input.Id.Value);
                if (match != null && matchedExisting.Add(match))
                {
                    inputMatches[input] = match;
                }
            }
        }

        // 2. Match by Faculty and Institute for remaining
        foreach (var input in inputs)
        {
            if (inputMatches.ContainsKey(input)) continue;
            var match = existingCollaborators.FirstOrDefault(c => !matchedExisting.Contains(c)
                && string.Equals(c.Faculty?.Trim(), input.Faculty?.Trim(), StringComparison.OrdinalIgnoreCase)
                && string.Equals(c.Institute?.Trim(), input.Institute?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match != null && matchedExisting.Add(match))
            {
                inputMatches[input] = match;
            }
        }

        // Remove unmatched existing
        foreach (var existing in existingCollaborators.Where(c => !matchedExisting.Contains(c)).ToList())
        {
            project.Collaborators.Remove(existing);
            db.Collaborators.Remove(existing);
        }

        // Update or insert
        foreach (var input in inputs)
        {
            if (inputMatches.TryGetValue(input, out var existing))
            {
                existing.Institute = input.Institute;
                existing.Faculty = input.Faculty;
                existing.IsInsideInstitute = input.IsInsideInstitute;
                existing.Department = input.Department;
                existing.Designation = input.Designation;
            }
            else
            {
                var created = new Collaborator { Id = input.Id ?? Guid.NewGuid(), ProjectId = project.Id, Institute = input.Institute, Faculty = input.Faculty, IsInsideInstitute = input.IsInsideInstitute, Department = input.Department, Designation = input.Designation };
                project.Collaborators.Add(created);
                db.Collaborators.Add(created);
            }
        }
    }

    private void UpsertBudgetHeads(Project project, IReadOnlyList<BudgetHeadInput> inputs)
    {
        foreach (var input in inputs)
        {
            ValidateBudgetHeadInput(input);
        }
        RequireNoDuplicateBudgetHeads(inputs);

        var existingHeads = project.BudgetHeads.ToList();
        var matchedExisting = new HashSet<BudgetHead>();
        var inputMatches = new Dictionary<BudgetHeadInput, BudgetHead>();

        // 1. Match by input.Id if provided and matches an existing head
        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var match = existingHeads.FirstOrDefault(e => e.Id == input.Id.Value);
                if (match != null && matchedExisting.Add(match))
                {
                    inputMatches[input] = match;
                }
            }
        }

        // 2. Match standard heads by HeadName
        foreach (var input in inputs)
        {
            if (inputMatches.ContainsKey(input)) continue;
            if (input.HeadName != BudgetHeadName.Other)
            {
                var match = existingHeads.FirstOrDefault(e => !matchedExisting.Contains(e) && e.HeadName == input.HeadName);
                if (match != null && matchedExisting.Add(match))
                {
                    inputMatches[input] = match;
                }
            }
        }

        // 3. Match 'Other' heads by CustomLabel
        foreach (var input in inputs)
        {
            if (inputMatches.ContainsKey(input)) continue;
            if (input.HeadName == BudgetHeadName.Other)
            {
                var match = existingHeads.FirstOrDefault(e => !matchedExisting.Contains(e)
                    && e.HeadName == BudgetHeadName.Other
                    && string.Equals(e.CustomLabel?.Trim(), input.CustomLabel?.Trim(), StringComparison.OrdinalIgnoreCase));
                if (match != null && matchedExisting.Add(match))
                {
                    inputMatches[input] = match;
                }
            }
        }

        // 4. If single unmatched 'Other' input and single unmatched 'Other' existing, match them
        var remainingOtherInputs = inputs.Where(i => !inputMatches.ContainsKey(i) && i.HeadName == BudgetHeadName.Other).ToList();
        var remainingOtherExisting = existingHeads.Where(e => !matchedExisting.Contains(e) && e.HeadName == BudgetHeadName.Other).ToList();
        if (remainingOtherInputs.Count == 1 && remainingOtherExisting.Count == 1)
        {
            matchedExisting.Add(remainingOtherExisting[0]);
            inputMatches[remainingOtherInputs[0]] = remainingOtherExisting[0];
        }

        // Remove unmatched existing
        foreach (var existing in existingHeads.Where(e => !matchedExisting.Contains(e)).ToList())
        {
            project.BudgetHeads.Remove(existing);
            db.BudgetHeads.Remove(existing);
        }

        // Update or insert
        foreach (var input in inputs)
        {
            var total = input.Year1Amount + input.Year2Amount + input.Year3Amount + input.Year4Amount + input.Year5Amount;
            if (inputMatches.TryGetValue(input, out var existing))
            {
                existing.HeadName = input.HeadName;
                existing.Year1Amount = input.Year1Amount;
                existing.Year2Amount = input.Year2Amount;
                existing.Year3Amount = input.Year3Amount;
                existing.Year4Amount = input.Year4Amount;
                existing.Year5Amount = input.Year5Amount;
                existing.Total = total;
                existing.CustomLabel = input.CustomLabel;
            }
            else
            {
                var created = new BudgetHead
                {
                    Id = input.Id ?? Guid.NewGuid(),
                    ProjectId = project.Id,
                    HeadName = input.HeadName,
                    Year1Amount = input.Year1Amount,
                    Year2Amount = input.Year2Amount,
                    Year3Amount = input.Year3Amount,
                    Year4Amount = input.Year4Amount,
                    Year5Amount = input.Year5Amount,
                    Total = total,
                    CustomLabel = input.CustomLabel,
                };
                project.BudgetHeads.Add(created);
                db.BudgetHeads.Add(created);
            }
        }

        // Repair any orphaned grant receipts whose BudgetHeadId lost reference from a prior update
        var overheadHead = project.BudgetHeads.FirstOrDefault(h => h.HeadName == BudgetHeadName.RecurringOverhead);
        var activeHeadIds = project.BudgetHeads.Select(h => h.Id).ToHashSet();
        foreach (var receipt in project.GrantReceipts.Where(g => !activeHeadIds.Contains(g.BudgetHeadId)).ToList())
        {
            if (overheadHead != null && (receipt.SubHead != null || project.GrantReceipts.Any(c => c.ParentReceiptId == receipt.Id && c.Type == GrantReceiptType.OverheadSplit)))
            {
                receipt.BudgetHeadId = overheadHead.Id;
            }
            else if (project.BudgetHeads.Count == 1)
            {
                receipt.BudgetHeadId = project.BudgetHeads.First().Id;
            }
        }
    }

    private void UpsertEquipment(Project project, IReadOnlyList<SanctionedEquipmentInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.SanctionedEquipment.Where(e => !inputIds.Contains(e.Id)).ToList())
        {
            project.SanctionedEquipment.Remove(existing);
            db.SanctionedEquipment.Remove(existing);
        }

        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var existing = project.SanctionedEquipment.First(e => e.Id == input.Id.Value);
                existing.Name = input.Name;
                existing.Unit = input.Unit;
                existing.Amount = input.Amount;
            }
            else
            {
                var created = new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = project.Id, Name = input.Name, Unit = input.Unit, Amount = input.Amount };
                project.SanctionedEquipment.Add(created);
                db.SanctionedEquipment.Add(created);
            }
        }
    }

    private void UpsertManpower(Project project, IReadOnlyList<SanctionedManpowerPositionInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.SanctionedManpowerPositions.Where(m => !inputIds.Contains(m.Id)).ToList())
        {
            project.SanctionedManpowerPositions.Remove(existing);
            db.SanctionedManpowerPositions.Remove(existing);
        }

        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var existing = project.SanctionedManpowerPositions.First(m => m.Id == input.Id.Value);
                existing.Designation = input.Designation;
                existing.Positions = input.Positions;
                existing.Stipend = input.Stipend;
                existing.Hra = input.Hra;
            }
            else
            {
                var created = new SanctionedManpowerPosition
                {
                    Id = Guid.NewGuid(),
                    ProjectId = project.Id,
                    Designation = input.Designation,
                    Positions = input.Positions,
                    Stipend = input.Stipend,
                    Hra = input.Hra,
                };
                project.SanctionedManpowerPositions.Add(created);
                db.SanctionedManpowerPositions.Add(created);
            }
        }
    }

    private static readonly HashSet<string> DaAssignmentRoles =
        new(StringComparer.OrdinalIgnoreCase) { "Superintendent", "Dean" };

    /// <summary>
    /// Whether an actor holding <paramref name="actorRoles"/> may assign or
    /// reassign a project's Dealing Assistant (Superintendent or Dean).
    /// Exposed so ProjectsController can check the actor BEFORE looking up
    /// anything about the target user.
    /// </summary>
    public static bool CanAssignDa(IEnumerable<string> actorRoles) =>
        actorRoles.Any(r => DaAssignmentRoles.Contains(r));

    public const string DaAssignmentForbiddenMessage =
        "Only Superintendent or Dean may assign or reassign a project's Dealing Assistant.";

    public async Task AssignDaAsync(
        Guid projectId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        Guid newDaUserId, string reason, CancellationToken ct = default)
    {
        if (!CanAssignDa(actorRoles))
        {
            throw new WorkflowAuthorizationException(DaAssignmentForbiddenMessage);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("A reason is required to assign or reassign the Dealing Assistant.", nameof(reason));
        }

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectNotFoundException(projectId);

        var fromUserId = project.CurrentDaUserId;
        string? fromUserName = null;
        if (fromUserId is { } previousDaId)
        {
            fromUserName = await db.Users
                .Where(u => u.Id == previousDaId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(ct) ?? "(former user)";
        }

        var toUserName = await db.Users
            .Where(u => u.Id == newDaUserId)
            .Select(u => u.FullName)
            .FirstAsync(ct);

        db.ProjectDaAssignmentLogs.Add(new ProjectDaAssignmentLog
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            FromUserId = fromUserId,
            FromUserName = fromUserName,
            ToUserId = newDaUserId,
            ToUserName = toUserName,
            Reason = reason,
            PerformedByUserId = actorUserId,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        if (fromUserId is { } oldDaUserId && oldDaUserId != newDaUserId)
        {
            await MigrateOpenDaInstancesAsync(projectId, oldDaUserId, newDaUserId, ct);
        }

        project.CurrentDaUserId = newDaUserId;
        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            nameof(Project), projectId, "DaAssigned", actorUserId,
            $"From={fromUserId};To={newDaUserId};Reason={reason}", ct);
    }

    /// <summary>
    /// Stages at which a workflow instance is finished and its history must
    /// never be rewritten by a DA reassignment. Mirrors
    /// WorkflowEngineService's terminal set, plus IndentApproved (the Indent
    /// chain's own terminal approval stage, IsTerminal in IndentWorkflowSeeder).
    /// </summary>
    private static readonly WorkflowStage[] DaMigrationTerminalStages =
    [
        WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled,
        WorkflowStage.IndentApproved,
    ];

    /// <summary>
    /// On a DA reassignment, moves every still-open instance that was
    /// DA-locked to the outgoing DA on THIS project over to the incoming DA.
    /// Instances assigned to anyone else, manually assigned (not via the
    /// project DA), or already at a terminal stage are left untouched.
    /// </summary>
    /// <remarks>
    /// A WorkflowInstance only knows (RequestType, RequestId), not its
    /// project, so the candidate set is first narrowed on the instance table
    /// alone (outgoing DA + IsAssignedViaProjectDa + non-terminal), then each
    /// request table that feeds a DA-populated raise is asked which of those
    /// RequestIds belong to this project. Matching on RequestId (globally
    /// unique Guids) rather than RequestType is deliberate: the dynamic-indent
    /// bill path in IndentServiceBase raises its Bill instance under the
    /// calling service's RequestType (Consumable/Equipment/Contingency) while
    /// the RequestId points at the Indents table. Fellowship claims have no
    /// ProjectId of their own: claim -> appointment (ManpowerSelection) ->
    /// SanctionedManpowerPosition.ProjectId, the same chain the raise-time
    /// hook in FellowshipService uses. Changes are tracked only; the caller's
    /// single SaveChangesAsync persists them with the log row.
    /// </remarks>
    private async Task MigrateOpenDaInstancesAsync(
        Guid projectId, Guid oldDaUserId, Guid newDaUserId, CancellationToken ct)
    {
        var candidates = await db.WorkflowInstances
            .Where(w => w.AssignedToUserId == oldDaUserId
                     && w.IsAssignedViaProjectDa
                     && !DaMigrationTerminalStages.Contains(w.CurrentStage))
            .ToListAsync(ct);
        if (candidates.Count == 0)
        {
            return;
        }

        var candidateRequestIds = candidates.Select(w => w.RequestId).Distinct().ToList();
        var projectRequestIds = new HashSet<Guid>();

        projectRequestIds.UnionWith(await db.Indents
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await db.ConsumableIndents
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await db.ContingencyIndents
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await db.EquipmentIndents
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await db.TravelRequests
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await db.GrantReceipts
            .Where(x => x.ProjectId == projectId && candidateRequestIds.Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct));
        projectRequestIds.UnionWith(await (
                from claim in db.FellowshipClaims
                join appointment in db.ManpowerSelections on claim.FellowAppointmentId equals appointment.Id
                join position in db.SanctionedManpowerPositions on appointment.SanctionedManpowerPositionId equals position.Id
                where position.ProjectId == projectId && candidateRequestIds.Contains(claim.Id)
                select claim.Id)
            .ToListAsync(ct));

        foreach (var instance in candidates.Where(w => projectRequestIds.Contains(w.RequestId)))
        {
            instance.AssignedToUserId = newDaUserId;
            instance.IsAssignedViaProjectDa = true;
        }
    }

    public async Task<IReadOnlyList<ProjectDaAssignmentLog>> GetDaAssignmentHistoryAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        CancellationToken ct = default)
    {
        var project = await GetAsync(projectId, requestingUserId, requestingUserRoles, ct);
        if (project is null)
        {
            throw new ProjectNotFoundException(projectId);
        }

        return await db.ProjectDaAssignmentLogs
            .Where(l => l.ProjectId == projectId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);
    }
}
