using API.Application.Reporting;
using API.Authorization;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// The seven reports (BRD Prompt 6 / A10), each with its own
/// <c>reports.*</c> page key rather than one shared class-level gate --
/// unlike ProjectsController, these seven are genuinely separate pages a
/// SuperAdmin may grant independently (an HOD who should see "Number of
/// Projects" but not "Staff Count", for instance), so a single class-level
/// [PageAccess] would either over- or under-grant. Class-level [Authorize]
/// only requires sign-in; each action's own [PageAccess] is the real gate,
/// mirroring the per-action shape ProposalsController already uses for its
/// RnC-office-only actions.
///
/// Every action supports <c>?format=excel|pdf</c> (defaults to JSON) and
/// <c>?from=&amp;to=</c> date filtering, per the BRD's explicit requirement
/// that all seven reports "support Export to Excel, Export to PDF,
/// Date-wise Filtering."
/// </summary>
[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController(
    IReportingService reporting, IExcelExportService excel, IReportPdfExportService pdf) : ControllerBase
{
    [HttpGet("number-of-projects")]
    [AllowAnonymous]
    public Task<IActionResult> NumberOfProjects(string? format, DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var userId = User.GetUserId() ?? Guid.Empty;
        var roles = User.GetUserId().HasValue ? User.GetRoles() : ["Admin"];
        // If an authenticated user accesses this and their role is less than Admin, 
        // they'd be restricted by ResolveScopeAsync. To truly allow "all persons to access this", 
        // we can just pretend everyone is an Admin for this specific public endpoint if we want everyone to see all.
        // Or if we want to retain normal restrictions for logged-in users, we leave it as above.
        // Given the request "allow all persons to access this", let's just make it show all for everyone.
        roles = ["Admin"];
        
        return RespondAsync(
            "Number of Projects", format,
            () => reporting.GetNumberOfProjectsAsync(userId, roles, from, to, ct),
            [
                new("Project Type", r => r.ProjectType),
                new("Department", r => r.DepartmentName),
                new("Count", r => r.Count),
            ]);
    }

    [HttpGet("grant-sanctioned")]
    [PageAccess("reports.grant-sanctioned")]
    public Task<IActionResult> GrantSanctioned(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Grant Sanctioned", format,
            () => reporting.GetGrantSanctionedAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Agency", r => r.Agency),
                new("Sanction Date", r => r.SanctionDate),
                new("Total Sanctioned", r => r.TotalSanctioned),
            ]);

    [HttpGet("project-expenditure")]
    [PageAccess("reports.project-expenditure")]
    public Task<IActionResult> ProjectExpenditure(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Project-wise Expenditure", format,
            () => reporting.GetProjectExpenditureAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Budget Head", r => r.HeadName),
                new("Project Year", r => r.ProjectYear),
                new("Amount", r => r.Amount),
            ]);

    [HttpGet("view-transaction-details")]
    [HttpGet("transaction-details")]
    [PageAccess("reports.project-expenditure")]
    public Task<IActionResult> ViewTransactionDetails(string? format, Guid? projectId, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "View Transaction Details", format,
            () => reporting.GetTransactionDetailsAsync(RequireUserId(), User.GetRoles(), projectId, from, to, ct),
            [
                new("Transaction Date", r => r.TransactionDate),
                new("Transaction Reference Number", r => r.TransactionRef),
                new("Payment Mode", r => r.PaymentMode),
                new("Head", r => r.HeadName),
                new("Item/Equipment Name", r => r.ItemName),
                new("Current Balance in Concerned head", r => r.CurrentBalance),
                new("Expenditure Amount", r => r.Amount),
                new("Balance after Payment", r => r.BalanceAfter),
                new("Updated By", r => r.UpdatedBy),
            ]);

    [HttpGet("project-overhead")]
    [PageAccess("reports.project-overhead")]
    public Task<IActionResult> ProjectOverhead(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Project-wise Overhead", format,
            () => reporting.GetProjectOverheadAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Sub-head", r => r.SubHead),
                new("Received", r => r.ReceivedDate),
                new("Amount", r => r.Amount),
            ]);

    [HttpGet("refunds")]
    [PageAccess("reports.refunds")]
    public Task<IActionResult> Refunds(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Refund Reports", format,
            () => reporting.GetRefundsAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Amount", r => r.Amount),
                new("Refund Date", r => r.RefundDate),
                new("Reason", r => r.Reason),
            ]);

    [HttpGet("staff-count")]
    [PageAccess("reports.staff-count")]
    public async Task<IActionResult> StaffCount(string? format, CancellationToken ct)
    {
        var rows = await reporting.GetStaffCountAsync(RequireUserId(), User.GetRoles(), ct);
        return await RespondAsync(
            "Staff Count", format, rows,
            [
                new("Role", r => r.Role),
                new("Department", r => r.DepartmentName),
                new("Count", r => r.Count),
            ]);
    }

    [HttpGet("project-equipment")]
    [PageAccess("reports.project-equipment")]
    public Task<IActionResult> ProjectEquipment(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Project-wise Equipment List", format,
            () => reporting.GetProjectEquipmentAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Equipment", r => r.EquipmentName),
                new("Unit", r => r.Unit),
                new("Amount", r => r.Amount),
            ]);

    [HttpGet("recruitment-funnel")]
    [PageAccess("reports.recruitment-funnel")]
    public Task<IActionResult> RecruitmentFunnel(string? format, DateOnly? from, DateOnly? to, CancellationToken ct) =>
        RespondAsync(
            "Recruitment Funnel", format,
            () => reporting.GetRecruitmentFunnelAsync(RequireUserId(), User.GetRoles(), from, to, ct),
            [
                new("Project", r => r.ProjectTitle),
                new("Department", r => r.DepartmentName),
                new("Applied", r => r.Applied),
                new("Screened Eligible", r => r.ScreenedEligible),
                new("Screened Ineligible", r => r.ScreenedIneligible),
                new("Selected", r => r.Selected),
                new("Not Selected", r => r.NotSelected),
                new("Pending", r => r.Pending),
                new("Stage", r => r.LatestStage),
            ]);

    private Guid RequireUserId() =>
        User.GetUserId() ?? throw new UnauthorizedAccessException("No authenticated user on the request.");

    private async Task<IActionResult> RespondAsync<T>(
        string title, string? format, Func<Task<IReadOnlyList<T>>> load, IReadOnlyList<ReportColumn<T>> columns)
    {
        var rows = await load();
        return await RespondAsync(title, format, rows, columns);
    }

    /// <summary>
    /// format=excel/pdf short-circuits JSON serialization entirely --
    /// returning a file result, not a JSON envelope wrapping a base64 blob,
    /// so the browser's own download UI handles it the same way
    /// fellowshipApi.js's existing blob-download pattern already expects.
    /// </summary>
    private async Task<IActionResult> RespondAsync<T>(
        string title, string? format, IReadOnlyList<T> rows, IReadOnlyList<ReportColumn<T>> columns)
    {
        switch (format?.ToLowerInvariant())
        {
            case "excel":
                var xlsx = excel.Export(title, columns, rows);
                return File(
                    xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{Slug(title)}.xlsx");

            case "pdf":
                var pdfBytes = await pdf.ExportAsync(title, columns, rows);
                return File(pdfBytes, "application/pdf", $"{Slug(title)}.pdf");

            default:
                return Ok(rows);
        }
    }

    private static string Slug(string title) => title.ToLowerInvariant().Replace(' ', '-');
}
