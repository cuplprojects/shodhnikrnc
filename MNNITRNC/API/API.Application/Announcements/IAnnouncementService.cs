namespace API.Application.Announcements;

public interface IAnnouncementService
{
    Task<IReadOnlyList<AnnouncementResponse>> GetAllAsync(string? category = null, string? status = null, CancellationToken cancellationToken = default);
    Task<AnnouncementResponse?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<AnnouncementResponse> CreateAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default);
    Task<AnnouncementResponse?> UpdateAsync(int id, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
