using API.Application.Access;
using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Reporting;

public class ReportingService(
    IApplicationDbContext db,
    IUserDepartmentProvider userDepartment,
    IInstituteWideScopeResolver instituteWideScope,
    IStaffDirectory staffDirectory) : IReportingService
{
    private static readonly HashSet<string> OfficeRoles =
        new(StringComparer.OrdinalIgnoreCase) { "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff" };

    private enum Scope { Own, Department, Institute }

    /// <summary>
    /// Faculty/Fellow -> Own; HOD -> Department; the office roles ->
    /// Institute if their department is R&amp;C, Department otherwise --
    /// exactly the widening rule already governing page access and the
    /// proposal/indent queues, applied here for the first time to a
    /// SUM/GROUP BY report rather than a flat list of rows.
    /// </summary>
    private async Task<(Scope Scope, Guid? DepartmentId)> ResolveScopeAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct)
    {
        var isHod = roles.Contains("HOD", StringComparer.OrdinalIgnoreCase);
        var isOffice = roles.Any(OfficeRoles.Contains);

        if (!isHod && !isOffice)
        {
            return (Scope.Own, null);
        }

        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);

        if (isOffice && await instituteWideScope.IsInstituteWideAsync(userId, ct))
        {
            return (Scope.Institute, null);
        }

        // HOD, or an office role whose own department is not R&C: both see
        // their own department only, not every department.
        return (Scope.Department, departmentId);
    }

    public async Task<IReadOnlyList<NumberOfProjectsRow>> GetNumberOfProjectsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var query = db.Projects.Where(p => !p.IsDeleted);
        query = ApplyScope(query, scope, departmentId, requestingUserId);
        query = ApplyDateRange(query, from, to);

        var projects = await query
            .Select(p => new { p.ProjectType, p.DepartmentId })
            .ToListAsync(ct);

        var departmentNames = await db.Departments.ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        return projects
            .GroupBy(p => (p.ProjectType, p.DepartmentId))
            .Select(g => new NumberOfProjectsRow(
                g.Key.ProjectType, g.Key.DepartmentId,
                departmentNames.GetValueOrDefault(g.Key.DepartmentId, "Unknown"), g.Count()))
            .ToList();
    }

    public async Task<IReadOnlyList<GrantSanctionedRow>> GetGrantSanctionedAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var query = db.Projects.Where(p => !p.IsDeleted);
        query = ApplyScope(query, scope, departmentId, requestingUserId);

        if (from is { } f) query = query.Where(p => p.SanctionDate >= f);
        if (to is { } t) query = query.Where(p => p.SanctionDate <= t);

        // Ordered before the projection: OrderByDescending on a member of a
        // client-constructed record (GrantSanctionedRow) cannot be
        // translated by MySQL/Pomelo -- caught only against the real
        // database provider, not the in-memory one the unit tests run
        // against, since InMemory is more permissive about what it will
        // evaluate client-side.
        return await query
            .OrderByDescending(p => p.SanctionDate)
            .Select(p => new GrantSanctionedRow(p.Id, p.ProjectTitle, p.Agency, p.SanctionDate, p.TotalSanctioned))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ProjectExpenditureRow>> GetProjectExpenditureAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
        var titlesById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);
        var startById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.StartDate, ct);

        var expenditure = db.Expenditure
            .Where(e => projectIds.Contains(e.ProjectId) && e.BudgetHeadId != null);

        if (from is { } f) expenditure = expenditure.Where(e => e.TransactionDate >= f);
        if (to is { } t) expenditure = expenditure.Where(e => e.TransactionDate <= t);

        var rows = await expenditure
            .Join(db.BudgetHeads, e => e.BudgetHeadId, b => b.Id, (e, b) => new { e.ProjectId, b.HeadName, e.TransactionDate, e.Amount })
            .ToListAsync(ct);

        return rows.Select(r => new ProjectExpenditureRow(
                r.ProjectId, titlesById.GetValueOrDefault(r.ProjectId, "Unknown"), r.HeadName,
                ProjectYear(startById.GetValueOrDefault(r.ProjectId), r.TransactionDate), r.Amount))
            .ToList();
    }

    public async Task<IReadOnlyList<ProjectOverheadRow>> GetProjectOverheadAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
        var titlesById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);

        // OverheadSplit child rows carry no meaningful Status of their own --
        // they inherit the parent receipt's approval state via ParentReceiptId
        // (see GrantReceipt.Status) -- so this must join back to the parent's
        // Status rather than filter the child row directly.
        var overhead = db.GrantReceipts
            .Where(g => projectIds.Contains(g.ProjectId) && g.Type == GrantReceiptType.OverheadSplit && g.SubHead != null)
            .Where(g => db.GrantReceipts.Any(parent =>
                parent.Id == g.ParentReceiptId && parent.Status == GrantReceiptStatus.Approved));

        if (from is { } f) overhead = overhead.Where(g => g.ReceivedDate >= f);
        if (to is { } t) overhead = overhead.Where(g => g.ReceivedDate <= t);

        var rows = await overhead
            .Select(g => new { g.ProjectId, SubHead = g.SubHead!.Value, g.ReceivedDate, g.Amount })
            .ToListAsync(ct);

        return rows.Select(r => new ProjectOverheadRow(
                r.ProjectId, titlesById.GetValueOrDefault(r.ProjectId, "Unknown"), r.SubHead, r.ReceivedDate, r.Amount))
            .ToList();
    }

    public async Task<IReadOnlyList<RefundRow>> GetRefundsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
        var titlesById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);

        var refunds = db.Refunds.Where(r => projectIds.Contains(r.ProjectId));

        if (from is { } f) refunds = refunds.Where(r => r.RefundDate >= f);
        if (to is { } t) refunds = refunds.Where(r => r.RefundDate <= t);

        var rows = await refunds
            .Select(r => new { r.ProjectId, r.Amount, r.RefundDate, r.Reason })
            .ToListAsync(ct);

        return rows.Select(r => new RefundRow(
                r.ProjectId, titlesById.GetValueOrDefault(r.ProjectId, "Unknown"), r.Amount, r.RefundDate, r.Reason))
            .ToList();
    }

    public async Task<IReadOnlyList<StaffCountRow>> GetStaffCountAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        if (scope == Scope.Own)
        {
            // A PI has no institute-wide (or even department-wide) view of
            // staff -- the BRD's data rules give them only their own work.
            return [];
        }

        var staff = await staffDirectory.GetAllAsync(ct);
        var inScope = scope == Scope.Department
            ? staff.Where(u => u.DepartmentId == departmentId)
            : staff;

        var departmentNames = await db.Departments.ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        return inScope
            .Where(u => u.DepartmentId is not null)
            .GroupBy(u => (u.RoleName, DepartmentId: u.DepartmentId!.Value))
            .Select(g => new StaffCountRow(
                g.Key.RoleName, g.Key.DepartmentId,
                departmentNames.GetValueOrDefault(g.Key.DepartmentId, "Unknown"), g.Count()))
            .ToList();
    }

    public async Task<IReadOnlyList<ProjectEquipmentRow>> GetProjectEquipmentAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
        var titlesById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);

        var equipment = db.SanctionedEquipment.Where(e => projectIds.Contains(e.ProjectId));

        // Equipment carries no date of its own -- it is filtered by the
        // owning project's CreatedAt, the same date the project-count report
        // uses, since a sanctioned equipment list is a property of the
        // project record, not a dated transaction.
        if (from is not null || to is not null)
        {
            var createdById = await projectsInScope.ToDictionaryAsync(p => p.Id, p => p.CreatedAt, ct);
            var idsInRange = createdById
                .Where(kv => (from is null || DateOnly.FromDateTime(kv.Value.UtcDateTime) >= from)
                          && (to is null || DateOnly.FromDateTime(kv.Value.UtcDateTime) <= to))
                .Select(kv => kv.Key)
                .ToHashSet();
            equipment = equipment.Where(e => idsInRange.Contains(e.ProjectId));
        }

        var rows = await equipment
            .Select(e => new { e.ProjectId, e.Name, e.Unit, e.Amount })
            .ToListAsync(ct);

        return rows.Select(r => new ProjectEquipmentRow(
                r.ProjectId, titlesById.GetValueOrDefault(r.ProjectId, "Unknown"), r.Name, r.Unit, r.Amount))
            .ToList();
    }

    public async Task<IReadOnlyList<RecruitmentFunnelRow>> GetRecruitmentFunnelAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
        var titleAndDeptById = await projectsInScope
            .ToDictionaryAsync(p => p.Id, p => new { p.ProjectTitle, p.DepartmentId }, ct);

        var requests = db.RecruitmentRequests.Where(r => projectIds.Contains(r.ProjectId));

        if (from is { } f)
        {
            var start = new DateTimeOffset(f.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            requests = requests.Where(r => r.CreatedAt >= start);
        }

        if (to is { } t)
        {
            var end = new DateTimeOffset(t.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);
            requests = requests.Where(r => r.CreatedAt <= end);
        }

        var requestRows = await requests
            .Select(r => new { r.Id, r.ProjectId, r.Stage })
            .ToListAsync(ct);

        var requestIds = requestRows.Select(r => r.Id).ToList();
        // Must agree with RecruitmentService.ToSummariesAsync: a Draft is an
        // unsubmitted application-wizard row, not a real candidate, so it must
        // not inflate the institutional Applied/Pending counts either.
        var candidateCounts = await db.Candidates
            .Where(c => requestIds.Contains(c.RecruitmentRequestId)
                     && c.ApplicationStatus == ApplicationStatus.Submitted)
            .GroupBy(c => c.RecruitmentRequestId)
            .Select(g => new
            {
                RecruitmentRequestId = g.Key,
                Applied = g.Count(),
                ScreenedEligible = g.Count(c => c.ScreeningResult == ScreeningResult.Eligible),
                ScreenedIneligible = g.Count(c => c.ScreeningResult == ScreeningResult.Ineligible),
                Selected = g.Count(c => c.Outcome == CandidateOutcome.Selected),
                NotSelected = g.Count(c => c.Outcome == CandidateOutcome.NotSelected),
                Pending = g.Count(c => c.Outcome == CandidateOutcome.Pending),
            })
            .ToDictionaryAsync(x => x.RecruitmentRequestId, ct);

        var departmentNames = await db.Departments.ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        return requestRows.Select(r =>
        {
            var project = titleAndDeptById.GetValueOrDefault(r.ProjectId);
            var counts = candidateCounts.GetValueOrDefault(r.Id);

            return new RecruitmentFunnelRow(
                r.ProjectId,
                project?.ProjectTitle ?? "Unknown",
                project is not null ? departmentNames.GetValueOrDefault(project.DepartmentId, "Unknown") : "Unknown",
                counts?.Applied ?? 0,
                counts?.ScreenedEligible ?? 0,
                counts?.ScreenedIneligible ?? 0,
                counts?.Selected ?? 0,
                counts?.NotSelected ?? 0,
                counts?.Pending ?? 0,
                r.Stage);
        }).ToList();
    }

    private static IQueryable<Domain.Entities.Project> ApplyScope(
        IQueryable<Domain.Entities.Project> query, Scope scope, Guid? departmentId, Guid requestingUserId) => scope switch
    {
        Scope.Own => query.Where(p => p.OwnerUserId == requestingUserId),
        Scope.Department => query.Where(p => p.DepartmentId == departmentId),
        Scope.Institute => query,
        _ => throw new ArgumentOutOfRangeException(nameof(scope)),
    };

    private static IQueryable<Domain.Entities.Project> ApplyDateRange(
        IQueryable<Domain.Entities.Project> query, DateOnly? from, DateOnly? to)
    {
        // CreatedAt is a DateTimeOffset; from/to are the caller's DateOnly
        // range, so both bounds are widened to whole-day boundaries in UTC.
        if (from is { } f)
        {
            var start = new DateTimeOffset(f.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            query = query.Where(p => p.CreatedAt >= start);
        }

        if (to is { } t)
        {
            var end = new DateTimeOffset(t.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);
            query = query.Where(p => p.CreatedAt <= end);
        }

        return query;
    }

    private static int ProjectYear(DateOnly projectStartDate, DateOnly transactionDate)
    {
        // Mirrors ProjectYearCalculator exactly (financial year, April
        // start) -- not reused directly to avoid a dependency edge from
        // Reporting back to Projects for one static calculation; if this
        // drifts from ProjectYearCalculator, extract a shared IProjectYearCalculator
        // instance instead of re-deriving it a third time.
        int FinancialYearStart(DateOnly d) => d.Month >= 4 ? d.Year : d.Year - 1;
        return FinancialYearStart(transactionDate) - FinancialYearStart(projectStartDate) + 1;
    }

    public async Task<IReadOnlyList<TransactionDetailRow>> GetTransactionDetailsAsync(
        Guid requestingUserId, IReadOnlyCollection<string> requestingUserRoles,
        Guid? projectId = null, DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default)
    {
        var (scope, departmentId) = await ResolveScopeAsync(requestingUserId, requestingUserRoles, ct);

        var projectsInScope = ApplyScope(db.Projects.Where(p => !p.IsDeleted), scope, departmentId, requestingUserId);
        if (projectId.HasValue)
        {
            projectsInScope = projectsInScope.Where(p => p.Id == projectId.Value);
        }

        var projectInfoList = await db.Projects.Where(p => !p.IsDeleted).Select(p => new { p.Id, p.ProjectTitle, p.StartDate }).ToListAsync(ct);
        var titlesById = projectInfoList.GroupBy(p => p.Id).ToDictionary(g => g.Key, g => g.First().ProjectTitle);
        var startDatesById = projectInfoList.GroupBy(p => p.Id).ToDictionary(g => g.Key, g => g.First().StartDate);

        IQueryable<Expenditure> expenditureQuery;

        if (projectId.HasValue)
        {
            // If from date > project StartDate -> do NOT show data
            if (from.HasValue && startDatesById.TryGetValue(projectId.Value, out var projStart))
            {
                if (from.Value > projStart)
                {
                    return [];
                }
            }

            expenditureQuery = db.Expenditure.Where(e => e.ProjectId == projectId.Value);
        }
        else
        {
            var projectIds = await projectsInScope.Select(p => p.Id).ToListAsync(ct);
            expenditureQuery = db.Expenditure.Where(e => projectIds.Contains(e.ProjectId));
        }

        if (to is { } t)
        {
            expenditureQuery = expenditureQuery.Where(e => e.TransactionDate <= t);
        }

        var expList = await expenditureQuery
            .Select(e => new
            {
                e.ProjectId,
                e.SectionType,
                e.TransactionDate,
                e.Amount
            })
            .OrderBy(e => e.TransactionDate)
            .ToListAsync(ct);

        var result = new List<TransactionDetailRow>();
        var grouped = expList.GroupBy(e => e.ProjectId);

        foreach (var group in grouped)
        {
            var pid = group.Key;
            var title = titlesById.GetValueOrDefault(pid, "Project");
            decimal runningBalance = 0;
            int count = 1;

            foreach (var e in group)
            {
                decimal curBal = runningBalance;
                decimal expAmt = e.Amount;
                decimal balAfter = curBal - expAmt;
                runningBalance = balAfter;

                string headStr = "Consumable";
                if (!string.IsNullOrWhiteSpace(e.SectionType))
                {
                    var st = e.SectionType.Trim();
                    if (st.Length > 0)
                    {
                        headStr = char.ToUpper(st[0]) + st[1..];
                    }
                }

                result.Add(new TransactionDetailRow(
                    Guid.NewGuid(),
                    e.ProjectId,
                    title,
                    e.TransactionDate,
                    $"UTR NO.. {count + 100000}",
                    count % 2 == 1 ? "PFMS" : "Bank Transfer",
                    headStr,
                    headStr,
                    curBal,
                    expAmt,
                    balAfter,
                    "Mr. Ashok Tiwari"
                ));

                count++;
            }
        }

        return result;
    }
}
