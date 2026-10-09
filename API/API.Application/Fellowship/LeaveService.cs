using API.Application.Access;
using API.Application.Common;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Fellowship;

/// <summary>
/// Leave requests and entitlement (BRD A6).
/// </summary>
/// <remarks>
/// Legacy had no leave table at all -- counts were typed onto the stipend form
/// by whoever prepared it -- so this is built from the BRD alone.
/// </remarks>
public class LeaveService(
    IApplicationDbContext db,
    IFellowContextService fellowContext,
    IWorkflowEngineService workflowEngine,
    IWorkflowPendingQueryService pendingQuery,
    IUserDepartmentProvider userDepartment,
    IInstituteWideScopeResolver instituteWideScope) : ILeaveService
{
    /// <summary>
    /// The Office-group roles in <c>hod.leaves</c>'s allowed-role list
    /// (PageCatalogue.cs) past Faculty/HOD -- these widen to institute-wide
    /// sight when the caller's own department is flagged R&amp;C, exactly like
    /// ReportingService.OfficeRoles. Faculty and HOD stay department-scoped
    /// (a PI/HOD sees only their own department's requests, never every
    /// department).
    /// </summary>
    private static readonly HashSet<string> OfficeRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "Director", "SuperAdmin",
    };

    /// <summary>BRD A6's table: 30 days annual, 15 days special.</summary>
    private static int EntitlementFor(LeaveType type) => type switch
    {
        LeaveType.Annual => 30,
        LeaveType.Special => 15,
        _ => 0,
    };

    /// <summary>
    /// Which year of the fellow's own tenure a date falls in, counting from the
    /// day they joined: year 1 is JoinedOn to the day before its anniversary.
    /// </summary>
    /// <remarks>
    /// Deliberately not <c>IProjectYearCalculator</c>. That computes Indian
    /// financial years (April-March), which is right for budgets but wrong here:
    /// a fellow joining in January would see their annual allowance reset that
    /// April, three months into a twelve-month entitlement. The BRD ties leave to
    /// the fellow's appointment, so the anniversary of joining is the boundary.
    /// </remarks>
    private static int TenureYear(DateOnly joinedOn, DateOnly date)
    {
        if (date < joinedOn)
        {
            throw new ArgumentException(
                $"Date {date} precedes the appointment start {joinedOn}.", nameof(date));
        }

        var years = date.Year - joinedOn.Year;
        if (date.Month < joinedOn.Month ||
            (date.Month == joinedOn.Month && date.Day < joinedOn.Day))
        {
            years--;
        }

        return years + 1;
    }

    public async Task<Guid> RaiseLeaveAsync(
        RaiseLeaveInput input, Guid fellowUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Purpose))
        {
            throw new WorkflowTransitionException(
                "A remark is required when raising a leave request.");
        }

        var appointment = await fellowContext.RequireActiveFellowAsync(fellowUserId, ct);

        if (input.Dates == null || input.Dates.Count == 0)
        {
            throw new ArgumentException("At least one leave date must be selected.", nameof(input));
        }

        var sortedDates = input.Dates.OrderBy(d => d).ToList();
        var fromDate = sortedDates.First();
        var toDate = sortedDates.Last();

        if (fromDate < appointment.JoinedOn || toDate > appointment.ValidTill)
        {
            throw new LeaveOutsideTenureException();
        }

        // BRD A6: special leave is for conference participation, so it must say
        // what for.
        if (input.LeaveType == LeaveType.Special && string.IsNullOrWhiteSpace(input.Purpose))
        {
            throw new SpecialLeavePurposeRequiredException();
        }

        var dayCount = sortedDates.Count;

        // Ensure no dates overlap with existing active requests
        var existingRequests = await db.LeaveRequests
            .Where(r => r.FellowAppointmentId == appointment.Id)
            .ToListAsync(ct);
            
        if (existingRequests.Count > 0)
        {
            var workflowIds = existingRequests.Select(r => r.WorkflowInstanceId).ToHashSet();
            var stages = await db.WorkflowInstances
                .Where(w => workflowIds.Contains(w.Id))
                .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);
                
            var activeRequests = existingRequests
                .Where(r => {
                    var stage = stages.GetValueOrDefault(r.WorkflowInstanceId, WorkflowStage.Raised);
                    return stage != WorkflowStage.Rejected && stage != WorkflowStage.Cancelled;
                });
                
            var overlappingDates = activeRequests
                .SelectMany(r => r.Dates)
                .Intersect(sortedDates)
                .OrderBy(d => d)
                .ToList();
                
            if (overlappingDates.Count > 0)
            {
                var formattedDates = string.Join(", ", overlappingDates.Select(d => d.ToString("dd/MM/yyyy")));
                throw new ArgumentException($"A leave request already exists for the following date(s): {formattedDates}");
            }
        }

        var projectYear = TenureYear(appointment.JoinedOn, fromDate);
        var entitlement = await GetOrCreateEntitlementAsync(
            appointment.Id, input.LeaveType, projectYear, ct);

        // Pending days count toward the balance as well as consumed ones.
        // Without this, two requests that each fit individually could together
        // exceed the allowance -- neither would be refused at raise, and both
        // would consume on approval.
        var pending = await PendingDaysAsync(appointment.Id, input.LeaveType, projectYear, ct);
        var remaining = entitlement.EntitledDays - entitlement.ConsumedDays - pending;

        if (dayCount > remaining)
        {
            throw new InsufficientLeaveBalanceException(input.LeaveType, dayCount, remaining);
        }

        var request = new LeaveRequest
        {
            Id = Guid.NewGuid(),
            FellowAppointmentId = appointment.Id,
            LeaveType = input.LeaveType,
            Dates = sortedDates,
            OutOfStationDates = input.OutOfStationDates?.OrderBy(d => d).ToList() ?? [],
            DayCount = dayCount,
            Purpose = input.Purpose,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.LeaveRequests.Add(request);
        await db.SaveChangesAsync(ct);

        var instance = await workflowEngine.RaiseAsync(
            RequestType.LeaveRequest, request.Id, WorkflowPhase.Indent, fellowUserId, ct);

        request.WorkflowInstanceId = instance.Id;
        await db.SaveChangesAsync(ct);

        return request.Id;
    }

    public async Task CancelLeaveAsync(Guid leaveRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string remarks, CancellationToken ct = default)
    {
        var request = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == leaveRequestId, ct)
            ?? throw new ArgumentException($"Leave request '{leaveRequestId}' not found.", nameof(leaveRequestId));

        await workflowEngine.CancelAsync(request.WorkflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ConsumeOnApprovalAsync(Guid leaveRequestId, CancellationToken ct = default)
    {
        var request = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == leaveRequestId, ct)
            ?? throw new LeaveRequestNotFoundException(leaveRequestId);

        var instance = await workflowEngine.GetAsync(request.WorkflowInstanceId, ct);
        if (instance?.CurrentStage != WorkflowStage.Approved)
        {
            throw new InvalidOperationException(
                $"Leave request '{leaveRequestId}' is not approved, so it cannot consume " +
                "entitlement.");
        }

        var appointment = await db.ManpowerSelections
            .FirstAsync(s => s.Id == request.FellowAppointmentId, ct);

        var projectYear = TenureYear(appointment.JoinedOn, request.Dates.Count > 0 ? request.Dates.Min() : appointment.JoinedOn);
        var entitlement = await GetOrCreateEntitlementAsync(
            request.FellowAppointmentId, request.LeaveType, projectYear, ct);

        entitlement.ConsumedDays += request.DayCount;
        await db.SaveChangesAsync(ct);
    }

    public async Task<Guid> RaiseCancellationAsync(Guid leaveRequestId, List<DateOnly> datesToCancel, string reason, Guid fellowUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new WorkflowTransitionException(
                "A remark is required when cancelling a leave request.");
        }

        var request = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == leaveRequestId, ct)
            ?? throw new LeaveRequestNotFoundException(leaveRequestId);

        var instance = await workflowEngine.GetAsync(request.WorkflowInstanceId, ct);
        if (instance?.CurrentStage != WorkflowStage.Approved)
        {
            throw new InvalidOperationException("Can only cancel an approved leave request.");
        }

        if (datesToCancel.Count == 0)
        {
            throw new ArgumentException("At least one date must be selected for cancellation.");
        }

        if (datesToCancel.Any(d => !request.Dates.Contains(d)))
        {
            throw new ArgumentException("Cannot cancel dates that were not part of the original leave request.");
        }

        var cancellationRequest = new LeaveCancellationRequest
        {
            Id = Guid.NewGuid(),
            LeaveRequestId = leaveRequestId,
            CancelledDates = datesToCancel,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.LeaveCancellationRequests.Add(cancellationRequest);
        await db.SaveChangesAsync(ct);

        var cancellationInstance = await workflowEngine.RaiseAsync(
            RequestType.LeaveCancellation, cancellationRequest.Id, WorkflowPhase.Indent, fellowUserId, ct);

        cancellationRequest.WorkflowInstanceId = cancellationInstance.Id;
        await db.SaveChangesAsync(ct);

        return cancellationRequest.Id;
    }

    public async Task RefundOnCancellationApprovalAsync(Guid cancellationRequestId, CancellationToken ct = default)
    {
        var cancellationRequest = await db.LeaveCancellationRequests
            .Include(c => c.LeaveRequest)
            .FirstOrDefaultAsync(c => c.Id == cancellationRequestId, ct)
            ?? throw new ArgumentException($"Cancellation request '{cancellationRequestId}' not found.");

        var instance = await workflowEngine.GetAsync(cancellationRequest.WorkflowInstanceId, ct);
        if (instance?.CurrentStage != WorkflowStage.Approved)
        {
            throw new InvalidOperationException(
                $"Cancellation request '{cancellationRequestId}' is not approved, so it cannot refund entitlement.");
        }

        var originalRequest = cancellationRequest.LeaveRequest!;
        var appointment = await db.ManpowerSelections
            .FirstAsync(s => s.Id == originalRequest.FellowAppointmentId, ct);

        var projectYear = TenureYear(appointment.JoinedOn, originalRequest.Dates.Count > 0 ? originalRequest.Dates.Min() : appointment.JoinedOn);
        var entitlement = await GetOrCreateEntitlementAsync(
            originalRequest.FellowAppointmentId, originalRequest.LeaveType, projectYear, ct);

        // Refund the days
        entitlement.ConsumedDays -= cancellationRequest.CancelledDates.Count;

        // Remove the dates from the original request
        originalRequest.Dates = originalRequest.Dates.Except(cancellationRequest.CancelledDates).ToList();
        originalRequest.DayCount = originalRequest.Dates.Count;

        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<LeaveRequestSummary>> ListOwnRequestsAsync(
        Guid fellowUserId, CancellationToken ct = default)
    {
        var appointment = await fellowContext.FindAppointmentAsync(fellowUserId, ct);
        if (appointment is null)
        {
            return [];
        }

        var requests = await db.LeaveRequests
            .Where(r => r.FellowAppointmentId == appointment.Id)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        if (requests.Count == 0)
        {
            return [];
        }

        var workflowIds = requests.Select(r => r.WorkflowInstanceId).ToHashSet();
        var requestIds = requests.Select(r => r.Id).ToList();

        var cancellationRequests = await db.LeaveCancellationRequests
            .Where(c => requestIds.Contains(c.LeaveRequestId))
            .ToListAsync(ct);

        var allWorkflowIds = workflowIds.Concat(cancellationRequests.Select(c => c.WorkflowInstanceId)).ToHashSet();

        var stages = await db.WorkflowInstances
            .Where(w => allWorkflowIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var requestsMap = requests.ToDictionary(r => r.Id);
        
        var cancellationSummaries = cancellationRequests.Select(c => {
            var r = requestsMap[c.LeaveRequestId];
            return new LeaveRequestSummary(
                c.Id, r.FellowAppointmentId, c.WorkflowInstanceId,
                r.LeaveType, c.CancelledDates ?? [], [], c.CancelledDates?.Count ?? 0, c.Reason,
                stages.TryGetValue(c.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised,
                c.CreatedAt,
                false,
                true);
        }).ToList();

        var result = new List<LeaveRequestSummary>();

        result.AddRange(requests.Select(r => {
            var hasPendingCancellation = cancellationRequests
                .Where(c => c.LeaveRequestId == r.Id)
                .Any(c => stages.TryGetValue(c.WorkflowInstanceId, out var cs) && cs != WorkflowStage.Approved && cs != WorkflowStage.Rejected);

            return new LeaveRequestSummary(
                r.Id, r.FellowAppointmentId, r.WorkflowInstanceId,
                r.LeaveType, r.Dates, r.OutOfStationDates, r.DayCount, r.Purpose,
                stages.TryGetValue(r.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised,
                r.CreatedAt,
                hasPendingCancellation,
                false);
        }));

        result.AddRange(cancellationSummaries);

        return result.OrderByDescending(r => r.CreatedAt).ToList();
    }

    public async Task<IReadOnlyList<LeaveBalance>> GetBalanceAsync(
        Guid fellowUserId, CancellationToken ct = default)
    {
        var appointment = await fellowContext.FindAppointmentAsync(fellowUserId, ct);
        if (appointment is null)
        {
            return [];
        }

        // A fellow whose appointment has not started yet should see their year-1
        // allowance rather than an error -- the balance is a forward-looking
        // view, and TenureYear rejects dates before JoinedOn.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var projectYear = today < appointment.JoinedOn
            ? 1
            : TenureYear(appointment.JoinedOn, today);

        var allEntitlements = await db.LeaveEntitlements
            .Where(e => e.FellowAppointmentId == appointment.Id)
            .ToListAsync(ct);

        var balances = new List<LeaveBalance>();

        foreach (var type in Enum.GetValues<LeaveType>())
        {
            var typeEntitlements = allEntitlements.Where(e => e.LeaveType == type).ToList();

            var pastEntitled = 0;
            var pastConsumed = 0;
            var pastPending = 0;

            for (int y = 1; y < projectYear; y++)
            {
                var pastRow = typeEntitlements.FirstOrDefault(e => e.ProjectYear == y);
                pastEntitled += pastRow?.EntitledDays ?? EntitlementFor(type);
                pastConsumed += pastRow?.ConsumedDays ?? 0;
                pastPending += await PendingDaysAsync(appointment.Id, type, y, ct);
            }

            // Carry forward unused balance from previous years
            var carryForward = pastEntitled - pastConsumed - pastPending;

            var current = typeEntitlements.FirstOrDefault(e => e.ProjectYear == projectYear);
            var currentBaseEntitled = current?.EntitledDays ?? EntitlementFor(type);
            
            // Effective entitlement for the current year includes carry-forward
            var entitled = currentBaseEntitled + carryForward;
            var consumed = current?.ConsumedDays ?? 0;
            var pending = await PendingDaysAsync(appointment.Id, type, projectYear, ct);

            balances.Add(new LeaveBalance(
                type, projectYear, entitled, consumed, pending,
                entitled - consumed - pending));
        }

        return balances;
    }

    public async Task<IReadOnlyList<LeaveRequestDetail>> ListRequestsAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var requests = await db.LeaveRequests
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        if (requests.Count == 0)
        {
            return [];
        }

        var (details, departmentIdsByRequestId) = await ToDetailsWithDepartmentsAsync(requests, ct);

        var allDetails = details.ToList();
        var cancellationRequests = await db.LeaveCancellationRequests.ToListAsync(ct);
        if (cancellationRequests.Count > 0)
        {
            var cancellationWorkflowIds = cancellationRequests.Select(c => c.WorkflowInstanceId).ToHashSet();
            var cancellationStages = await db.WorkflowInstances
                .Where(w => cancellationWorkflowIds.Contains(w.Id))
                .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

            var parentDetailsMap = details.ToDictionary(d => d.Id);

            foreach (var c in cancellationRequests)
            {
                if (parentDetailsMap.TryGetValue(c.LeaveRequestId, out var parentDetail))
                {
                    var stage = cancellationStages.TryGetValue(c.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised;
                    allDetails.Add(new LeaveRequestDetail(
                        c.Id, parentDetail.FellowAppointmentId, c.WorkflowInstanceId,
                        parentDetail.ApplicantName, parentDetail.Designation, parentDetail.DepartmentName,
                        parentDetail.ProjectTitle, parentDetail.PiName, parentDetail.LeaveType,
                        c.CancelledDates ?? [], [], c.CancelledDates?.Count ?? 0, c.Reason, stage, c.CreatedAt, true));
                        
                    // Make sure the cancellation request maps to the same department id
                    if (departmentIdsByRequestId.TryGetValue(parentDetail.Id, out var reqDeptId))
                    {
                        var dict = (Dictionary<Guid, Guid?>)departmentIdsByRequestId;
                        dict[c.Id] = reqDeptId;
                    }
                }
            }
        }

        var isOffice = roles.Any(OfficeRoles.Contains);
        if (isOffice && await instituteWideScope.IsInstituteWideAsync(userId, ct))
        {
            // Office roles whose own department is flagged R&C see every
            // department's requests, matching ReportingService.ResolveScopeAsync
            // and every other office-facing queue in this codebase.
            return allDetails;
        }

        // Faculty/HOD, or an office role whose own department is not R&C: both
        // see only their own department's requests.
        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        if (departmentId is null)
        {
            return [];
        }

        var visibleDetails = allDetails.Where(d =>
            departmentIdsByRequestId.TryGetValue(d.Id, out var reqDeptId)
            && reqDeptId == departmentId).ToList();

        return visibleDetails;
    }

    /// <summary>
    /// The dashboard's "pending my action" panel for leave requests. Built on
    /// <see cref="IWorkflowPendingQueryService.ListPendingInstancesAsync"/>
    /// (Task 1's stage-matching primitive) plus this method's own department
    /// scoping -- the leave route (BRD A6) is entirely department-scoped
    /// roles (Faculty/HOD/office chain, no institute-wide-or-nothing stage
    /// like a research proposal's office chain), so every stage here uses the
    /// same plain department-match rule, mirroring
    /// FellowshipService.ListPendingClaimsForCallerAsync.
    /// </summary>
    public async Task<IReadOnlyList<LeaveRequestSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.LeaveRequest, WorkflowPhase.Indent, roles, userId, ct);
            
        var pendingCancellations = await pendingQuery.ListPendingInstancesAsync(
            RequestType.LeaveCancellation, WorkflowPhase.Indent, roles, userId, ct);

        if (pending.Count == 0 && pendingCancellations.Count == 0)
        {
            return [];
        }

        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        if (departmentId is null)
        {
            return [];
        }

        var requests = new List<LeaveRequest>();
        var visibleRequestIds = new HashSet<Guid>();
        var workflowIds = new HashSet<Guid>();
        var stages = new Dictionary<Guid, WorkflowStage>();
        
        if (pending.Count > 0)
        {
            var pendingIds = pending.Keys;
            requests = await db.LeaveRequests
                .Where(r => pendingIds.Contains(r.WorkflowInstanceId))
                .ToListAsync(ct);

            if (requests.Count > 0)
            {
                var (_, departmentIdsByRequestId) = await ToDetailsWithDepartmentsAsync(requests, ct);

                visibleRequestIds = requests
                    .Where(r => departmentIdsByRequestId.TryGetValue(r.Id, out var reqDeptId) && reqDeptId == departmentId)
                    .Select(r => r.Id)
                    .ToHashSet();

                workflowIds = requests.Select(r => r.WorkflowInstanceId).ToHashSet();
                stages = await db.WorkflowInstances
                    .Where(w => workflowIds.Contains(w.Id))
                    .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);
            }
        }
        
        var visibleCancellationSummaries = new List<LeaveRequestSummary>();
        
        if (pendingCancellations.Count > 0)
        {
            var pendingCancellationIds = pendingCancellations.Keys;
            var cancellationRequests = await db.LeaveCancellationRequests
                .Where(c => pendingCancellationIds.Contains(c.WorkflowInstanceId))
                .ToListAsync(ct);
                
            if (cancellationRequests.Count > 0)
            {
                var leaveRequestIdsForCancellations = cancellationRequests.Select(c => c.LeaveRequestId).ToList();
                var parentLeaveRequestsForCancellations = await db.LeaveRequests
                    .Where(r => leaveRequestIdsForCancellations.Contains(r.Id))
                    .ToListAsync(ct);

                var (_, departmentIdsByRequestIdForCancellations) = await ToDetailsWithDepartmentsAsync(parentLeaveRequestsForCancellations, ct);

                var visibleCancellationRequests = cancellationRequests
                    .Where(c => departmentIdsByRequestIdForCancellations.TryGetValue(c.LeaveRequestId, out var reqDeptId) && reqDeptId == departmentId)
                    .ToList();

                var visibleParentLeaveRequests = parentLeaveRequestsForCancellations.ToDictionary(r => r.Id);

                var cancellationWorkflowIds = visibleCancellationRequests.Select(c => c.WorkflowInstanceId).ToHashSet();
                var cancellationStages = await db.WorkflowInstances
                    .Where(w => cancellationWorkflowIds.Contains(w.Id))
                    .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);
                    
                visibleCancellationSummaries = visibleCancellationRequests.Select(c => {
                    var r = visibleParentLeaveRequests[c.LeaveRequestId];
                    return new LeaveRequestSummary(
                        c.Id, r.FellowAppointmentId, c.WorkflowInstanceId,
                        r.LeaveType, c.CancelledDates ?? [], [], c.CancelledDates?.Count ?? 0, c.Reason,
                        cancellationStages.TryGetValue(c.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised,
                        c.CreatedAt,
                        false,
                        true);
                }).ToList();
            }
        }

        return
        [
            .. requests
                .Where(r => visibleRequestIds.Contains(r.Id))
                .Select(r => new LeaveRequestSummary(
                    r.Id, r.FellowAppointmentId, r.WorkflowInstanceId,
                    r.LeaveType, r.Dates, r.OutOfStationDates, r.DayCount, r.Purpose,
                    stages.TryGetValue(r.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised,
                    r.CreatedAt)),
            .. visibleCancellationSummaries
        ];
    }

    /// <summary>
    /// Builds each request's <see cref="LeaveRequestDetail"/> plus the
    /// department id its own join chain (LeaveRequest -&gt; ManpowerSelection
    /// -&gt; SanctionedManpowerPosition -&gt; Project.DepartmentId) already
    /// computes -- <see cref="ListRequestsAsync"/> and
    /// <see cref="ListPendingForCallerAsync"/> both need that id to filter by
    /// department, and LeaveRequestDetail only carries the display name, not
    /// the id, so this exposes it instead of re-querying the same chain from
    /// scratch. Mirrors FellowshipService.ToSummariesWithDepartmentsAsync.
    /// </summary>
    private async Task<(IReadOnlyList<LeaveRequestDetail> Details, IReadOnlyDictionary<Guid, Guid?> DepartmentIdsByRequestId)>
        ToDetailsWithDepartmentsAsync(IReadOnlyList<LeaveRequest> requests, CancellationToken ct)
    {
        var appointmentIds = requests.Select(r => r.FellowAppointmentId).Distinct().ToList();
        var appointments = await db.ManpowerSelections
            .Where(m => appointmentIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var candidateIds = appointments.Values.Select(a => a.CandidateId).Distinct().ToList();
        var candidates = await db.Candidates
            .Where(c => candidateIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        var positionIds = appointments.Values.Select(a => a.SanctionedManpowerPositionId).Distinct().ToList();
        var positions = await db.SanctionedManpowerPositions
            .Where(p => positionIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var projectIds = positions.Values.Select(p => p.ProjectId).Distinct().ToList();
        var projects = await db.Projects
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var departmentIds = projects.Values.Select(p => p.DepartmentId).Distinct().ToList();
        var departments = await db.Departments
            .Where(d => departmentIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, ct);

        var ownerUserIds = projects.Values.Select(p => p.OwnerUserId).Distinct().ToList();
        var piUsers = await db.Users
            .Where(u => ownerUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var workflowIds = requests.Select(r => r.WorkflowInstanceId).ToHashSet();
        var stages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var result = new List<LeaveRequestDetail>();
        var departmentIdsByRequestId = new Dictionary<Guid, Guid?>();
        foreach (var r in requests)
        {
            appointments.TryGetValue(r.FellowAppointmentId, out var appt);
            Candidate? cand = appt is not null && candidates.TryGetValue(appt.CandidateId, out var c) ? c : null;
            SanctionedManpowerPosition? pos = appt is not null && positions.TryGetValue(appt.SanctionedManpowerPositionId, out var p) ? p : null;
            Project? proj = pos is not null && projects.TryGetValue(pos.ProjectId, out var pr) ? pr : null;
            Department? dept = proj is not null && departments.TryGetValue(proj.DepartmentId, out var d) ? d : null;
            ApplicationUser? pi = proj is not null && piUsers.TryGetValue(proj.OwnerUserId, out var piU) ? piU : null;

            var applicantName = cand?.FullName ?? "Fellow Scholar";
            var designation = pos?.Designation ?? "JRF Scholar";
            var deptName = dept?.Name ?? "Department";
            var projectTitle = proj?.ProjectTitle ?? "Research Project";
            var piName = pi?.FullName ?? pi?.UserName ?? "PI";
            stages.TryGetValue(r.WorkflowInstanceId, out var stage);

            departmentIdsByRequestId[r.Id] = proj?.DepartmentId;

            result.Add(new LeaveRequestDetail(
                r.Id, r.FellowAppointmentId, r.WorkflowInstanceId,
                applicantName, designation, deptName, projectTitle, piName,
                r.LeaveType, r.Dates, r.OutOfStationDates, r.DayCount, r.Purpose, stage, r.CreatedAt));
        }

        return (result, departmentIdsByRequestId);
    }

    // ---------------------------------------------------------------- Helpers

    /// <summary>
    /// Created on first use rather than seeded at joining: a fellow who never
    /// takes leave needs no row.
    /// </summary>
    private async Task<LeaveEntitlement> GetOrCreateEntitlementAsync(
        Guid appointmentId, LeaveType type, int projectYear, CancellationToken ct)
    {
        var existing = await db.LeaveEntitlements.FirstOrDefaultAsync(
            e => e.FellowAppointmentId == appointmentId
              && e.LeaveType == type
              && e.ProjectYear == projectYear,
            ct);

        if (existing is not null)
        {
            return existing;
        }

        var created = new LeaveEntitlement
        {
            Id = Guid.NewGuid(),
            FellowAppointmentId = appointmentId,
            LeaveType = type,
            ProjectYear = projectYear,
            EntitledDays = EntitlementFor(type),
            ConsumedDays = 0,
        };

        db.LeaveEntitlements.Add(created);
        await db.SaveChangesAsync(ct);

        return created;
    }

    /// <summary>
    /// Days on requests that are neither approved nor terminated. Approved days
    /// are already in <c>ConsumedDays</c>; rejected and cancelled ones should
    /// free their days back up.
    /// </summary>
    private async Task<int> PendingDaysAsync(
        Guid appointmentId, LeaveType type, int projectYear, CancellationToken ct)
    {
        var appointment = await db.ManpowerSelections.FirstAsync(s => s.Id == appointmentId, ct);

        var requests = await db.LeaveRequests
            .Where(r => r.FellowAppointmentId == appointmentId && r.LeaveType == type)
            .ToListAsync(ct);

        if (requests.Count == 0)
        {
            return 0;
        }

        var workflowIds = requests.Select(r => r.WorkflowInstanceId).ToHashSet();
        var stages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        WorkflowStage[] settled =
            [WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled];

        return requests
            .Where(r => r.Dates.Count > 0 && TenureYear(appointment.JoinedOn, r.Dates.Min()) == projectYear)
            .Where(r => !stages.TryGetValue(r.WorkflowInstanceId, out var s) || !settled.Contains(s))
            .Sum(r => r.DayCount);
    }
}
