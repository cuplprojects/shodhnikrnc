namespace API.Application.Documents;

/// <summary>
/// Composes the printable procurement documents. Consumed by the indent services
/// in Phase 3b.
/// </summary>
public interface IDocumentGenerationService
{
    /// <summary>
    /// Renders the indent packet: cover letter, page break, then the annexure for
    /// the given tier. When a GeM quotation PDF is supplied its pages are appended,
    /// matching the legacy merge-at-raise-time behaviour.
    /// </summary>
    Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier,
        IndentDocumentModel model,
        byte[]? gemQuotationPdf = null,
        CancellationToken ct = default);

    Task<byte[]> GenerateBillCoverLetterAsync(
        IndentDocumentModel model,
        CancellationToken ct = default);
}
