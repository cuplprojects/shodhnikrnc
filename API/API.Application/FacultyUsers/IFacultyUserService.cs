using API.Domain.Entities;

namespace API.Application.FacultyUsers;

public interface IFacultyUserService
{
    Task<FacultyProfileResponse> CreateFacultyUserAsync(CreateFacultyUserRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<FacultyProfileResponse>> GetAllFacultyProfilesAsync(CancellationToken cancellationToken = default);
    Task<FacultyProfileResponse?> GetFacultyProfileByUserIdAsync(string userId, CancellationToken cancellationToken = default);
}
