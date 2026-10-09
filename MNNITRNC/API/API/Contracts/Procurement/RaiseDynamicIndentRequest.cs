using API.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace API.Contracts.Procurement;

public class RaiseDynamicIndentRequest
{
    public required Guid ProjectId { get; set; }

    /// <summary>JSON-serialized List&lt;IndentHeadSelectionDto&gt;.</summary>
    public string? HeadSelectionsJson { get; set; }
    public IndentType IndentType { get; set; }

    public GemAvailability GemAvailability { get; set; }
    public GemCategoryType? GemCategoryType { get; set; }
    public IndentProcurementRule ProcurementRule { get; set; }
    public bool IsRule166 { get; set; }

    public StockAvailability StockAvailability { get; set; }
    public string? StockBookSerialNo { get; set; }
    public string? StockBookPage { get; set; }
    public DateOnly? StockBookDate { get; set; }
    public string? StockDescription { get; set; }
    public string? StockQuantity { get; set; }
    public string? StockActualCost { get; set; }
    public string? StockCondition { get; set; }

    public required string Purpose { get; set; }
    public PurposeOfAcquiring? PurposeOfAcquiring { get; set; }

    public bool InstallationRequired { get; set; }
    public bool TrainingRequired { get; set; }
    public string? QualificationCriterion { get; set; }
    public string? MaxDeliveryPeriod { get; set; }
    public int? NumberOfEnclosures { get; set; }
    public string? PerpetualLicense { get; set; }

    public string? NonAvailabilityCertificateNumber { get; set; }
    public DateOnly? NonAvailabilityCertificateIssueDate { get; set; }
    public DateOnly? NonAvailabilityCertificateValidityDate { get; set; }
    public DateOnly? QuotationDate { get; set; }

    public string? CommitteeFacultyUserId { get; set; }

    public string? BiddingNumber { get; set; }
    public DateOnly? BidPublicationDate { get; set; }

    public string? ItemsJson { get; set; }

    public IFormFile? EstimatePdf { get; set; }
    public IFormFile? GemQuotation { get; set; }
    public IFormFile? PecCertificate { get; set; }
    public IFormFile? MacCertificate { get; set; }
    public IFormFile? PacCertificate { get; set; }
    public IFormFile? OtherSingleTenderDoc { get; set; }
    public IFormFile? NonAvailabilityCertificate { get; set; }
}

public record DynamicIndentItemDto(
    string Name,
    bool IsConsumable,
    string TechnicalSpecs,
    string UnitOfMeasurement,
    int Quantity,
    decimal EstimatedCostInclTax
);
