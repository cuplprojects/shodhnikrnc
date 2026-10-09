using API.Application.Common;
using API.Application.Projects;
using API.Application.Travel;
using API.Authorization;
using API.Contracts.Travel;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
// GET endpoints are open to any authenticated user; the service layer
// filters results to what the caller is allowed to see.
// POST endpoints are still gated on the page-access permission so that
// only roles the SuperAdmin grants can raise or bill travel requests.
[Authorize]
public class TravelRequestsController(
    ITravelRequestService travelService,
    IApplicationDbContext db,
    IProjectService projectService) : ControllerBase
{
    [HttpPost("api/projects/{projectId:guid}/travel-requests")]
    public async Task<ActionResult<Guid>> Raise(
        Guid projectId, [FromBody] RaiseTravelRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var manpowerId = request.ManpowerId;
        
        if (request.TravelerTypes?.Contains(TravelerType.Manpower) == true && manpowerId == null)
        {
            var fellowSelection = await db.ManpowerSelections
                .FirstOrDefaultAsync(m => m.ApplicationUserId == userId.Value 
                    && m.Status == ManpowerSelectionStatus.Active 
                    && m.ValidTill >= today, ct);
            if (fellowSelection != null)
            {
                manpowerId = fellowSelection.SanctionedManpowerPositionId;
            }
        }

        var input = new RaiseTravelInput(
            ProjectId: projectId,
            BudgetHeadIds: request.BudgetHeadIds,
            TravelerType: request.TravelerType,
            ManpowerId: manpowerId,
            CoPiName: request.CoPiName,
            CoPiDesignation: request.CoPiDesignation,
            Place: request.Place,
            Purpose: request.Purpose,
            OnwardDate: request.OnwardDate,
            ReturnDate: request.ReturnDate,
            PrimaryMode: request.PrimaryMode,
            TaxiReimbursementOptedIn: request.TaxiReimbursementOptedIn,
            AccommodationDetails: request.AccommodationDetails,
            AccommodationCost: request.AccommodationCost,
            OtherExpensesDetails: request.OtherExpensesDetails,
            OtherExpensesCost: request.OtherExpensesCost,
            Journeys:
            [
                .. (request.Journeys ?? []).Select(j => new JourneyLegInput(
                    j.From, j.To, j.Date, j.Mode, j.Platform, j.Amount, j.Remarks, j.ArrivalDate))
            ],
            TaxiReason: request.TaxiReason,
            TravelerTypes: request.TravelerTypes,
            OtherTravelerDetails: request.OtherTravelerDetails,
            PrimaryModes: request.PrimaryModes,
            OtherPrimaryModeDetails: request.OtherPrimaryModeDetails);

        var travelRequestId = await travelService.RaiseAsync(input, userId.Value, ct);
        return Created($"{Request.Path}/{travelRequestId}", travelRequestId);
    }

    [HttpGet("api/projects/{projectId:guid}/travel-requests")]
    public async Task<ActionResult<IReadOnlyList<TravelListItemResponse>>> List(
        Guid projectId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var summaries = await travelService.ListForProjectAsync(projectId, userId.Value, User.GetRoles(), ct);

        return Ok(summaries.Select(ToListItem).ToList());
    }

    [HttpGet("api/travel-requests/{id:guid}")]
    public async Task<ActionResult<TravelRequestResponse>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var detail = await travelService.GetAsync(id, userId.Value, User.GetRoles(), ct);
        var s = detail.Summary;

        return Ok(new TravelRequestResponse(
            s.Id, s.ProjectId, s.BudgetHeadIds, s.WorkflowInstanceId,
            s.TravelerType, detail.ManpowerId, detail.CoPiName, detail.CoPiDesignation,
            s.Place, s.Purpose, s.OnwardDate, s.ReturnDate,
            detail.PrimaryMode, s.TaxiReimbursementOptedIn,
            detail.AccommodationDetails, detail.AccommodationCost,
            detail.OtherExpensesDetails, detail.OtherExpensesCost,
            detail.JourneyTotalCost, s.ExpectedCost,
            detail.OriginalBillReference, detail.TaxiCost, detail.ActualCost,
            s.CurrentStage, s.CreatedAt,
            [
                .. detail.Journeys.Select(j => new TravelJourneyLegResponse(
                    j.From, j.To, j.Date, j.Mode, j.Platform, j.Amount, j.Remarks, j.ArrivalDate,
                    j.ActualArrivalDate, j.ActualArrivalTime, j.ActualArrivalKm, j.LegId))
            ],
            [
                .. detail.Allocations.Select(a => new TravelBudgetAllocationResponse(
                    a.BudgetHeadId, a.Amount))
            ],
            detail.TaxiReason,
            s.TravelerTypes, s.OtherTravelerDetails, detail.PrimaryModes, detail.OtherPrimaryModeDetails,
            detail.BillNo, detail.GenerationDate, detail.Kilometer, detail.StartTime, detail.EndTime, detail.BillFileUrl, detail.BillProcessStatus));
    }

    [HttpPost("api/travel-requests/{id:guid}/process-bill")]
    [PageAccess("process-bill.list")]
    public async Task<IActionResult> ProcessBill(
        Guid id, [FromBody] ProcessTravelBillRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await travelService.ProcessBillAsync(
            id,
            new ProcessTravelBillInput(
                request.OriginalBillReference,
                request.TaxiCost,
                request.ActualCost,
                request.BillNo,
                request.GenerationDate,
                request.Kilometer,
                request.StartTime,
                request.EndTime,
                request.BillFileUrl,
                request.BillProcessStatus,
                request.LegArrivalDetails?.Select(l => new ProcessTravelBillLegInput(
                    l.LegId, l.From, l.To, l.ActualArrivalDate, l.ActualArrivalTime, l.ActualArrivalKm)).ToList()),
            userId.Value,
            User.GetRoles(),
            ct);

        return NoContent();
    }

    private static TravelListItemResponse ToListItem(TravelSummary s) =>
        new(s.Id, s.ProjectId, s.BudgetHeadIds, s.WorkflowInstanceId,
            s.TravelerType, s.Place, s.Purpose, s.OnwardDate, s.ReturnDate,
            s.ExpectedCost, s.TaxiReimbursementOptedIn, s.CurrentStage, s.CreatedAt, s.TaxiReason,
            s.TravelerTypes, s.OtherTravelerDetails);

    /// <summary>
    /// Single API endpoint to retrieve all travel requests across visible projects
    /// for office queues (Assigned Requests & Forwarded for Action).
    /// </summary>
    [HttpGet("api/travel-requests")]
    public async Task<ActionResult> ListAll(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var visibleProjects = await projectService.ListVisibleToAsync(userId.Value, User.GetRoles(), ct);
        var userProjects = visibleProjects.ToDictionary(p => p.Id, p => new { p.ProjectTitle, p.OwnerUserId });
        var projectIds = userProjects.Keys.ToList();

        var roles = User.GetRoles();
        var isOfficeOrHigher = roles.Any(r => r == "HOD" || r == "Dean" || r == "Director" || r == "SuperAdmin" || r == "DeputyRegistrar" || r == "Superintendent" || r == "RegularStaff");
        var isPI = roles.Any(r => r == "Faculty" || r == "PI" || r == "CoPI");

        var query = db.TravelRequests.Where(t => projectIds.Contains(t.ProjectId));
        
        if (!isOfficeOrHigher && !isPI)
        {
            var myManpowerIds = await db.ManpowerSelections
                .Where(m => m.ApplicationUserId == userId.Value)
                .Select(m => m.SanctionedManpowerPositionId)
                .ToListAsync(ct);

            query = query.Where(t => t.TravelerType == TravelerType.Manpower && t.ManpowerId != null && myManpowerIds.Contains(t.ManpowerId.Value));
        }

        var travelRequests = await query.ToListAsync(ct);

        var workflowIds = travelRequests.Select(t => t.WorkflowInstanceId).ToHashSet();
        var workflowStages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var facultyIds = userProjects.Values.Select(p => p.OwnerUserId.ToString()).Distinct().ToList();
        var facultyProfiles = await db.FacultyProfiles
            .Where(f => facultyIds.Contains(f.UserId))
            .ToDictionaryAsync(f => f.UserId, f => f.Name ?? string.Empty, ct);

        var result = travelRequests.Select(item =>
        {
            userProjects.TryGetValue(item.ProjectId, out var proj);
            facultyProfiles.TryGetValue(proj?.OwnerUserId.ToString() ?? string.Empty, out var piName);
            workflowStages.TryGetValue(item.WorkflowInstanceId, out var stage);

            return new
            {
                id = item.Id,
                indentType = "Travel",
                itemCategory = "Travel",
                itemName = $"Travel to {item.Place} ({item.Purpose})",
                place = item.Place,
                purpose = item.Purpose,
                expectedCost = item.ExpectedCost,
                indenterName = !string.IsNullOrWhiteSpace(piName) ? piName : "Project PI",
                projectTitle = proj?.ProjectTitle ?? "Research Project",
                projectId = item.ProjectId,
                budgetHeadId = item.BudgetHeadId,
                workflowInstanceId = item.WorkflowInstanceId,
                createdAt = item.CreatedAt,
                currentStage = stage.ToString(),
                travelerType = item.TravelerType.ToString(),
                travelerTypes = item.TravelerTypes,
                otherTravelerDetails = item.OtherTravelerDetails,
                primaryMode = item.PrimaryMode.ToString(),
                primaryModes = item.PrimaryModes,
                otherPrimaryModeDetails = item.OtherPrimaryModeDetails,
                onwardDate = item.OnwardDate,
                returnDate = item.ReturnDate,
                originalBillReference = item.OriginalBillReference,
                billNo = item.BillNo ?? item.OriginalBillReference,
                actualCost = item.ActualCost,
                taxiCost = item.TaxiCost,
                generationDate = item.GenerationDate,
                kilometer = item.Kilometer,
                startTime = item.StartTime,
                endTime = item.EndTime,
                billFileUrl = item.BillFileUrl,
                billProcessStatus = item.BillProcessStatus,
            };
        }).ToList();

        return Ok(result);
    }
}
