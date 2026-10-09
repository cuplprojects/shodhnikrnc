using API.Application.Common;
using API.Authorization;
using API.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

public class NotingItemResponseDto
{
    public Guid Id { get; set; }
    public Guid NotingId { get; set; }
    public int SlNo { get; set; }
    public string NameOfItem { get; set; } = string.Empty;
    public string IndentNoAndDate { get; set; } = string.Empty;
    public string BudgetHeadAndBalance { get; set; } = string.Empty;
    public string IndentAmount { get; set; } = string.Empty;
    public string ModeOfPurchase { get; set; } = string.Empty;
    public Guid? FellowshipClaimId { get; set; }
}

public class NotingResponseDto
{
    public Guid Id { get; set; }
    public string FundedAgency { get; set; } = string.Empty;
    public string ProjectTitle { get; set; } = string.Empty;
    public string ProjectNo { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public string CurrentStage { get; set; } = "Pending Document Upload";
    public string? SignedFilesJson { get; set; }
    public string? NewNotingFormatTextChanges { get; set; }
    public string? NotingFormatTextChanges { get; set; }
    public string? NotingFormateTextChanges { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public List<NotingItemResponseDto> Items { get; set; } = new();
}

public class CreateNotingItemDto
{
    public int SlNo { get; set; }
    public string NameOfItem { get; set; } = string.Empty;
    public string IndentNoAndDate { get; set; } = string.Empty;
    public string BudgetHeadAndBalance { get; set; } = string.Empty;
    public string IndentAmount { get; set; } = string.Empty;
    public string ModeOfPurchase { get; set; } = string.Empty;
    public Guid? FellowshipClaimId { get; set; }
}

public class CreateNotingDto
{
    public string FundedAgency { get; set; } = string.Empty;
    public string ProjectTitle { get; set; } = string.Empty;
    public string ProjectNo { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public string? CurrentStage { get; set; }
    public string? SignedFilesJson { get; set; }
    public string? NewNotingFormatTextChanges { get; set; }
    public string? NotingFormatTextChanges { get; set; }
    public string? NotingFormateTextChanges { get; set; }
    public List<CreateNotingItemDto> Items { get; set; } = new();
}

public class UpdateNotingStatusDto
{
    public required string Status { get; set; }
    public string? CurrentStage { get; set; }
    public string? SignedFilesJson { get; set; }
}

[ApiController]
[Route("api/notings")]
[Authorize]
// Noting access is configured, not compiled in: a SuperAdmin granting this
// page to another role takes effect without a redeploy. Matches the existing
// "noting.page" entry in PageCatalogue.cs (Faculty/HOD/Office, Own scope).
[PageAccess("noting.page")]
public class NotingsController(IApplicationDbContext db) : ControllerBase
{
    private static bool _tablesChecked = false;
    private async Task EnsureTablesUpdatedAsync(CancellationToken ct)
    {
        if (_tablesChecked) return;
        try
        {
            if (db is DbContext dbContext)
            {
                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `notings` ADD COLUMN `CurrentStage` varchar(150) NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `notings` ADD COLUMN `SignedFilesJson` longtext NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"UPDATE `notings` SET `CurrentStage` = 'Pending Document Upload' WHERE `CurrentStage` IS NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `Notings` ADD COLUMN `CurrentStage` varchar(150) NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `Notings` ADD COLUMN `SignedFilesJson` longtext NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"UPDATE `Notings` SET `CurrentStage` = 'Pending Document Upload' WHERE `CurrentStage` IS NULL;", ct);
                }
                catch { }
            }
            _tablesChecked = true;
        }
        catch { }
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        await EnsureTablesUpdatedAsync(ct);
        var query = db.Notings
            .Include(n => n.Items)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(n => n.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            query = query.Where(n =>
                (n.ProjectNo != null && n.ProjectNo.ToLower().Contains(searchLower)) ||
                (n.ProjectTitle != null && n.ProjectTitle.ToLower().Contains(searchLower)) ||
                (n.FundedAgency != null && n.FundedAgency.ToLower().Contains(searchLower))
            );
        }

        var totalCount = await query.CountAsync(ct);
        var orderedQuery = query.OrderByDescending(n => n.CreatedAt);

        List<Noting> entities;
        if (pageSize <= 0)
        {
            entities = await orderedQuery.ToListAsync(ct);
        }
        else
        {
            entities = await orderedQuery
                .Skip((Math.Max(1, pageNumber) - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);
        }

        var response = entities.Select(MapToResponse).ToList();
        var effectivePageSize = pageSize > 0 ? pageSize : (totalCount > 0 ? totalCount : 1);
        var totalPages = (int)Math.Ceiling(totalCount / (double)effectivePageSize);

        return Ok(new
        {
            items = response,
            totalCount = totalCount,
            pageNumber = Math.Max(1, pageNumber),
            pageSize = effectivePageSize,
            totalPages = totalPages > 0 ? totalPages : 1
        });
    }


    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NotingResponseDto>> GetById(Guid id, CancellationToken ct)
    {
        await EnsureTablesUpdatedAsync(ct);
        var entity = await db.Notings
            .Include(n => n.Items)
            .FirstOrDefaultAsync(n => n.Id == id, ct);

        if (entity is null)
        {
            return NotFound(new { detail = $"Noting '{id}' not found." });
        }

        return Ok(MapToResponse(entity));
    }



    [HttpPost]
    public async Task<ActionResult<NotingResponseDto>> Create(
        [FromBody] CreateNotingDto dto, CancellationToken ct)
    {
        await EnsureTablesUpdatedAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly notingDate = today;
        if (!string.IsNullOrWhiteSpace(dto.Date) && DateOnly.TryParse(dto.Date, out var parsedDate))
        {
            notingDate = parsedDate;
        }

        var textVal = dto.NewNotingFormatTextChanges
                      ?? dto.NotingFormatTextChanges
                      ?? dto.NotingFormateTextChanges;

        var entity = new Noting
        {
            Id = Guid.NewGuid(),
            FundedAgency = dto.FundedAgency ?? string.Empty,
            ProjectTitle = dto.ProjectTitle ?? string.Empty,
            ProjectNo = dto.ProjectNo ?? string.Empty,
            Date = notingDate,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending Approval" : dto.Status,
            CurrentStage = string.IsNullOrWhiteSpace(dto.CurrentStage) ? "Pending Document Upload" : dto.CurrentStage,
            SignedFilesJson = dto.SignedFilesJson,
            NotingFormatTextChanges = textVal,
            NewNotingFormatTextChanges = textVal,
            CreatedAt = DateTimeOffset.UtcNow
        };

        int sl = 1;
        foreach (var itemDto in dto.Items)
        {
            entity.Items.Add(new NotingItem
            {
                Id = Guid.NewGuid(),
                NotingId = entity.Id,
                SlNo = itemDto.SlNo > 0 ? itemDto.SlNo : sl++,
                NameOfItem = itemDto.NameOfItem,
                IndentNoAndDate = itemDto.IndentNoAndDate,
                BudgetHeadAndBalance = itemDto.BudgetHeadAndBalance,
                IndentAmount = itemDto.IndentAmount,
                ModeOfPurchase = itemDto.ModeOfPurchase,
                FellowshipClaimId = itemDto.FellowshipClaimId
            });
        }

        db.Notings.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = MapToResponse(entity);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<NotingResponseDto>> Update(
        Guid id, [FromBody] CreateNotingDto dto, CancellationToken ct)
    {
        await EnsureTablesUpdatedAsync(ct);
        var entity = await db.Notings
            .FirstOrDefaultAsync(n => n.Id == id, ct);

        if (entity is null)
        {
            return NotFound(new { detail = $"Noting '{id}' not found." });
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly notingDate = today;
        if (!string.IsNullOrWhiteSpace(dto.Date) && DateOnly.TryParse(dto.Date, out var parsedDate))
        {
            notingDate = parsedDate;
        }

        var textVal = dto.NewNotingFormatTextChanges
                      ?? dto.NotingFormatTextChanges
                      ?? dto.NotingFormateTextChanges;

        entity.FundedAgency = dto.FundedAgency ?? string.Empty;
        entity.ProjectTitle = dto.ProjectTitle ?? string.Empty;
        entity.ProjectNo = dto.ProjectNo ?? string.Empty;
        entity.Date = notingDate;
        entity.Status = string.IsNullOrWhiteSpace(dto.Status) ? entity.Status : dto.Status;
        entity.NotingFormatTextChanges = textVal;
        entity.NewNotingFormatTextChanges = textVal;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        var oldItems = await db.NotingItems.Where(i => i.NotingId == id).ToListAsync(ct);
        if (oldItems.Any())
        {
            db.NotingItems.RemoveRange(oldItems);
        }

        int sl = 1;
        var newItems = new List<NotingItem>();
        foreach (var itemDto in dto.Items)
        {
            newItems.Add(new NotingItem
            {
                Id = Guid.NewGuid(),
                NotingId = entity.Id,
                SlNo = itemDto.SlNo > 0 ? itemDto.SlNo : sl++,
                NameOfItem = itemDto.NameOfItem ?? string.Empty,
                IndentNoAndDate = itemDto.IndentNoAndDate ?? string.Empty,
                BudgetHeadAndBalance = itemDto.BudgetHeadAndBalance ?? string.Empty,
                IndentAmount = itemDto.IndentAmount ?? string.Empty,
                ModeOfPurchase = itemDto.ModeOfPurchase ?? string.Empty,
                FellowshipClaimId = itemDto.FellowshipClaimId
            });
        }
        await db.NotingItems.AddRangeAsync(newItems, ct);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            var freshEntity = await db.Notings.FirstOrDefaultAsync(n => n.Id == id, ct);
            if (freshEntity != null)
            {
                freshEntity.FundedAgency = dto.FundedAgency ?? string.Empty;
                freshEntity.ProjectTitle = dto.ProjectTitle ?? string.Empty;
                freshEntity.ProjectNo = dto.ProjectNo ?? string.Empty;
                freshEntity.Date = notingDate;
                freshEntity.Status = string.IsNullOrWhiteSpace(dto.Status) ? freshEntity.Status : dto.Status;
                freshEntity.NotingFormatTextChanges = textVal;
                freshEntity.UpdatedAt = DateTimeOffset.UtcNow;

                var existingItems = await db.NotingItems.Where(i => i.NotingId == id).ToListAsync(ct);
                if (existingItems.Any())
                {
                    db.NotingItems.RemoveRange(existingItems);
                }

                int sl2 = 1;
                foreach (var itemDto in dto.Items)
                {
                    db.NotingItems.Add(new NotingItem
                    {
                        Id = Guid.NewGuid(),
                        NotingId = freshEntity.Id,
                        SlNo = itemDto.SlNo > 0 ? itemDto.SlNo : sl2++,
                        NameOfItem = itemDto.NameOfItem ?? string.Empty,
                        IndentNoAndDate = itemDto.IndentNoAndDate ?? string.Empty,
                        BudgetHeadAndBalance = itemDto.BudgetHeadAndBalance ?? string.Empty,
                        IndentAmount = itemDto.IndentAmount ?? string.Empty,
                        ModeOfPurchase = itemDto.ModeOfPurchase ?? string.Empty,
                        FellowshipClaimId = itemDto.FellowshipClaimId
                    });
                }

                await db.SaveChangesAsync(ct);

                var savedItems = await db.NotingItems.Where(i => i.NotingId == id).ToListAsync(ct);
                freshEntity.Items = savedItems;
                return Ok(MapToResponse(freshEntity));
            }
        }

        var resultItems = await db.NotingItems.Where(i => i.NotingId == id).ToListAsync(ct);
        entity.Items = resultItems;
        return Ok(MapToResponse(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await EnsureTablesUpdatedAsync(ct);
        var entity = await db.Notings.FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null)
        {
            return NotFound(new { detail = $"Noting '{id}' not found." });
        }

        db.Notings.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<NotingResponseDto>> UpdateStatus(
        Guid id, [FromBody] UpdateNotingStatusDto dto, CancellationToken ct)
    {
        await EnsureTablesUpdatedAsync(ct);
        var entity = await db.Notings
            .Include(n => n.Items)
            .FirstOrDefaultAsync(n => n.Id == id, ct);

        if (entity is null)
        {
            return NotFound(new { detail = $"Noting '{id}' not found." });
        }

        entity.Status = dto.Status;
        if (dto.CurrentStage != null) entity.CurrentStage = dto.CurrentStage;
        if (dto.SignedFilesJson != null) entity.SignedFilesJson = dto.SignedFilesJson;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(MapToResponse(entity));
    }

    private static NotingResponseDto MapToResponse(Noting entity)
    {
        return new NotingResponseDto
        {
            Id = entity.Id,
            FundedAgency = entity.FundedAgency,
            ProjectTitle = entity.ProjectTitle,
            ProjectNo = entity.ProjectNo,
            Date = entity.Date.ToString("yyyy-MM-dd"),
            Status = string.IsNullOrWhiteSpace(entity.Status) ? "Pending Approval" : entity.Status,
            CurrentStage = entity.CurrentStage ?? (string.IsNullOrWhiteSpace(entity.SignedFilesJson) ? "Pending Document Upload" : "Document Uploaded"),
            SignedFilesJson = entity.SignedFilesJson,
            NewNotingFormatTextChanges = entity.NewNotingFormatTextChanges ?? entity.NotingFormatTextChanges,
            NotingFormatTextChanges = entity.NotingFormatTextChanges ?? entity.NewNotingFormatTextChanges,
            NotingFormateTextChanges = entity.NotingFormatTextChanges ?? entity.NewNotingFormatTextChanges,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Items = entity.Items
                .OrderBy(i => i.SlNo)
                .Select(i => new NotingItemResponseDto
                {
                    Id = i.Id,
                    NotingId = i.NotingId,
                    SlNo = i.SlNo,
                    NameOfItem = i.NameOfItem,
                    IndentNoAndDate = i.IndentNoAndDate,
                    BudgetHeadAndBalance = i.BudgetHeadAndBalance,
                    IndentAmount = i.IndentAmount,
                    ModeOfPurchase = i.ModeOfPurchase,
                    FellowshipClaimId = i.FellowshipClaimId
                }).ToList()
        };
    }
}
