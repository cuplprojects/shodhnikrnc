using API.Application.Common;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using API.Infrastructure.DocumentGeneration;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Controllers;

public record CreateNocRequestDto(string EnrollmentNumber, Guid DepartmentId, string Purpose, string TargetOrganization, string? CertificateBody);
public record NocActionDto(string Action, string? Remarks);

[ApiController]
[Route("api/noc-requests")]
[Authorize]
public class NocRequestsController(IApplicationDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Guid>> Create([FromBody] CreateNocRequestDto dto, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var dept = await db.Departments.FirstOrDefaultAsync(d => d.Id == dto.DepartmentId, ct);
        var deptName = dept?.Name ?? "Department";

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        var studentName = user?.FullName ?? user?.UserName ?? "PhD Scholar";

        var request = new NocRequest
        {
            Id = Guid.NewGuid(),
            StudentUserId = userId.Value,
            StudentName = studentName,
            EnrollmentNumber = dto.EnrollmentNumber,
            DepartmentId = dto.DepartmentId,
            DepartmentName = deptName,
            Purpose = dto.Purpose,
            TargetOrganization = dto.TargetOrganization,
            CertificateBody = dto.CertificateBody ?? string.Empty,
            Status = "Pending PI Approval",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.NocRequests.Add(request);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = request.Id }, request.Id);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NocRequest>>> GetAll(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        IQueryable<NocRequest> query = db.NocRequests.AsNoTracking();

        if (User.IsInRole("Student") || User.IsInRole("Fellow"))
        {
            query = query.Where(r => r.StudentUserId == userId.Value);
        }

        var list = await query.OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NocRequest>> GetById(Guid id, CancellationToken ct)
    {
        var item = await db.NocRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item is null) return NotFound();
        return Ok(item);
    }

    [HttpPost("{id:guid}/action")]
    public async Task<IActionResult> ProcessAction(Guid id, [FromBody] NocActionDto dto, CancellationToken ct)
    {
        var item = await db.NocRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item is null) return NotFound();

        var isApprove = dto.Action.Equals("Approve", StringComparison.OrdinalIgnoreCase);

        if (!isApprove)
        {
            item.Status = "Rejected";
            await db.SaveChangesAsync(ct);
            return Ok(item);
        }

        if (item.Status == "Pending PI Approval")
        {
            item.Status = "Pending HOD Approval";
        }
        else if (item.Status == "Pending HOD Approval")
        {
            item.Status = "Pending DA Action";
        }
        else if (item.Status == "Pending DA Action")
        {
            item.Status = "Pending Superintendent Action";
        }
        else if (item.Status == "Pending Superintendent Action")
        {
            item.Status = "Pending DR Action";
        }
        else if (item.Status == "Pending DR Action")
        {
            item.Status = "Pending Dean Approval";
        }
        else if (item.Status == "Pending Dean Approval")
        {
            item.Status = "Approved";
            item.ApprovedAt = DateTimeOffset.UtcNow;
            item.CertificateNumber = $"MNNIT/RNC/NOC/{DateTime.UtcNow.Year}/{Random.Shared.Next(1000, 9999)}";
        }
        else if (item.Status == "Pending")
        {
            item.Status = "Approved";
            item.ApprovedAt = DateTimeOffset.UtcNow;
            item.CertificateNumber = $"MNNIT/RNC/NOC/{DateTime.UtcNow.Year}/{Random.Shared.Next(1000, 9999)}";
        }

        await db.SaveChangesAsync(ct);
        return Ok(item);
    }

    [HttpGet("{id:guid}/certificate")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCertificateHtml(Guid id, CancellationToken ct)
    {
        var item = await db.NocRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item is null) return NotFound();

        var certNo = item.CertificateNumber ?? $"MNNIT/RNC/NOC/{DateTime.UtcNow.Year}/001";
        var dateStr = item.ApprovedAt?.ToString("dd MMMM yyyy") ?? DateTime.UtcNow.ToString("dd MMMM yyyy");

        var logo = EmbeddedAssets.MnnitLogoDataUri;
        var innerHtml = $@"
<div class='content'>
    <table class=""header-table"" style=""width:100%; border:none; margin-bottom: 20px;"">
        <tr>
            <td class=""logo-cell"" style=""width:95px; border:none; vertical-align:middle; padding:0;""><img src=""{logo}"" style=""width:75px; height:auto;""></td>
            <td class=""institute-cell"" style=""border:none;"">
                <div style=""font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;"">Department of {item.DepartmentName}</div>
                <div style=""font-family:'Times New Roman', Times, serif;font-weight:bold;text-align:center;font-size:14pt;"">Motilal Nehru National Institute of Technology Allahabad, Prayagraj-211004 (India)</div>
            </td>
        </tr>
    </table>
    
    <div class='ref-no' style=""font-weight: bold; margin-bottom: 20px;"">Ref No: {certNo} <span style='float:right;'>Date: {dateStr}</span></div>

    <div class='title' style=""text-align: center; font-size: 20px; font-weight: bold; margin: 30px 0; text-decoration: underline; letter-spacing: 1px;"">NO OBJECTION CERTIFICATE</div>

    <div class='content' style=""font-size: 16px; text-align: justify; margin-bottom: 40px;"">
        {(!string.IsNullOrWhiteSpace(item.CertificateBody) ? item.CertificateBody : $@"
        <p>This is to certify that <strong>{item.StudentName}</strong> (Enrollment No: <strong>{item.EnrollmentNumber}</strong>) is a registered PhD scholar in the Department of <strong>{item.DepartmentName}</strong> at MNNIT Allahabad.</p>
        
        <p>The Institute has <strong>NO OBJECTION</strong> to the scholar participating in / applying for <strong>{item.Purpose}</strong> at <strong>{item.TargetOrganization}</strong>.</p>
        
        <p>This certificate is issued upon the recommendation of the Supervisor, Head of Department, and with the approval of the Dean (Research & Consultancy).</p>
        ")}
    </div>

    <table style='width:100%; margin-top: 80px; border:none;'>
        <tr>
            <td style='text-align:left; border:none;'>
                <br/><br/>
                _____________________<br/>
                <strong>Head of Department</strong><br/>
                Dept. of {item.DepartmentName}
            </td>
            <td style='text-align:right; border:none;'>
                <br/><br/>
                _____________________<br/>
                <strong>Dean (Research & Consultancy)</strong><br/>
                MNNIT Allahabad
            </td>
        </tr>
    </table>
</div>";

        var html = IndentHtmlShell.Wrap(innerHtml);
        return Content(html, "text/html");
    }
}
