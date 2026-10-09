namespace API.Application.Travel;

/// <summary>
/// Composes the printable travel documents.
/// </summary>
/// <remarks>
/// Deliberately separate from <c>IDocumentGenerationService</c>, which is
/// procurement's and takes an <c>IndentDocumentModel</c> throughout. Widening
/// that interface would force every indent consumer to carry travel methods it
/// cannot implement.
/// </remarks>
public interface ITravelDocumentGenerationService
{
    /// <summary>The form generated at raise, equivalent to legacy's generate_travel_request_pdf.</summary>
    Task<byte[]> GenerateTravelRequestFormAsync(
        TravelDocumentModel model, CancellationToken ct = default);

    /// <summary>The reimbursement cover letter, equivalent to legacy's process_travel_bill.</summary>
    Task<byte[]> GenerateTravelCoverLetterAsync(
        TravelDocumentModel model, CancellationToken ct = default);
}
