using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Announcements;

public class AnnouncementService(IApplicationDbContext db) : IAnnouncementService
{
    private static readonly HashSet<string> ValidCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "job", "proposal", "project"
    };

    private static readonly HashSet<string> ValidStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "active", "inactive"
    };

    public async Task<IReadOnlyList<AnnouncementResponse>> GetAllAsync(string? category = null, string? status = null, CancellationToken cancellationToken = default)
    {
        var query = db.Announcements.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.Category.ToLower() == category.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.Status.ToLower() == status.Trim().ToLower());
        }

        var announcements = await query
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        return announcements.Select(MapToResponse).ToList();
    }

    public async Task<AnnouncementResponse?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await db.Announcements
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        return entity is null ? null : MapToResponse(entity);
    }

    public async Task<AnnouncementResponse> CreateAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.Title, request.Category, request.Status, request.StartDate, request.EndDate);

        var announcement = new Announcement
        {
            Title = Truncate(request.Title),
            Description = request.Description?.Trim(),
            Category = NormalizeCategory(request.Category),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            FundingAmount = request.FundingAmount,
            PdfPath = TruncateNullable(request.PdfPath),
            ExternalLink = TruncateNullable(request.ExternalLink),
            Status = NormalizeStatus(request.Status),
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Announcements.Add(announcement);
        await db.SaveChangesAsync(cancellationToken);

        return MapToResponse(announcement);
    }

    public async Task<AnnouncementResponse?> UpdateAsync(int id, UpdateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        ValidateRequest(request.Title, request.Category, request.Status, request.StartDate, request.EndDate);

        var announcement = await db.Announcements
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (announcement is null)
        {
            return null;
        }

        announcement.Title = Truncate(request.Title);
        announcement.Description = request.Description?.Trim();
        announcement.Category = NormalizeCategory(request.Category);
        announcement.StartDate = request.StartDate;
        announcement.EndDate = request.EndDate;
        announcement.FundingAmount = request.FundingAmount;
        announcement.PdfPath = TruncateNullable(request.PdfPath);
        announcement.ExternalLink = TruncateNullable(request.ExternalLink);
        announcement.Status = NormalizeStatus(request.Status);
        announcement.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return MapToResponse(announcement);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var announcement = await db.Announcements
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (announcement is null)
        {
            return false;
        }

        db.Announcements.Remove(announcement);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string NormalizeCategory(string category)
    {
        var trimmed = category?.Trim().ToLower();
        return trimmed switch
        {
            "job" => "job",
            "proposal" or "callforproposal" => "proposal",
            "project" or "sanctioned" => "project",
            _ => "job"
        };
    }

    private static string NormalizeStatus(string status)
    {
        var trimmed = status?.Trim().ToLower();
        return trimmed switch
        {
            "active" => "active",
            "inactive" or "expired" => "inactive",
            _ => "active"
        };
    }

    private static void ValidateRequest(string title, string category, string status, DateOnly? startDate, DateOnly? endDate)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(category))
        {
            throw new ArgumentException("Category is required.", nameof(category));
        }

        var normCategory = category.Trim().ToLower();
        if (normCategory is not ("job" or "proposal" or "callforproposal" or "project" or "sanctioned"))
        {
            throw new ArgumentException($"Invalid category '{category}'. Allowed categories are: 'job', 'proposal' (or 'callforproposal'), 'project' (or 'sanctioned').", nameof(category));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normStatus = status.Trim().ToLower();
            if (normStatus is not ("active" or "inactive" or "expired"))
            {
                throw new ArgumentException($"Invalid status '{status}'. Allowed statuses are: 'active', 'inactive' (or 'expired').", nameof(status));
            }
        }

        if (startDate.HasValue && endDate.HasValue && endDate.Value < startDate.Value)
        {
            throw new ArgumentException("End date cannot be prior to start date.", nameof(endDate));
        }
    }

    private static AnnouncementResponse MapToResponse(Announcement a)
    {
        return new AnnouncementResponse(
            a.Id,
            a.Title,
            a.Description,
            a.Category,
            a.StartDate,
            a.EndDate,
            a.FundingAmount,
            a.PdfPath,
            a.ExternalLink,
            a.Status,
            a.CreatedBy,
            a.CreatedAt,
            a.UpdatedAt
        );
    }
    private static string Truncate(string? value, int maxLength = 255)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed.Substring(0, maxLength);
    }

    private static string? TruncateNullable(string? value, int maxLength = 255)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed.Substring(0, maxLength);
    }
}
