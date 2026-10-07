namespace API.Application.Access;

/// <summary>
/// Whether a user's department confers institute-wide sight -- extracted
/// (Phase 10) from what had become a copy-pasted check in
/// <see cref="PageAccessService"/> and
/// <c>ResearchProposalService.ListForRnCOfficeAsync</c>. The reporting
/// queries (Phase 10) are a third and fourth consumer, past the "fine to
/// inline" bar this codebase has otherwise held to.
/// </summary>
public interface IInstituteWideScopeResolver
{
    /// <summary>
    /// True when the user's own department is flagged
    /// <c>Department.IsInstituteWide</c> (R&amp;C membership, not role rank).
    /// A user with no department resolves false, not an error -- the same
    /// safe default every existing caller already relied on before this was
    /// extracted.
    /// </summary>
    Task<bool> IsInstituteWideAsync(Guid userId, CancellationToken ct = default);
}
