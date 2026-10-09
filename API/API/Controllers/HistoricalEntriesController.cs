using API.Application.Common;
using API.Application.Projects;
using API.Authorization;
using API.Contracts.Projects;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/historical-entries")]
[Authorize]
[PageAccess("projects.historical-entries")]
public class HistoricalEntriesController(
    IHistoricalEntryService historicalEntryService, IApplicationDbContext db)
    : ControllerBase
{
    [HttpGet("projects")]
    public async Task<ActionResult<IReadOnlyList<HistoricalEntryProjectItem>>> ListProjects(CancellationToken ct)
    {
        var items = await db.Projects
            .Where(p => !p.IsDeleted)
            .Join(db.Departments, p => p.DepartmentId, d => d.Id, (p, d) => new { Project = p, Department = d })
            .Join(db.Users, x => x.Project.OwnerUserId, u => u.Id, (x, u) => new HistoricalEntryProjectItem(
                x.Project.Id, x.Project.ProjectTitle, x.Project.SanctionNo,
                x.Department.Id, x.Department.Name, u.Id, u.FullName))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("{projectId:guid}")]
    public async Task<ActionResult<HistoricalEntriesResponse>> ListForProject(Guid projectId, CancellationToken ct)
    {
        var result = await historicalEntryService.ListForProjectAsync(projectId, ct);
        return Ok(new HistoricalEntriesResponse(
            result.Expenditures.Select(e => new HistoricalExpenditureResponse(
                e.Id, projectId, e.BudgetHeadId, e.HeadName, e.Amount, e.Description, e.TransactionDate, e.RecordedByUserId, e.CreatedAt)).ToList(),
            result.GrantReceipts.Select(g => new HistoricalGrantReceiptResponse(
                g.Id, projectId, g.BudgetHeadId, g.HeadName, g.Amount, g.ReceivedDate, g.Remarks, g.RecordedByUserId, g.CreatedAt)).ToList()));
    }

    [HttpPost("{projectId:guid}/expenditure")]
    public async Task<ActionResult<HistoricalExpenditureResponse>> RecordExpenditure(
        Guid projectId, RecordHistoricalExpenditureRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var expenditure = await historicalEntryService.RecordExpenditureAsync(
            projectId, userId.Value, request.BudgetHeadId, request.Amount, request.Description, request.TransactionDate, ct);

        var headName = await db.BudgetHeads.Where(b => b.Id == expenditure.BudgetHeadId).Select(b => b.HeadName.ToString()).FirstOrDefaultAsync(ct) ?? "";
        return Ok(new HistoricalExpenditureResponse(
            expenditure.Id, expenditure.ProjectId, expenditure.BudgetHeadId, headName, expenditure.Amount,
            expenditure.Description, expenditure.TransactionDate, expenditure.RecordedByUserId, expenditure.CreatedAt));
    }

    [HttpDelete("expenditure/{id:guid}")]
    public async Task<IActionResult> DeleteExpenditure(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        try
        {
            await historicalEntryService.DeleteExpenditureAsync(id, userId.Value, ct);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("{projectId:guid}/grant-receipts")]
    public async Task<ActionResult<HistoricalGrantReceiptResponse>> RecordGrantReceipt(
        Guid projectId, RecordHistoricalGrantReceiptRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var receipt = await historicalEntryService.RecordGrantReceiptAsync(
            projectId, userId.Value, request.BudgetHeadId, request.Amount, request.ReceivedDate, request.Remarks, ct);

        var headName = await db.BudgetHeads.Where(b => b.Id == receipt.BudgetHeadId).Select(b => b.HeadName.ToString()).FirstOrDefaultAsync(ct) ?? "";
        return Ok(new HistoricalGrantReceiptResponse(
            receipt.Id, receipt.ProjectId, receipt.BudgetHeadId, headName, receipt.Amount,
            receipt.ReceivedDate, receipt.Remarks, receipt.RecordedByUserId, receipt.CreatedAt));
    }

    [HttpDelete("grant-receipts/{id:guid}")]
    public async Task<IActionResult> DeleteGrantReceipt(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        try
        {
            await historicalEntryService.DeleteGrantReceiptAsync(id, userId.Value, ct);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        return NoContent();
    }
}
