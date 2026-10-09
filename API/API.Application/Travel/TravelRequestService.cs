using API.Application.Common;
using API.Application.Documents;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Travel;

/// <summary>
/// Travel reimbursement, mirroring the procurement slice's orchestration but as
/// its own class rather than a subclass of <c>IndentServiceBase</c> -- that base
/// is indent-shaped (procurement tier, GeM availability, committees), none of
/// which applies here. The collaborators are the same.
/// </summary>
public class TravelRequestService(
    IApplicationDbContext db,
    IIndentBudgetValidator budgetValidator,
    IWorkflowEngineService workflowEngine,
    ITravelDocumentGenerationService documentGeneration,
    IDocumentStorageService documentStorage,
    IFacultyProfileProvider facultyProfiles,
    API.Application.Projects.IProjectService projectService,
    IWorkflowPendingQueryService pendingQuery) : ITravelRequestService
{
    private const string OwnerTypeName = "TravelRequest";

    public async Task<Guid> RaiseAsync(
        RaiseTravelInput input, Guid requestingUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Purpose))
        {
            throw new WorkflowTransitionException(
                "A remark is required when raising a travel request.");
        }

        var project = await LoadProjectForInitiatorAsync(input.ProjectId, requestingUserId, ct);

        Validate(input);

        if (input.BudgetHeadIds == null || input.BudgetHeadIds.Count == 0)
        {
            throw new ArgumentException("At least one budget head must be selected.", nameof(input));
        }

        var primaryHeadId = input.BudgetHeadIds[0];
        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == primaryHeadId, ct)
            ?? throw new ArgumentException(
                $"Budget head '{primaryHeadId}' was not found.", nameof(input));

        if (head.ProjectId != project.Id)
        {
            throw new ArgumentException(
                "The primary budget head does not belong to the specified project.", nameof(input));
        }

        foreach (var bId in input.BudgetHeadIds.Skip(1))
        {
            var h = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == bId, ct);
            if (h == null || h.ProjectId != project.Id)
            {
                throw new ArgumentException($"Fallback budget head '{bId}' is invalid or does not belong to the project.", nameof(input));
            }
        }

        // Derived here, never taken from the client: the printed form and the
        // budget check both depend on this figure.
        var journeyTotal = input.Journeys.Sum(j => j.Amount);
        var expectedCost = journeyTotal + input.AccommodationCost + input.OtherExpensesCost;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        
        decimal remainingCost = expectedCost;
        var allocations = new List<TravelRequestBudgetHeadAllocation>();

        for (int i = 0; i < input.BudgetHeadIds.Count; i++)
        {
            var bId = input.BudgetHeadIds[i];
            var snapshot = await budgetValidator.GetSnapshotAsync(bId, today, ct);
            
            // Allow negative balance drawing if it's the only way, but ideally drawAmount is bounded
            // Actually, if available is <= 0, we can't draw from it.
            decimal available = Math.Max(0, snapshot.Available);
            decimal drawAmount = Math.Min(remainingCost, available);
            
            // If it's the last head in the list and we still have remaining cost, 
            // we will fail below, but we can just allocate whatever is available.
            // If we are on the first head and it has 0, we still want an allocation record if remainingCost > 0?
            // Actually, if remainingCost > 0 after the loop, we fail.
            if (drawAmount > 0)
            {
                allocations.Add(new TravelRequestBudgetHeadAllocation
                {
                    BudgetHeadId = bId,
                    CommittedAmount = drawAmount,
                    OrderIndex = i
                });
                remainingCost -= drawAmount;
            }
            if (remainingCost <= 0) break;
        }

        if (remainingCost > 0)
        {
            var primarySnapshot = await budgetValidator.GetSnapshotAsync(primaryHeadId, today, ct);
            throw new InsufficientBudgetException(expectedCost, primarySnapshot);
        }

        var travelerTypesList = input.TravelerTypes != null && input.TravelerTypes.Count > 0
            ? input.TravelerTypes
            : [input.TravelerType];
        var primaryModesList = input.PrimaryModes != null && input.PrimaryModes.Count > 0
            ? input.PrimaryModes
            : [input.PrimaryMode];

        var requestId = Guid.NewGuid();
        var request = new TravelRequest
        {
            Id = requestId,
            ProjectId = input.ProjectId,
            BudgetHeadId = primaryHeadId,
            TravelerType = travelerTypesList[0],
            TravelerTypes = string.Join(",", travelerTypesList),
            OtherTravelerDetails = input.OtherTravelerDetails,
            ManpowerId = input.ManpowerId,
            CoPiName = input.CoPiName,
            CoPiDesignation = input.CoPiDesignation,
            Place = input.Place,
            Purpose = input.Purpose,
            OnwardDate = input.OnwardDate,
            ReturnDate = input.ReturnDate,
            PrimaryMode = primaryModesList[0],
            PrimaryModes = string.Join(",", primaryModesList),
            OtherPrimaryModeDetails = input.OtherPrimaryModeDetails,
            TaxiReimbursementOptedIn = input.TaxiReimbursementOptedIn,
            TaxiReason = input.TaxiReason,
            AccommodationDetails = input.AccommodationDetails,
            AccommodationCost = input.AccommodationCost,
            OtherExpensesDetails = input.OtherExpensesDetails,
            OtherExpensesCost = input.OtherExpensesCost,
            JourneyTotalCost = journeyTotal,
            ExpectedCost = expectedCost,
            CreatedAt = DateTimeOffset.UtcNow,
            Allocations = allocations
        };

        for (var i = 0; i < input.Journeys.Count; i++)
        {
            var leg = input.Journeys[i];
            request.Journeys.Add(new TravelJourneyLeg
            {
                Id = Guid.NewGuid(),
                TravelRequestId = requestId,
                JourneyFrom = leg.From,
                JourneyTo = leg.To,
                JourneyDate = leg.Date,
                ArrivalDate = leg.ArrivalDate,
                Mode = leg.Mode,
                BookingPlatform = leg.Platform,
                Amount = leg.Amount,
                Remarks = leg.Remarks,
                SequenceOrder = i + 1,
            });
        }

        db.TravelRequests.Add(request);
        await db.SaveChangesAsync(ct);

        var faculty = await facultyProfiles.GetAsync(project.OwnerUserId, ct);
        var travelerName = await ResolveTravelerNameAsync(request, faculty, ct);
        var model = TravelDocumentModelFactory.Build(
            request, request.Journeys, project, head, faculty, travelerName);

        var pdf = await documentGeneration.GenerateTravelRequestFormAsync(model, ct);
        await StoreDocumentAsync(requestId, DocumentKind.TravelRequestForm, pdf, requestingUserId, ct);

        var instance = await workflowEngine.RaiseAsync(
            RequestType.Travel, requestId, WorkflowPhase.Indent, requestingUserId, ct);
        if (project.CurrentDaUserId is { } daUserId)
        {
            instance.AssignedToUserId = daUserId;
            instance.IsAssignedViaProjectDa = true;
        }
        request.WorkflowInstanceId = instance.Id;
        await db.SaveChangesAsync(ct);

        return requestId;
    }

    public async Task<IReadOnlyList<TravelSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var project = await projectService.GetAsync(projectId, requestingUserId, requestingUserRoles, ct);
        if (project == null) throw new ProjectAccessDeniedException(projectId);

        var requests = await db.TravelRequests
            .Where(t => t.ProjectId == projectId)
            .ToListAsync(ct);

        return await ToSummariesAsync(requests, ct);
    }

    public async Task<TravelDetail> GetAsync(
        Guid travelRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var request = await db.TravelRequests
            .Include(t => t.Journeys)
            .Include(t => t.Allocations)
            .FirstOrDefaultAsync(t => t.Id == travelRequestId, ct)
            ?? throw new TravelRequestNotFoundException(travelRequestId);

        var project = await projectService.GetAsync(request.ProjectId, requestingUserId, requestingUserRoles, ct);
        if (project == null) throw new ProjectAccessDeniedException(request.ProjectId);

        var summary = (await ToSummariesAsync([request], ct)).Single();

        var primaryModesList = !string.IsNullOrWhiteSpace(request.PrimaryModes)
            ? request.PrimaryModes.Split(',').Select(Enum.Parse<TravelMode>).ToList()
            : [request.PrimaryMode];

        return new TravelDetail(
            summary,
            request.ManpowerId,
            request.CoPiName,
            request.CoPiDesignation,
            request.PrimaryMode,
            request.AccommodationDetails,
            request.AccommodationCost,
            request.OtherExpensesDetails,
            request.OtherExpensesCost,
            request.JourneyTotalCost,
            request.OriginalBillReference,
            request.TaxiCost,
            request.ActualCost,
            [
                .. request.Journeys
                    .OrderBy(j => j.SequenceOrder)
                    .Select(j => new TravelJourneyLegModel(
                        j.JourneyFrom, j.JourneyTo, j.JourneyDate,
                        j.Mode, j.BookingPlatform, j.Amount, j.Remarks, j.ArrivalDate,
                        j.ActualArrivalDate, j.ActualArrivalTime, j.ActualArrivalKm, j.Id))
            ],
            [
                .. request.Allocations
                    .OrderBy(a => a.OrderIndex)
                    .Select(a => new TravelBudgetAllocationModel(
                        a.BudgetHeadId, a.CommittedAmount))
            ],
            request.TaxiReason,
            primaryModesList,
            request.OtherPrimaryModeDetails,
            request.BillNo ?? request.OriginalBillReference,
            request.GenerationDate,
            request.Kilometer,
            request.StartTime,
            request.EndTime,
            request.BillFileUrl,
            request.BillProcessStatus);
    }

    public async Task<IReadOnlyList<TravelSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.Travel, WorkflowPhase.Indent, roles, userId, ct);
        if (pending.Count == 0)
        {
            return [];
        }

        var visibleProjectIds = (await projectService.ListVisibleToAsync(userId, roles, ct))
            .Select(p => p.Id)
            .ToHashSet();
        if (visibleProjectIds.Count == 0)
        {
            return [];
        }

        // pending.Keys.Contains(...), not pending.ContainsKey(...): the
        // real MySQL provider cannot translate IReadOnlyDictionary.ContainsKey
        // to SQL (only the InMemory test provider tolerates it), so this threw
        // InvalidOperationException on every call -- silently swallowed by
        // DashboardService's per-type catch.
        var pendingIds = pending.Keys;
        var requests = await db.TravelRequests
            .Where(t => visibleProjectIds.Contains(t.ProjectId) && pendingIds.Contains(t.WorkflowInstanceId))
            .Include(t => t.Journeys)
            .Include(t => t.Allocations)
            .ToListAsync(ct);

        return await ToSummariesAsync(requests, ct);
    }

    public async Task ProcessBillAsync(
        Guid travelRequestId, ProcessTravelBillInput input, Guid requestingUserId,
        IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default)
    {
        var request = await db.TravelRequests
            .Include(t => t.Journeys)
            .Include(t => t.Allocations)
            .FirstOrDefaultAsync(t => t.Id == travelRequestId, ct)
            ?? throw new TravelRequestNotFoundException(travelRequestId);

        var project = await projectService.GetAsync(request.ProjectId, requestingUserId, requestingUserRoles, ct)
            ?? throw new ProjectAccessDeniedException(request.ProjectId);

        var instance = await workflowEngine.GetAsync(request.WorkflowInstanceId, ct)
            ?? throw new InvalidOperationException(
                $"Workflow instance for travel request '{travelRequestId}' was not found.");

        // Legacy's gate (process_travel_bill.php): the request must be approved first.
        if (instance.Phase != WorkflowPhase.Indent || instance.CurrentStage != WorkflowStage.Approved)
        {
            throw new InvalidOperationException(
                $"Travel request '{travelRequestId}' must be approved before its bill can be " +
                $"processed (phase {instance.Phase}, stage {instance.CurrentStage}).");
        }

        // The BRD's hard rule: taxi reimbursement is only available when it was
        // selected at submission. Not a UI hint -- enforced here.
        if (input.TaxiCost is > 0m && !request.TaxiReimbursementOptedIn)
        {
            throw new TaxiNotOptedInException(travelRequestId);
        }

        if (input.TaxiCost is < 0m || input.ActualCost is < 0m)
        {
            throw new ArgumentException("Costs cannot be negative.", nameof(input));
        }

        request.OriginalBillReference = input.OriginalBillReference;
        request.BillNo = input.BillNo ?? input.OriginalBillReference;
        request.TaxiCost = input.TaxiCost;
        request.ActualCost = input.ActualCost;
        request.GenerationDate = input.GenerationDate;
        request.Kilometer = input.Kilometer;
        request.StartTime = input.StartTime;
        request.EndTime = input.EndTime;
        request.BillFileUrl = input.BillFileUrl;
        if (!string.IsNullOrWhiteSpace(input.BillProcessStatus))
        {
            request.BillProcessStatus = input.BillProcessStatus;
        }

        if (input.LegArrivalDetails != null && input.LegArrivalDetails.Count > 0)
        {
            var journeys = request.Journeys.OrderBy(j => j.SequenceOrder).ToList();
            for (int i = 0; i < input.LegArrivalDetails.Count; i++)
            {
                var legDetail = input.LegArrivalDetails[i];
                var leg = (legDetail.LegId.HasValue ? journeys.FirstOrDefault(j => j.Id == legDetail.LegId.Value) : null)
                    ?? (i < journeys.Count ? journeys[i] : null);

                if (leg != null)
                {
                    if (legDetail.ActualArrivalDate.HasValue && legDetail.ActualArrivalDate.Value < leg.JourneyDate)
                    {
                        throw new ArgumentException(
                            $"Leg arrival date ({legDetail.ActualArrivalDate:yyyy-MM-dd}) cannot be earlier than departure date ({leg.JourneyDate:yyyy-MM-dd}).");
                    }
                    leg.ActualArrivalDate = legDetail.ActualArrivalDate;
                    leg.ActualArrivalTime = legDetail.ActualArrivalTime;
                    leg.ActualArrivalKm = legDetail.ActualArrivalKm;
                }
            }
        }

        if (input.ActualCost.HasValue && input.ActualCost.Value != request.ExpectedCost && request.Allocations.Any())
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            decimal remainingCost = input.ActualCost.Value;
            var newAllocations = new List<TravelRequestBudgetHeadAllocation>();
            
            // Re-allocate based on actual cost
            foreach (var alloc in request.Allocations.OrderBy(a => a.OrderIndex).ToList())
            {
                // To avoid double-counting this request's commitment, we pass excludeWorkflowInstanceId
                var snapshot = await budgetValidator.GetSnapshotAsync(alloc.BudgetHeadId, today, ct, request.WorkflowInstanceId);
                decimal available = Math.Max(0, snapshot.Available);
                decimal drawAmount = Math.Min(remainingCost, available);
                
                if (drawAmount > 0)
                {
                    alloc.CommittedAmount = drawAmount;
                    newAllocations.Add(alloc);
                    remainingCost -= drawAmount;
                }
                else
                {
                    db.TravelRequestBudgetHeadAllocations.Remove(alloc);
                }
                
                if (remainingCost <= 0) break;
            }
            
            if (remainingCost > 0)
            {
                // This shouldn't normally happen unless actual cost drastically exceeds estimated,
                // and funds have run out. For now, just force it into the primary head.
                var primaryAlloc = newAllocations.FirstOrDefault() ?? request.Allocations.First();
                primaryAlloc.CommittedAmount += remainingCost;
            }
            
            request.Allocations = newAllocations;
        }

        await db.SaveChangesAsync(ct);

        var primaryHeadId = request.BudgetHeadId != Guid.Empty
            ? request.BudgetHeadId
            : (request.Allocations.FirstOrDefault()?.BudgetHeadId ?? Guid.Empty);

        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == primaryHeadId, ct)
            ?? await db.BudgetHeads.FirstOrDefaultAsync(b => b.ProjectId == request.ProjectId, ct)
            ?? new BudgetHead { Id = Guid.NewGuid(), ProjectId = request.ProjectId, HeadName = BudgetHeadName.RecurringTravel };
        var faculty = await facultyProfiles.GetAsync(project.OwnerUserId, ct);
        var travelerName = await ResolveTravelerNameAsync(request, faculty, ct);
        var model = TravelDocumentModelFactory.Build(
            request, request.Journeys, project, head, faculty, travelerName);

        var pdf = await documentGeneration.GenerateTravelCoverLetterAsync(model, ct);
        await StoreDocumentAsync(travelRequestId, DocumentKind.CoverLetter, pdf, requestingUserId, ct);

        var billWorkflow = await workflowEngine.GetByRequestAsync(RequestType.Travel, travelRequestId, WorkflowPhase.Bill, ct);
        if (billWorkflow is null)
        {
            var billInstance = await workflowEngine.RaiseAsync(
                RequestType.Travel, travelRequestId, WorkflowPhase.Bill, requestingUserId, ct);
            if (project.CurrentDaUserId is { } daUserId)
            {
                billInstance.AssignedToUserId = daUserId;
                billInstance.IsAssignedViaProjectDa = true;
                await db.SaveChangesAsync(ct);
            }
        }
    }

    /// <summary>
    /// Legacy spread traveller identity across four columns with nothing keeping
    /// them consistent. The combination is validated here instead.
    /// </summary>
    private static void Validate(RaiseTravelInput input)
    {
        if (input.Journeys.Count == 0)
        {
            throw new ArgumentException(
                "A travel request must include at least one journey leg.", nameof(input));
        }

        if (input.ReturnDate < input.OnwardDate)
        {
            throw new ArgumentException(
                "The return date cannot be earlier than the onward date.", nameof(input));
        }

        if (input.TaxiReimbursementOptedIn && string.IsNullOrWhiteSpace(input.TaxiReason))
        {
            throw new ArgumentException(
                "BRD A7.5 Rule Violation: A strong mandatory reason for taxi travel is required when taxi reimbursement is selected.",
                nameof(input));
        }

        foreach (var leg in input.Journeys)
        {
            if (leg.ArrivalDate.HasValue && leg.ArrivalDate.Value < leg.Date)
            {
                throw new ArgumentException(
                    $"Journey leg arrival date ({leg.ArrivalDate:yyyy-MM-dd}) cannot be earlier than departure date ({leg.Date:yyyy-MM-dd}).",
                    nameof(input));
            }

            if (leg.Date < input.OnwardDate || leg.Date > input.ReturnDate)
            {
                throw new ArgumentException(
                    $"Journey leg dated {leg.Date:yyyy-MM-dd} falls outside the travel period " +
                    $"{input.OnwardDate:yyyy-MM-dd} to {input.ReturnDate:yyyy-MM-dd}.",
                    nameof(input));
            }

            if (leg.Amount < 0m)
            {
                throw new ArgumentException("Journey amounts cannot be negative.", nameof(input));
            }

            if ((leg.Mode == TravelMode.Air || input.PrimaryMode == TravelMode.Air) &&
                leg.Platform == BookingPlatform.Other)
            {
                throw new ArgumentException(
                    "BRD A7.5 Rule Violation: Eligible booking platforms for air tickets are strictly restricted to IRCTC, Ashoka Travel, or Balmer Lawrie.",
                    nameof(input));
            }
        }

        if (input.AccommodationCost < 0m || input.OtherExpensesCost < 0m)
        {
            throw new ArgumentException("Costs cannot be negative.", nameof(input));
        }

        var travelerTypes = input.TravelerTypes != null && input.TravelerTypes.Count > 0
            ? input.TravelerTypes
            : [input.TravelerType];
        var primaryModes = input.PrimaryModes != null && input.PrimaryModes.Count > 0
            ? input.PrimaryModes
            : [input.PrimaryMode];

        if (travelerTypes.Contains(TravelerType.Manpower))
        {
            if (input.ManpowerId is null)
            {
                throw new ArgumentException(
                    "A 'Manpower' travel request requires a sanctioned manpower position.",
                    nameof(input));
            }
        }
        else if (input.ManpowerId is not null)
        {
            throw new ArgumentException(
                "A travel request without manpower must not reference a manpower position.",
                nameof(input));
        }

        if (travelerTypes.Contains(TravelerType.CoPi))
        {
            if (string.IsNullOrWhiteSpace(input.CoPiName)
                || string.IsNullOrWhiteSpace(input.CoPiDesignation))
            {
                throw new ArgumentException(
                    "A 'CoPi' travel request requires the co-PI's name and designation.",
                    nameof(input));
            }
        }
        else if (!string.IsNullOrWhiteSpace(input.CoPiName)
            || !string.IsNullOrWhiteSpace(input.CoPiDesignation))
        {
            throw new ArgumentException(
                "A travel request without co-PI must not carry co-PI details.", nameof(input));
        }

        if (travelerTypes.Contains(TravelerType.Other))
        {
            if (string.IsNullOrWhiteSpace(input.OtherTravelerDetails))
            {
                throw new ArgumentException(
                    "Other traveller details are required when 'Other' traveller is selected.",
                    nameof(input));
            }
        }

        if (primaryModes.Contains(TravelMode.Other))
        {
            if (string.IsNullOrWhiteSpace(input.OtherPrimaryModeDetails))
            {
                throw new ArgumentException(
                    "Other primary mode details are required when 'Other' mode is selected.",
                    nameof(input));
            }
        }
    }

    private async Task<string> ResolveTravelerNameAsync(
        TravelRequest request, FacultyProfileInfo faculty, CancellationToken ct)
    {
        var types = !string.IsNullOrWhiteSpace(request.TravelerTypes)
            ? request.TravelerTypes.Split(',').Select(Enum.Parse<TravelerType>).ToList()
            : [request.TravelerType];

        var names = new List<string>();
        foreach (var t in types)
        {
            switch (t)
            {
                case TravelerType.Self:
                    names.Add(faculty.Name);
                    break;
                case TravelerType.CoPi:
                    if (!string.IsNullOrWhiteSpace(request.CoPiName)) names.Add(request.CoPiName);
                    break;
                case TravelerType.Manpower:
                    var mpName = await ResolveManpowerNameAsync(request.ManpowerId, ct);
                    if (!string.IsNullOrWhiteSpace(mpName)) names.Add(mpName);
                    break;
                case TravelerType.Other:
                    if (!string.IsNullOrWhiteSpace(request.OtherTravelerDetails)) names.Add(request.OtherTravelerDetails);
                    break;
            }
        }
        return names.Count > 0 ? string.Join(", ", names) : string.Empty;
    }

    private async Task<string> ResolveManpowerNameAsync(Guid? manpowerId, CancellationToken ct)
    {
        if (manpowerId is null)
        {
            return string.Empty;
        }

        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == manpowerId, ct);

        return position?.Designation ?? string.Empty;
    }

    private async Task<Project> LoadProjectForInitiatorAsync(
        Guid projectId, Guid requestingUserId, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ArgumentException($"Project '{projectId}' was not found.", nameof(projectId));

        if (project.Status != ProjectStatus.Approved && project.Status != ProjectStatus.Active)
        {
            throw new InvalidOperationException("Travel requests cannot be raised until the project is approved by the Dean.");
        }

        if (project.OwnerUserId == requestingUserId)
        {
            return project;
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

        throw new UnauthorizedAccessException(
            $"Project '{projectId}' does not belong to the requesting user.");
    }

    private async Task<IReadOnlyList<TravelSummary>> ToSummariesAsync(
        IReadOnlyList<TravelRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0)
        {
            return [];
        }

        var workflowIds = requests.Select(r => r.WorkflowInstanceId).ToHashSet();
        var stages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id) && w.Phase == WorkflowPhase.Indent)
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        return
        [
            .. requests.Select(r => new TravelSummary(
                r.Id,
                r.ProjectId,
                r.Allocations?.OrderBy(a => a.OrderIndex).Select(a => a.BudgetHeadId).ToList() ?? [r.BudgetHeadId],
                r.WorkflowInstanceId,
                r.TravelerType,
                r.Place,
                r.Purpose,
                r.OnwardDate,
                r.ReturnDate,
                r.ExpectedCost,
                r.TaxiReimbursementOptedIn,
                stages.TryGetValue(r.WorkflowInstanceId, out var stage) ? stage : WorkflowStage.Raised,
                r.CreatedAt,
                r.TaxiReason,
                !string.IsNullOrWhiteSpace(r.TravelerTypes)
                    ? r.TravelerTypes.Split(',').Select(Enum.Parse<TravelerType>).ToList()
                    : [r.TravelerType],
                r.OtherTravelerDetails))
        ];
    }

    private async Task StoreDocumentAsync(
        Guid travelRequestId, DocumentKind kind, byte[] pdf, Guid uploadedByUserId, CancellationToken ct)
    {
        var documentId = Guid.NewGuid();
        var fileName = $"{kind.ToString().ToLowerInvariant()}-{travelRequestId}.pdf";

        using var stream = new MemoryStream(pdf);
        var storagePath = await documentStorage.SaveAsync(documentId, 1, stream, fileName, ct);

        db.Documents.Add(new Document
        {
            Id = documentId,
            OwnerType = OwnerTypeName,
            OwnerId = travelRequestId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = storagePath,
            UploadedByUserId = uploadedByUserId,
            UploadedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }
}
