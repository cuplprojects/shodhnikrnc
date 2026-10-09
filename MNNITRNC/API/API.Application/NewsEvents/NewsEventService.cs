using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.NewsEvents;

public class NewsEventService(IApplicationDbContext db) : INewsEventService
{
    public async Task<IReadOnlyList<NewsEventResponse>> GetAllAsync(string? type = null, CancellationToken cancellationToken = default)
    {
        var query = db.NewsEvents
            .Include(e => e.Images)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.Type.ToLower() == type.Trim().ToLower());
        }

        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        return events.Select(MapToResponse).ToList();
    }

    public async Task<NewsEventResponse?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await db.NewsEvents
            .Include(e => e.Images)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        return entity is null ? null : MapToResponse(entity);
    }

    public async Task<NewsEventResponse> CreateAsync(CreateNewsEventRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.Title, request.Type, request.Content, request.EventDate, request.AdditionalImages);

        var newsEvent = new NewsEvent
        {
            Title = request.Title.Trim(),
            Type = NormalizeType(request.Type),
            Content = request.Content.Trim(),
            EventDate = request.EventDate,
            ImagePath = request.ImagePath?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (request.AdditionalImages is { Count: > 0 })
        {
            foreach (var imgPath in request.AdditionalImages.Take(4))
            {
                if (!string.IsNullOrWhiteSpace(imgPath))
                {
                    newsEvent.Images.Add(new NewsImage
                    {
                        ImagePath = imgPath.Trim(),
                        IsTitle = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        db.NewsEvents.Add(newsEvent);
        await db.SaveChangesAsync(cancellationToken);

        return MapToResponse(newsEvent);
    }

    public async Task<NewsEventResponse?> UpdateAsync(int id, UpdateNewsEventRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.Title, request.Type, request.Content, request.EventDate, request.AdditionalImages);

        var newsEvent = await db.NewsEvents
            .Include(e => e.Images)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (newsEvent is null)
        {
            return null;
        }

        newsEvent.Title = request.Title.Trim();
        newsEvent.Type = NormalizeType(request.Type);
        newsEvent.Content = request.Content.Trim();
        newsEvent.EventDate = request.EventDate;
        newsEvent.ImagePath = request.ImagePath?.Trim();
        newsEvent.UpdatedAt = DateTime.UtcNow;

        // Replace additional images
        newsEvent.Images.Clear();
        if (request.AdditionalImages is { Count: > 0 })
        {
            foreach (var imgPath in request.AdditionalImages.Take(4))
            {
                if (!string.IsNullOrWhiteSpace(imgPath))
                {
                    newsEvent.Images.Add(new NewsImage
                    {
                        NewsId = id,
                        ImagePath = imgPath.Trim(),
                        IsTitle = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return MapToResponse(newsEvent);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var newsEvent = await db.NewsEvents
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (newsEvent is null)
        {
            return false;
        }

        db.NewsEvents.Remove(newsEvent);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string NormalizeType(string type)
    {
        var trimmed = type?.Trim().ToLower();
        return trimmed is "news" or "event" ? trimmed : "news";
    }

    private static void ValidateRequest(string title, string type, string content, DateOnly? eventDate, List<string>? additionalImages)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(type))
        {
            throw new ArgumentException("Type is required.", nameof(type));
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("Content is required.", nameof(content));
        }

        if (eventDate.HasValue && eventDate.Value < DateOnly.FromDateTime(DateTime.UtcNow.Date))
        {
            throw new ArgumentException("Event Date cannot be in the past.", nameof(eventDate));
        }

        if (additionalImages is { Count: > 4 })
        {
            throw new ArgumentException("Maximum 4 additional images are allowed.", nameof(additionalImages));
        }
    }

    private static NewsEventResponse MapToResponse(NewsEvent e)
    {
        var additionalImages = e.Images
            .Where(img => !img.IsTitle)
            .Select(img => img.ImagePath)
            .ToList();

        return new NewsEventResponse(
            e.Id,
            e.Title,
            e.Type,
            e.Content,
            e.EventDate,
            e.ImagePath,
            additionalImages,
            e.CreatedAt,
            e.UpdatedAt
        );
    }
}
