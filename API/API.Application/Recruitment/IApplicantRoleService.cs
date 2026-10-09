namespace API.Application.Recruitment;

/// <summary>
/// The identity operations recruitment needs, expressed without reference to
/// ASP.NET Identity.
/// </summary>
/// <remarks>
/// <see cref="RecruitmentService"/> lives in the application layer, which does
/// not reference Identity -- <c>UserManager</c> is an infrastructure concern.
/// This seam keeps the service testable with a simple fake rather than a real
/// user store.
/// </remarks>
public interface IApplicantRoleService
{
    /// <summary>Verification gates applying, so the service checks it before accepting one.</summary>
    Task<bool> IsEmailConfirmedAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Soft delete after a rejection leaves the applicant with nothing live.</summary>
    Task DeactivateAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Reapplying revives a soft-deleted account.</summary>
    Task ReactivateAsync(Guid userId, CancellationToken ct = default);

    /// <summary>On joining: role Applicant -> Fellow.</summary>
    Task PromoteToFellowAsync(Guid userId, CancellationToken ct = default);
}
