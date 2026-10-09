using System.ComponentModel.DataAnnotations;

namespace API.Contracts.Auth;

/// <remarks>
/// Validation attributes go on the constructor parameters, not via
/// <c>[property: ...]</c>. ASP.NET rejects the latter on record primary
/// constructors at request time -- it throws rather than validating.
/// </remarks>
public record RegisterRequest(
    [Required][EmailAddress] string Email,
    [Required] string FullName,
    [Required][MinLength(8)] string Password);

/// <summary>
/// Deliberately uniform in shape whether or not the address was already known:
/// the caller is unauthenticated here, so the response must not become a way to
/// test which addresses are registered. <see cref="AlreadyRegistered"/> is
/// returned only so the portal can steer a genuine reapplicant to sign in.
/// </summary>
public record RegisterResponse(bool AlreadyRegistered, string Message);

public record ConfirmEmailRequest(
    [Required] Guid UserId,
    [Required] string Token);

public record ResendVerificationRequest(
    [Required][EmailAddress] string Email);
