using API.Domain.Entities;

namespace API.Application.Fellowship;

/// <summary>
/// Resolves the calling fellow's appointment and enforces the ID card gate.
/// </summary>
/// <remarks>
/// Deliberately separate from the PI-facing ownership checks. Every other
/// service in this codebase scopes by <c>project.OwnerUserId == requestingUserId</c>,
/// which asks "does this PI own this project". A fellow owns no project, so that
/// helper cannot be reused -- reaching for it here would either deny every fellow
/// or, if loosened, expose one fellow's records to another.
/// </remarks>
public interface IFellowContextService
{
    /// <summary>
    /// The caller's appointment, with the ID card gate enforced.
    /// </summary>
    /// <exception cref="FellowAppointmentNotFoundException">The user is not a fellow.</exception>
    /// <exception cref="IdCardNotIssuedException">The ID card has not been issued yet.</exception>
    Task<ManpowerSelection> RequireActiveFellowAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// The appointment without the ID card gate, for the few reads that should
    /// work before the card is issued -- a fellow needs to see that their card is
    /// pending rather than an error.
    /// </summary>
    Task<ManpowerSelection?> FindAppointmentAsync(Guid userId, CancellationToken ct = default);
}
