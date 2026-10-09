namespace API.Contracts.Auth;

public record LoginResponse(string Token, string FullName, IReadOnlyList<string> Roles, bool ProfileComplete);
