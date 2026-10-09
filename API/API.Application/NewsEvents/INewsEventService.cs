namespace API.Application.NewsEvents;

public interface INewsEventService
{
    Task<IReadOnlyList<NewsEventResponse>> GetAllAsync(string? type = null, CancellationToken cancellationToken = default);
    Task<NewsEventResponse?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<NewsEventResponse> CreateAsync(CreateNewsEventRequest request, CancellationToken cancellationToken = default);
    Task<NewsEventResponse?> UpdateAsync(int id, UpdateNewsEventRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
