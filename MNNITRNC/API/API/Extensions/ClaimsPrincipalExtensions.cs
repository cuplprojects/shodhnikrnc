using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace API.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Extracts the current user's ID from the JWT "sub" claim.
    /// Returns null instead of throwing if the claim is missing or not a valid GUID.
    /// </summary>
    public static Guid? GetUserId(this ClaimsPrincipal principal)
    {
        var sub = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (Guid.TryParse(sub, out var userId))
        {
            return userId;
        }

        return null;
    }

    /// <summary>
    /// The roles carried on the principal, for the workflow engine to check
    /// against a stage's AllowedRoles.
    /// </summary>
    /// <remarks>
    /// JwtTokenService writes them as <see cref="ClaimTypes.Role"/>, which is
    /// also what [Authorize(Roles = ...)] reads -- so this sees exactly the set
    /// the attributes used to gate on, and moving the check into the engine
    /// cannot silently widen or narrow it.
    /// </remarks>
    public static IReadOnlyCollection<string> GetRoles(this ClaimsPrincipal principal) =>
        principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
}
