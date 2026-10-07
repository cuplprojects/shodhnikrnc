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

/// <summary>
/// Response for the federated Faculty registration endpoint. Token is an
/// RNC-native JWT for the (new-or-existing) account -- the caller arrived on a
/// Shodhanik token, and every subsequent RNC call must use this one instead.
/// </summary>
public record FederatedFacultyRegisterResponse(string Status, string Token);

/// <summary>Response for the federated Faculty status-check endpoint -- backs the "Pending HOD Approval" screen's polling.</summary>
public record FederatedFacultyStatusResponse(string Status);
