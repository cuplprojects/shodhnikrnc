namespace API.Application.Fellowship;

/// <summary>
/// Renders the fellowship claim form.
/// </summary>
/// <remarks>
/// Separate from the procurement, travel and recruitment generators for the same
/// reason those are separate from each other: each takes its own document model,
/// and widening one interface would force every consumer to carry methods it
/// cannot implement.
/// </remarks>
public interface IFellowshipDocumentGenerationService
{
    Task<byte[]> GenerateStipendFormAsync(StipendFormModel model, CancellationToken ct = default);
}
