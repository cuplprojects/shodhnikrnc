using API.Domain.Enums;

namespace API.Application.Travel;

/// <summary>
/// Note what is absent: no cost total. The journey total and expected cost are
/// derived server-side from the legs and the two expense fields, because the
/// printed form and the budget check both depend on them.
/// </summary>
public record RaiseTravelInput(
    Guid ProjectId,
    List<Guid> BudgetHeadIds,
    TravelerType TravelerType,
    Guid? ManpowerId,
    string? CoPiName,
    string? CoPiDesignation,
    string Place,
    string Purpose,
    DateOnly OnwardDate,
    DateOnly ReturnDate,
    TravelMode PrimaryMode,
    bool TaxiReimbursementOptedIn,
    string? AccommodationDetails,
    decimal AccommodationCost,
    string? OtherExpensesDetails,
    decimal OtherExpensesCost,
    IReadOnlyList<JourneyLegInput> Journeys,
    string? TaxiReason = null,
    IReadOnlyList<TravelerType>? TravelerTypes = null,
    string? OtherTravelerDetails = null,
    IReadOnlyList<TravelMode>? PrimaryModes = null,
    string? OtherPrimaryModeDetails = null);

public record JourneyLegInput(
    string From,
    string To,
    DateOnly Date,
    TravelMode Mode,
    BookingPlatform Platform,
    decimal Amount,
    string? Remarks,
    DateOnly? ArrivalDate = null);

public record ProcessTravelBillLegInput(
    Guid? LegId,
    string? From,
    string? To,
    DateOnly? ActualArrivalDate,
    string? ActualArrivalTime,
    string? ActualArrivalKm);

/// <summary>
/// <paramref name="TaxiCost"/> is only admissible when the request opted in at
/// raise -- see <c>TravelRequest.TaxiReimbursementOptedIn</c>.
/// </summary>
public record ProcessTravelBillInput(
    string OriginalBillReference,
    decimal? TaxiCost,
    decimal? ActualCost,
    string? BillNo = null,
    DateOnly? GenerationDate = null,
    string? Kilometer = null,
    string? StartTime = null,
    string? EndTime = null,
    string? BillFileUrl = null,
    string? BillProcessStatus = null,
    IReadOnlyList<ProcessTravelBillLegInput>? LegArrivalDetails = null);

public record TravelSummary(
    Guid Id,
    Guid ProjectId,
    List<Guid> BudgetHeadIds,
    Guid WorkflowInstanceId,
    TravelerType TravelerType,
    string Place,
    string Purpose,
    DateOnly OnwardDate,
    DateOnly ReturnDate,
    decimal ExpectedCost,
    bool TaxiReimbursementOptedIn,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    string? TaxiReason = null,
    IReadOnlyList<TravelerType>? TravelerTypes = null,
    string? OtherTravelerDetails = null);

public record TravelJourneyLegModel(
    string From,
    string To,
    DateOnly Date,
    TravelMode Mode,
    BookingPlatform Platform,
    decimal Amount,
    string? Remarks,
    DateOnly? ArrivalDate = null,
    DateOnly? ActualArrivalDate = null,
    string? ActualArrivalTime = null,
    string? ActualArrivalKm = null,
    Guid? LegId = null);

public record TravelBudgetAllocationModel(
    Guid BudgetHeadId,
    decimal Amount);

public record TravelDetail(
    TravelSummary Summary,
    Guid? ManpowerId,
    string? CoPiName,
    string? CoPiDesignation,
    TravelMode PrimaryMode,
    string? AccommodationDetails,
    decimal AccommodationCost,
    string? OtherExpensesDetails,
    decimal OtherExpensesCost,
    decimal JourneyTotalCost,
    string? OriginalBillReference,
    decimal? TaxiCost,
    decimal? ActualCost,
    IReadOnlyList<TravelJourneyLegModel> Journeys,
    IReadOnlyList<TravelBudgetAllocationModel> Allocations,
    string? TaxiReason = null,
    IReadOnlyList<TravelMode>? PrimaryModes = null,
    string? OtherPrimaryModeDetails = null,
    string? BillNo = null,
    DateOnly? GenerationDate = null,
    string? Kilometer = null,
    string? StartTime = null,
    string? EndTime = null,
    string? BillFileUrl = null,
    string? BillProcessStatus = null);
