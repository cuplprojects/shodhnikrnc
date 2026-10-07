using API.Application.Documents;
using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Procurement;

/// <summary>
/// Maps a persisted indent plus its project, budget head and indenter onto the
/// view-model the annexure templates render. Shared by all three indent services
/// so the printed forms cannot drift apart between indent types.
/// </summary>
internal static class IndentDocumentModelFactory
{
    public static IndentDocumentModel Build(
        Project project,
        BudgetHead head,
        FacultyProfileInfo faculty,
        IReadOnlyList<IndentCommitteeMemberModel> committee,
        string itemName,
        bool isConsumable,
        string technicalSpecs,
        string unitOfMeasurement,
        int quantity,
        string purpose,
        GemAvailability gemAvailability,
        decimal estimatedCost,
        string? stockBookPage,
        string? stockDescription,
        string? stockQuantity,
        string? stockActualCost,
        string? stockCondition,
        ProcurementTier tier) =>
        new(
            SanctionNo: project.SanctionNo,
            ProjectTitle: project.ProjectTitle,
            Agency: project.Agency,
            BudgetHeadName: head.CustomLabel ?? head.HeadName.ToString(),
            FacultyName: faculty.Name,
            FacultyDesignation: faculty.Designation,
            FacultyDepartment: faculty.Department,
            Items: [new IndentDocumentItemModel(1, itemName, isConsumable, technicalSpecs, unitOfMeasurement, quantity, estimatedCost)],
            Purpose: purpose,
            // The templates print these two verbatim, matching legacy's stored strings.
            GemAvailability: gemAvailability == GemAvailability.Yes ? "yes" : "no",
            ModeOfPurchase: ModeOfPurchaseLabel(tier),
            Status: "indent_raised",
            StockBookPage: stockBookPage,
            StockDescription: stockDescription,
            StockQuantity: stockQuantity,
            StockActualCost: stockActualCost,
            StockCondition: stockCondition,
            InstallationRequired: false,
            TrainingRequired: false,
            QualificationCriterion: null,
            NumberOfEnclosures: null,
            MaxDeliveryPeriod: null,
            PurposeOfAcquiring: null,
            PerpetualLicense: null,
            CommitteeMembers: committee);

    /// <summary>
    /// Legacy stored these as free-text strings submitted by the client. They are
    /// now derived from the server-computed tier, so the label on the cover letter
    /// always agrees with the annexure that was actually generated.
    /// </summary>
    private static string ModeOfPurchaseLabel(ProcurementTier tier) => tier switch
    {
        ProcurementTier.GemUpTo50k => "upto_50000",
        ProcurementTier.Gem50kTo1Lakh => "50000_to_1lakh",
        ProcurementTier.GemAbove1Lakh => "above_1lakh",
        ProcurementTier.NonGemUpTo1Lakh => "upto_1lakh",
        ProcurementTier.NonGem1LakhTo2Lakh => "1lakh_to_2lakh",
        ProcurementTier.NonGem2LakhTo25Lakh => "2lakh_to_25lakh",
        _ => string.Empty,
    };
}
