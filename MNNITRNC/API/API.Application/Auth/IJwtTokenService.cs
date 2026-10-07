using API.Domain.Entities;

namespace API.Application.Auth;

public interface IJwtTokenService
{
    string GenerateToken(ApplicationUser user, IList<string> roles);
}
