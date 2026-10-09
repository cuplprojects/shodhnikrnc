namespace API.Application.FacultyUsers;

/// <summary>
/// Self-service profile completion -- scoped to the caller's own account
/// via ApplicationUserId, distinct from IFacultyUserService, which is the
/// admin-facing directory (a different identity axis, keyed by a
/// free-text Employee ID -- see FacultyProfile.ApplicationUserId's own
/// doc comment for why these stay separate).
/// </summary>
public interface IMyProfileService
{
    Task<MyProfileResponse> GetAsync(Guid applicationUserId, CancellationToken ct = default);

    Task SaveAsync(Guid applicationUserId, SaveMyProfileRequest request, CancellationToken ct = default);
}
