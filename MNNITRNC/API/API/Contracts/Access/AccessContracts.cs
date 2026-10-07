using API.Domain.Enums;

namespace API.Contracts.Access;

/// <summary>What the signed-in user may reach, grouped for the sidebar.</summary>
public record MyPagesResponse(IReadOnlyList<MyModuleResponse> Modules);

public record MyModuleResponse(
    string Key,
    string Name,
    string Group,
    IReadOnlyList<MyPageResponse> Pages);

public record MyPageResponse(
    string Key,
    string Name,
    string Route,
    bool IsNavigable,
    AccessScope Scope);
