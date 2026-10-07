using API.Domain.Enums;

namespace API.Application.Access;

/// <summary>A page the user may open, and how far its data reaches.</summary>
public record AccessiblePage(
    string PageKey,
    string PageName,
    string Route,
    string ModuleKey,
    string ModuleName,
    string ModuleGroup,
    bool IsNavigable,
    AccessScope Scope,
    int ModuleOrder,
    int PageOrder);

/// <summary>
/// Resolves what a user may reach: deny beats grant beats role, and the widest
/// scope held wins.
/// </summary>
public interface IPageAccessService
{
    /// <summary>Every page the user may open, ordered for the sidebar.</summary>
    Task<IReadOnlyList<AccessiblePage>> GetPagesForUserAsync(Guid userId, CancellationToken ct = default);

    Task<bool> CanAccessAsync(Guid userId, string pageKey, CancellationToken ct = default);

    /// <summary>
    /// The user's scope on a page, or null when they cannot reach it at all --
    /// distinguishable from <see cref="AccessScope.Own"/>, which would otherwise
    /// read as "allowed, but narrowly".
    /// </summary>
    Task<AccessScope?> GetScopeAsync(Guid userId, string pageKey, CancellationToken ct = default);
}
