using API.Application.Recruitment;

namespace API.Tests.Recruitment;

/// <summary>
/// Stands in for the Identity-backed implementation so recruitment tests do not
/// need a user store. Records what was asked of it, which is what the
/// soft-delete and promotion assertions check.
/// </summary>
public class FakeApplicantRoleService : IApplicantRoleService
{
    public HashSet<Guid> ConfirmedEmails { get; } = [];
    public HashSet<Guid> Deactivated { get; } = [];
    public HashSet<Guid> Reactivated { get; } = [];
    public HashSet<Guid> PromotedToFellow { get; } = [];

    public Task<bool> IsEmailConfirmedAsync(Guid userId, CancellationToken ct = default)
        => Task.FromResult(ConfirmedEmails.Contains(userId));

    public Task DeactivateAsync(Guid userId, CancellationToken ct = default)
    {
        Deactivated.Add(userId);
        return Task.CompletedTask;
    }

    public Task ReactivateAsync(Guid userId, CancellationToken ct = default)
    {
        Reactivated.Add(userId);
        return Task.CompletedTask;
    }

    public Task PromoteToFellowAsync(Guid userId, CancellationToken ct = default)
    {
        PromotedToFellow.Add(userId);
        return Task.CompletedTask;
    }
}
