using API.Application.Audit;
using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class HistoricalEntryService(
    IApplicationDbContext db, IProjectYearCalculator yearCalculator, IAuditService audit)
    : IHistoricalEntryService
{
    public async Task<HistoricalExpenditure> RecordExpenditureAsync(
        Guid projectId, Guid recordedByUserId, Guid budgetHeadId,
        decimal amount, string description, DateOnly transactionDate,
        CancellationToken ct = default)
    {
        var project = await LoadProjectWithBudgetHeadsAsync(projectId, ct);
        var head = RequireBudgetHead(project, budgetHeadId);

        // GetProjectYear throws ArgumentException itself when transactionDate
        // is before project.StartDate -- called here, at write time, purely
        // to validate the date, so a bad date fails the record call instead
        // of surfacing later as an exception from BudgetSummaryService when
        // it tries to resolve this row's year on read.
        yearCalculator.GetProjectYear(project.StartDate, transactionDate);

        var expenditure = new HistoricalExpenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = head.Id,
            Amount = amount,
            Description = description,
            TransactionDate = transactionDate,
            RecordedByUserId = recordedByUserId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.HistoricalExpenditures.Add(expenditure);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            nameof(Project), projectId, "HistoricalExpenditureRecorded", recordedByUserId,
            $"BudgetHeadId={head.Id};Amount={amount}", ct);
        return expenditure;
    }

    public async Task DeleteExpenditureAsync(Guid id, Guid deletedByUserId, CancellationToken ct = default)
    {
        var row = await db.HistoricalExpenditures.FirstOrDefaultAsync(h => h.Id == id, ct)
            ?? throw new KeyNotFoundException($"HistoricalExpenditure {id} not found.");

        await audit.LogAsync(
            nameof(Project), row.ProjectId, "HistoricalExpenditureDeleted", deletedByUserId,
            $"BudgetHeadId={row.BudgetHeadId};Amount={row.Amount};TransactionDate={row.TransactionDate}", ct);

        db.HistoricalExpenditures.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    public async Task<HistoricalGrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid recordedByUserId, Guid budgetHeadId,
        decimal amount, DateOnly receivedDate, string? remarks,
        CancellationToken ct = default)
    {
        var project = await LoadProjectWithBudgetHeadsAsync(projectId, ct);
        var head = RequireBudgetHead(project, budgetHeadId);

        var resolvedYear = yearCalculator.GetProjectYear(project.StartDate, receivedDate);
        var overallSanctioned = head.Total > 0
            ? head.Total
            : (head.Year1Amount + head.Year2Amount + head.Year3Amount + head.Year4Amount + head.Year5Amount);

        var alreadyReceivedLive = await db.GrantReceipts
            .Where(g => g.ProjectId == projectId && g.BudgetHeadId == budgetHeadId)
            .Where(g => g.Type == GrantReceiptType.Head && g.Status == GrantReceiptStatus.Approved)
            .ToListAsync(ct);
        var liveOverall = alreadyReceivedLive.Sum(g => g.Amount);

        var alreadyHistorical = await db.HistoricalGrantReceipts
            .Where(h => h.ProjectId == projectId && h.BudgetHeadId == budgetHeadId)
            .ToListAsync(ct);
        var historicalOverall = alreadyHistorical.Sum(h => h.Amount);

        if (liveOverall + historicalOverall + amount > overallSanctioned)
        {
            throw new GrantReceiptExceedsSanctionException(
                liveOverall + historicalOverall + amount, overallSanctioned, resolvedYear);
        }

        var receipt = new HistoricalGrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = head.Id,
            Amount = amount,
            ReceivedDate = receivedDate,
            Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim(),
            RecordedByUserId = recordedByUserId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.HistoricalGrantReceipts.Add(receipt);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            nameof(Project), projectId, "HistoricalGrantReceiptRecorded", recordedByUserId,
            $"BudgetHeadId={head.Id};Amount={amount}", ct);
        return receipt;
    }

    public async Task DeleteGrantReceiptAsync(Guid id, Guid deletedByUserId, CancellationToken ct = default)
    {
        var row = await db.HistoricalGrantReceipts.FirstOrDefaultAsync(h => h.Id == id, ct)
            ?? throw new KeyNotFoundException($"HistoricalGrantReceipt {id} not found.");

        await audit.LogAsync(
            nameof(Project), row.ProjectId, "HistoricalGrantReceiptDeleted", deletedByUserId,
            $"BudgetHeadId={row.BudgetHeadId};Amount={row.Amount};ReceivedDate={row.ReceivedDate}", ct);

        db.HistoricalGrantReceipts.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    public async Task<HistoricalEntriesResult> ListForProjectAsync(Guid projectId, CancellationToken ct = default)
    {
        var headNames = await db.BudgetHeads
            .Where(b => b.ProjectId == projectId)
            .ToDictionaryAsync(
                b => b.Id,
                b => string.IsNullOrWhiteSpace(b.CustomLabel) ? b.HeadName.ToString() : b.CustomLabel,
                ct);

        var expenditures = await db.HistoricalExpenditures
            .Where(h => h.ProjectId == projectId)
            .OrderByDescending(h => h.TransactionDate)
            .Select(h => new HistoricalExpenditureItem(
                h.Id, h.BudgetHeadId, headNames.GetValueOrDefault(h.BudgetHeadId, "Unknown"),
                h.Amount, h.Description, h.TransactionDate, h.RecordedByUserId, h.CreatedAt))
            .ToListAsync(ct);

        var receipts = await db.HistoricalGrantReceipts
            .Where(h => h.ProjectId == projectId)
            .OrderByDescending(h => h.ReceivedDate)
            .Select(h => new HistoricalGrantReceiptItem(
                h.Id, h.BudgetHeadId, headNames.GetValueOrDefault(h.BudgetHeadId, "Unknown"),
                h.Amount, h.ReceivedDate, h.Remarks, h.RecordedByUserId, h.CreatedAt))
            .ToListAsync(ct);

        return new HistoricalEntriesResult(expenditures, receipts);
    }

    private async Task<Project> LoadProjectWithBudgetHeadsAsync(Guid projectId, CancellationToken ct)
    {
        var project = await db.Projects
            .Include(p => p.BudgetHeads)
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct);
        return project ?? throw new ProjectNotFoundException(projectId);
    }

    private static BudgetHead RequireBudgetHead(Project project, Guid budgetHeadId)
    {
        return project.BudgetHeads.FirstOrDefault(b => b.Id == budgetHeadId)
            ?? throw new ArgumentException(
                $"Budget head '{budgetHeadId}' does not belong to project '{project.Id}'.", nameof(budgetHeadId));
    }
}
