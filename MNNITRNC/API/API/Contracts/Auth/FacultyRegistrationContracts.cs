using System.ComponentModel.DataAnnotations;

namespace API.Contracts.Auth;

/// <remarks>
/// Validation attributes go on the constructor parameters, not via
/// <c>[property: ...]</c> -- see RegisterRequest's own remarks.
/// </remarks>
public record RegisterFacultyRequest(
    [Required] string FullName,
    [Required][EmailAddress] string Email,
    [Required][MinLength(8)] string Password,
    [Required] Guid DepartmentId);

public record PendingFacultyRegistrationResponse(
    Guid UserId, string FullName, string Email, string? Department, DateTimeOffset CreatedAt);
