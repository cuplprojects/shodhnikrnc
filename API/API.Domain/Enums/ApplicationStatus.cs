namespace API.Domain.Enums;

/// <summary>
/// Gates a <see cref="Entities.Candidate"/> row's visibility to the PI/screening
/// flow. A Draft row is real (already persisted, so it can be resumed or used as
/// a future prefill source) but must never appear in ListCandidatesAsync, the
/// screening/merit-list flow, or GenerateDocumentAsync's candidate rows.
/// </summary>
/// <remarks>
/// Draft is member 0 and therefore the column's default for new inserts. Every
/// row that existed before this enum did was, definitionally, a completed
/// single-shot application, so the migration that introduces the column
/// backfills all of them to Submitted -- without that they would silently
/// vanish from the PI's candidate table once the filtering ships.
/// </remarks>
public enum ApplicationStatus
{
    Draft,
    Submitted
}
