using System.ComponentModel.DataAnnotations;
using API.Domain.Enums;

namespace API.Contracts.Access;

/// <summary>A role, and whether it may be renamed or deleted.</summary>
public record RoleResponse(Guid Id, string Name, bool IsProtected, int UserCount);

public record CreateRoleRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(64)]
    public string Name { get; init; } = string.Empty;
}

public record RenameRoleRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(64)]
    public string Name { get; init; } = string.Empty;
}

/// <summary>The full module/page tree with a role's access marked on it.</summary>
public record RoleAccessResponse(
    Guid RoleId,
    string RoleName,
    bool IsProtected,
    IReadOnlyList<AccessModuleResponse> Modules);

public record AccessModuleResponse(
    string Key,
    string Name,
    string Group,
    IReadOnlyList<AccessPageResponse> Pages);

public record AccessPageResponse(
    string Key,
    string Name,
    string Route,
    bool IsNavigable,
    bool IsGranted,
    AccessScope Scope);

/// <summary>
/// A role's complete page list. Sent whole rather than as a delta, for the same
/// reason workflow routes are: a permission set is only meaningful entire, and
/// partial edits invite drift between what the admin saw and what was saved.
/// </summary>
public record UpdateRoleAccessRequest
{
    public IReadOnlyList<RolePageGrantRequest> Pages { get; init; } = [];
}

public record RolePageGrantRequest
{
    [Required]
    public string PageKey { get; init; } = string.Empty;

    public AccessScope Scope { get; init; } = AccessScope.Own;
}

/// <summary>A per-user exception, with the reason it exists.</summary>
public record UserGrantResponse(
    Guid UserId,
    string UserName,
    string PageKey,
    string PageName,
    GrantEffect Effect,
    AccessScope Scope,
    string Reason,
    DateTimeOffset GrantedAt);

public record CreateUserGrantRequest
{
    [Required]
    public string PageKey { get; init; } = string.Empty;

    public GrantEffect Effect { get; init; }

    public AccessScope Scope { get; init; } = AccessScope.Own;

    /// <summary>Required: an unexplained exception is unauditable a year later.</summary>
    [Required]
    [MinLength(3, ErrorMessage = "A reason is required for a per-user exception.")]
    [MaxLength(500)]
    public string Reason { get; init; } = string.Empty;
}
