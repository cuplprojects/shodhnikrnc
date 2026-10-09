using API.Domain.Entities;
using API.Infrastructure.Auth;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Xunit;

namespace API.Tests.Auth;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService()
    {
        var options = Options.Create(new JwtOptions
        {
            SigningKey = "this-is-a-test-signing-key-that-is-long-enough-256-bits",
            Issuer = "mnnitrnc-tests",
            Audience = "mnnitrnc-tests",
            ExpiryMinutes = 60
        });
        return new JwtTokenService(options);
    }

    [Fact]
    public void GenerateToken_IncludesUserIdAndRoleClaims()
    {
        var service = CreateService();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "deanrc", FullName = "Dean R&C" };

        var token = service.GenerateToken(user, ["Dean"]);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Sub && c.Value == user.Id.ToString());
        jwt.Claims.Should().Contain(c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "Dean");
    }

    [Fact]
    public void GenerateToken_ProducesTokenValidatableWithSameKey()
    {
        var service = CreateService();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "faculty1", FullName = "Faculty One" };

        var token = service.GenerateToken(user, ["Faculty"]);

        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("this-is-a-test-signing-key-that-is-long-enough-256-bits"));

        var act = () => handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidIssuer = "mnnitrnc-tests",
            ValidAudience = "mnnitrnc-tests",
            IssuerSigningKey = key,
        }, out _);

        act.Should().NotThrow();
    }
}
