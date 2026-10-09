namespace API.Application.Recruitment;

/// <summary>
/// Composes the printable recruitment documents.
/// </summary>
/// <remarks>
/// Separate from the procurement and travel generators for the same reason those
/// are separate from each other: each takes its own document model, and widening
/// one interface would force every consumer to carry methods it cannot implement.
/// </remarks>
public interface IRecruitmentDocumentGenerationService
{
    /// <summary>Legacy generate_advertisement.php.</summary>
    Task<byte[]> GenerateAdvertisementAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>
    /// The same advertisement layout GenerateAdvertisementAsync renders into
    /// a PDF, returned as plain HTML instead -- used for a live "Preview"
    /// of unsaved draft text, where generating a real PDF on every click
    /// would be needless overhead. Synchronous by nature (no PDF renderer
    /// involved) but kept Task-returning for interface symmetry with the
    /// other methods here.
    /// </summary>
    Task<string> RenderAdvertisementHtmlAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>Legacy generate_screening_proforma.php.</summary>
    Task<byte[]> GenerateScreeningProformaAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>Legacy generate_selection_proforma.php.</summary>
    Task<byte[]> GenerateSelectionProformaAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>Legacy generate_minutes_proforma.php.</summary>
    Task<byte[]> GenerateMinutesOfSelectionAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>The ranked list the selection committee signs.</summary>
    Task<byte[]> GenerateMeritListAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default);

    /// <summary>Legacy generate_manpower_offer_letter.php.</summary>
    Task<byte[]> GenerateOfferLetterAsync(
        OfferLetterModel model, CancellationToken ct = default);

    Task<byte[]> GenerateJoiningLetterAsync(
        OfferLetterModel model, CancellationToken ct = default);
}
