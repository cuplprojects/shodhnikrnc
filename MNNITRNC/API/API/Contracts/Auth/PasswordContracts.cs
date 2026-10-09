using System.ComponentModel.DataAnnotations;

namespace API.Contracts.Auth;

/// <remarks>
/// Validation attributes go on the constructor parameters, not via
/// <c>[property: ...]</c>. ASP.NET rejects the latter on record primary
/// constructors at request time -- it throws rather than validating.
/// </remarks>
public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required][MinLength(8)] string NewPassword);

public record ForgotPasswordRequest([Required][EmailAddress] string Email);

public record ResetPasswordRequest(
    [Required] Guid UserId,
    [Required] string Token,
    [Required][MinLength(8)] string NewPassword);
