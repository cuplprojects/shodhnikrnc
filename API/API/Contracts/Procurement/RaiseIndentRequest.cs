using API.Domain.Enums;

namespace API.Contracts.Procurement;

/// <summary>
/// Bound as a single <c>[FromForm]</c> model. Mixing a bare <c>IFormFile</c>
/// parameter with loose scalar form fields breaks Swagger generation, which is
/// what happened to the documents upload endpoint in Phase 1; binding one wrapper
/// model avoids it.
/// </summary>
public class RaiseIndentRequest
{
    public required Guid BudgetHeadId { get; set; }
    public required string Name { get; set; }
    public required string TechnicalSpecs { get; set; }
    public required string UnitOfMeasurement { get; set; }
    public required int Quantity { get; set; }
    public required string Purpose { get; set; }
    public required GemAvailability GemAvailability { get; set; }
    public required decimal EstimatedCost { get; set; }

    public string? NonAvailabilityCertificateNumber { get; set; }
    public DateOnly? NonAvailabilityCertificateIssueDate { get; set; }
    public DateOnly? NonAvailabilityCertificateValidityDate { get; set; }

    /// <summary>Required for equipment indents; ignored by the other two types.</summary>
    public Guid? SanctionedEquipmentId { get; set; }

    /// <summary>
    /// JSON array of <see cref="CommitteeMemberDto"/>, e.g.
    /// <c>[{"name":"Prof. C Rao","role":"Chairperson"}]</c>. Sent as a string
    /// because a nested collection does not bind reliably from multipart form data.
    /// Only used by the Rs.2L-25L non-GeM tier, which is the only form that prints
    /// a committee roster.
    /// </summary>
    public string? CommitteeMembersJson { get; set; }

    /// <summary>Optional GeM quotation PDF; its pages are appended to the annexure.</summary>
    public IFormFile? GemQuotation { get; set; }

    public string? PaymentRouting { get; set; } = "Party Payment";
    public string? BiddingNumber { get; set; }
    public DateOnly? BidPublicationDate { get; set; }
    public string? NacItemName { get; set; }
    public DateOnly? QuotationDate { get; set; }
}
