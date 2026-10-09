namespace API.Application.Recruitment;

public record FacultyRegistrationInput(string FullName, string Email, string Password, Guid DepartmentId);

public record PendingFacultyRegistrationSummary(
    Guid UserId, string FullName, string Email, string? Department, DateTimeOffset CreatedAt);

public interface IFacultyRegistrationService
{
    Task<RegistrationResult> RegisterAsync(FacultyRegistrationInput input, CancellationToken ct = default);
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
