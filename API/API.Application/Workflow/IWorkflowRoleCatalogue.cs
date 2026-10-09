namespace API.Application.Workflow;

/// <summary>
/// The role names that exist, for validating a stage's AllowedRoles.
/// </summary>
/// <remarks>
/// Expressed without reference to ASP.NET Identity, the same seam as
/// <c>IApplicantRoleService</c>: the application layer does not reference
/// Identity, and this keeps the validator testable with a simple fake rather
/// than a real role store.
/// </remarks>
public interface IWorkflowRoleCatalogue
{
    Task<IReadOnlyCollection<string>> GetRoleNamesAsync(CancellationToken ct = default);
}
