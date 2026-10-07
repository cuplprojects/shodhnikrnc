namespace API.Application.Documents;

public record IndentCommitteeMemberModel(string Name, string Role);

public record IndentDocumentItemModel(
    int SerialNumber,
    string Name,
    bool IsConsumable,
    string TechnicalSpecs,
    string UnitOfMeasurement,
    int Quantity,
    decimal EstimatedCost);

/// <summary>
/// View-model for the generated indent documents (cover letter + annexure).
/// Field set is derived from every value the legacy templates interpolate.
/// </summary>
public record IndentDocumentModel(
    // Project context
    string SanctionNo,
    string ProjectTitle,
    string Agency,
    string BudgetHeadName,

    // Indenting faculty
    string FacultyName,
    string FacultyDesignation,
    string FacultyDepartment,

    // The requested items
    IReadOnlyList<IndentDocumentItemModel> Items,
    string Purpose,

    // Shown on the cover letter's summary table
    string GemAvailability,
    string ModeOfPurchase,
    string Status,

    // Stock register (section B) — blank until bill processing fills them in
    string? StockBookPage,
    string? StockDescription,
    string? StockQuantity,
    string? StockActualCost,
    string? StockCondition,

    // Additional configuration (Section F)
    bool InstallationRequired,
    bool TrainingRequired,
    string? QualificationCriterion,
    int? NumberOfEnclosures,
    string? MaxDeliveryPeriod,
    string? PurposeOfAcquiring,
    string? PerpetualLicense,

    // Populated only for the Non-GeM Rs.2L-25L tier (Annexure 11)
    IReadOnlyList<IndentCommitteeMemberModel> CommitteeMembers)
{
    /// <summary>Date printed on the cover letter, matching legacy's date('d-m-Y').</summary>
    public string CurrentDate { get; init; } = DateTime.Now.ToString("dd-MM-yyyy");

    public string IndentNumber { get; init; } = string.Empty;
    public string IndentDate { get; init; } = DateTime.Now.ToString("dd/MM/yyyy");

    // Legacy fallback properties for Cover Letters
    public string ItemName => Items?.Count > 0 ? Items[0].Name : string.Empty;
    public string TechnicalSpecs => Items?.Count > 0 ? Items[0].TechnicalSpecs : string.Empty;
    public string UnitOfMeasurement => Items?.Count > 0 ? Items[0].UnitOfMeasurement : string.Empty;
    public int Quantity => Items?.Count > 0 ? Items[0].Quantity : 0;
    public decimal EstimatedCost => Items?.Count > 0 ? Items[0].EstimatedCost : 0m;
}
