namespace API.Application.Recruitment;

public record FacultyRegistrationInput(string FullName, string Email, string Password, Guid DepartmentId);

/// <summary>
/// A Faculty registration claimed through Shodhanik SSO rather than a password
/// form -- see RegisterFederatedAsync. Fields are already-validated claims off
/// the caller's Shodhanik JWT, not user input: <see cref="DepartmentCode"/> is
/// matched against <see cref="API.Domain.Entities.Department.Code"/> rather
/// than an id, since that's the only department key Shodhanik's token carries.
/// </summary>
public record FederatedFacultyRegistrationInput(
    string ExternalUserId, string FullName, string Email, string? DepartmentCode);

/// <summary>Status of a federated caller's own Faculty registration -- backs the "Pending HOD Approval" screen.</summary>
public enum FederatedFacultyStatus { NotRegistered, Pending, Active }

public record FederatedFacultyStatusResult(FederatedFacultyStatus Status, Guid? UserId);

public record PendingFacultyRegistrationSummary(
    Guid UserId, string FullName, string Email, string? Department, DateTimeOffset CreatedAt);

public interface IFacultyRegistrationService
{
    Task<RegistrationResult> RegisterAsync(FacultyRegistrationInput input, CancellationToken ct = default);

    /// <summary>
    /// Links or creates an RNC account for a Shodhanik-federated Supervisor.
    /// Idempotent per <see cref="FederatedFacultyRegistrationInput.ExternalUserId"/>:
    /// a repeat call (e.g. the frontend retrying after a dropped response)
    /// returns the existing account rather than creating a second one.
    /// </summary>
    Task<RegistrationResult> RegisterFederatedAsync(FederatedFacultyRegistrationInput input, CancellationToken ct = default);

    /// <summary>
    /// Where a federated caller's own registration stands, keyed by their
    /// Shodhanik external id -- NotRegistered if they've never claimed Faculty
    /// access in RNC at all.
    /// </summary>
    Task<FederatedFacultyStatusResult> GetFederatedStatusAsync(string externalUserId, CancellationToken ct = default);

    Task ApproveAsync(Guid userId, Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default);
    Task RejectAsync(Guid userId, Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default);
    Task<IReadOnlyList<PendingFacultyRegistrationSummary>> ListPendingFacultyRegistrationsAsync(
        Guid callerUserId, IReadOnlyCollection<string> callerRoles, CancellationToken ct = default);
}

/// <summary>
/// Thrown by <see cref="IFacultyRegistrationService.ListPendingFacultyRegistrationsAsync"/>
/// when an HOD caller has no resolvable department to scope the queue by.
/// </summary>
public class ReviewerHasNoDepartmentException(Guid userId)
    : Exception($"User '{userId}' has no department and cannot review faculty registrations.");

/// <summary>
/// Thrown by <see cref="IFacultyRegistrationService.ApproveAsync"/>/<see cref="IFacultyRegistrationService.RejectAsync"/>
/// when a non-Office (HOD) caller targets a registration outside their own department.
/// [PageAccess("faculty-registrations.review")] only checks that the caller holds a role
/// allowed onto the page at all -- it never compares the caller's department to the
/// target user's, so this check must live in the service, not just the page gate.
/// </summary>
public class ReviewerCannotActOutsideOwnDepartmentException(Guid callerUserId, Guid targetUserId)
    : Exception($"User '{callerUserId}' cannot act on registration '{targetUserId}' outside their own department.");
