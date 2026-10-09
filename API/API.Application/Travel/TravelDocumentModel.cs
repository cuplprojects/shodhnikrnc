using API.Domain.Enums;

namespace API.Application.Travel;

/// <summary>
/// Flat view of everything the travel templates print. Assembled by
/// <see cref="TravelDocumentModelFactory"/> so the templates never touch
/// entities or the database.
/// </summary>
public record TravelDocumentModel(
    string ProjectTitle,
    string Agency,
    string SanctionNo,
    string BudgetHeadName,
    string FacultyName,
    string FacultyDesignation,
    string FacultyDepartment,
    string TravelerName,
    string TravelerTypeLabel,
    string Place,
    string Purpose,
    DateOnly OnwardDate,
    DateOnly ReturnDate,
    string PrimaryModeLabel,
    bool TaxiReimbursementOptedIn,
    string? AccommodationDetails,
    decimal AccommodationCost,
    string? OtherExpensesDetails,
    decimal OtherExpensesCost,
    decimal JourneyTotalCost,
    decimal ExpectedCost,
    IReadOnlyList<TravelJourneyLegRow> Journeys);

public record TravelJourneyLegRow(
    int SerialNumber,
    string From,
    string To,
    DateOnly Date,
    string ModeLabel,
    string PlatformLabel,
    decimal Amount,
    string? Remarks);
