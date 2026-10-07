using API.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Procurement;

public class IndentDetailQueryService(IApplicationDbContext db) : IIndentDetailQueryService
{
    public async Task<IndentDetailModel?> GetAsync(Guid indentId, CancellationToken ct = default)
    {
        var indent = await db.Indents
            .Include(i => i.Items)
            .Include(i => i.Allocations)
            .FirstOrDefaultAsync(i => i.Id == indentId, ct);

        if (indent is null)
        {
            return null;
        }

        var headIds = indent.Allocations.Select(a => a.BudgetHeadId).Distinct().ToList();
        var headNames = await db.BudgetHeads
            .Where(b => headIds.Contains(b.Id))
            .Select(b => new { b.Id, b.HeadName, b.CustomLabel })
            .ToListAsync(ct);

        var allocationModels = indent.Allocations
            .OrderBy(a => a.OrderIndex)
            .Select(a =>
            {
                var head = headNames.FirstOrDefault(h => h.Id == a.BudgetHeadId);
                var baseName = head?.CustomLabel ?? head?.HeadName.ToString() ?? "Unknown Head";
                var displayName = a.SubHead is null ? baseName : $"{baseName} — {a.SubHead}";
                return new IndentBudgetAllocationModel(a.BudgetHeadId, displayName, a.SubHead, a.CommittedAmount, a.OrderIndex);
            })
            .ToList();

        return new IndentDetailModel(
            indent.Id,
            indent.IndentNumber,
            indent.ProjectId,
            indent.WorkflowInstanceId,
            indent.IndentType,
            indent.Purpose,
            indent.Items.Sum(i => i.EstimatedCostInclTax),
            allocationModels,
            indent.CreatedAt);
    }
}
