namespace API.Application.Access;

/// <summary>
/// The role ids a user holds.
/// </summary>
/// <remarks>
/// The same seam as <c>IApplicantRoleService</c> and
/// <c>IWorkflowRoleCatalogue</c>: the application layer does not reference
/// ASP.NET Identity, and this keeps the access service testable with a fake
/// rather than a real user store.
///
/// Ids rather than names, unlike Phase 7's workflow stages. Names are what make
/// a rename dangerous there; keying access on ids means renaming a role is
/// harmless.
/// </remarks>
public interface IUserRoleProvider
{
    Task<IReadOnlyCollection<Guid>> GetRoleIdsAsync(Guid userId, CancellationToken ct = default);
}
