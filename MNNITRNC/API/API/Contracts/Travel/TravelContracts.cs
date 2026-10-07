using API.Domain.Enums;

namespace API.Contracts.Travel;

/// <summary>
/// Bound as JSON, not multipart: unlike an indent there is no file attached at
/// raise, so the journey legs bind as an ordinary nested collection.
/// </summary>
/// <remarks>
/// Carries no cost total. The server derives the journey total and expected cost
/// from the legs and the two expense fields.
/// </remarks>
public record RaiseTravelRequest(
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
    IReadOnlyList<JourneyLegRequest> Journeys,
    string? TaxiReason = null,
    IReadOnlyList<TravelerType>? TravelerTypes = null,
    string? OtherTravelerDetails = null,
    IReadOnlyList<TravelMode>? PrimaryModes = null,
    string? OtherPrimaryModeDetails = null);

public record JourneyLegRequest(
    string From,
    string To,
    DateOnly Date,
    TravelMode Mode,
    BookingPlatform Platform,
    decimal Amount,
    string? Remarks,
    DateOnly? ArrivalDate = null);

public record ProcessTravelBillLegRequest(
    Guid? LegId,
    string? From,
    string? To,
    DateOnly? ActualArrivalDate,
    string? ActualArrivalTime,
    string? ActualArrivalKm);

public record ProcessTravelBillRequest(
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
    IReadOnlyList<ProcessTravelBillLegRequest>? LegArrivalDetails = null);

public record TravelListItemResponse(
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

public record TravelJourneyLegResponse(
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

public record TravelBudgetAllocationResponse(
    Guid BudgetHeadId,
    decimal Amount);

public record TravelRequestResponse(
    Guid Id,
    Guid ProjectId,
    List<Guid> BudgetHeadIds,
    Guid WorkflowInstanceId,
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
    decimal JourneyTotalCost,
    decimal ExpectedCost,
    string? OriginalBillReference,
    decimal? TaxiCost,
    decimal? ActualCost,
    WorkflowStage CurrentStage,
    DateTimeOffset CreatedAt,
    IReadOnlyList<TravelJourneyLegResponse> Journeys,
    IReadOnlyList<TravelBudgetAllocationResponse> Allocations,
    string? TaxiReason = null,
    IReadOnlyList<TravelerType>? TravelerTypes = null,
    string? OtherTravelerDetails = null,
    IReadOnlyList<TravelMode>? PrimaryModes = null,
    string? OtherPrimaryModeDetails = null,
    string? BillNo = null,
    DateOnly? GenerationDate = null,
    string? Kilometer = null,
    string? StartTime = null,
    string? EndTime = null,
    string? BillFileUrl = null,
    string? BillProcessStatus = null);
