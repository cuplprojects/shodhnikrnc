using API.Application.Common;
using API.Authorization;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

public record CreateIdCardRequestDto(
    string? RollNumber = null,
    string Designation = "JRF",
    Guid? ProjectId = null,
    string? ProjectNumber = null,
    Guid DepartmentId = default,
    string? Remarks = null,
    string? IdentityCode = null,
    string? LocalAddress = null,
    string? EmergencyPhone = null,
    string? MobilePhone = null,
    string? Email = null,
    string? PermanentAddress = null,
    string? PermanentDistrict = null,
    string? PermanentPin = null,
    string? Category = null,
    string? AdditionalCategory = null,
    string? PiName = null,
    string? BloodGroup = null,
    string? DateOfBirth = null,
    string? DateOfJoining = null,
    string? PeriodFrom = null,
    string? PeriodTo = null,
    string? Gender = null,
    string? AadharNumber = null,
    string? AppointmentLetterNo = null,
    string? PhotoUrl = null,
    string? SignatureUrl = null,
    string? DocumentName = null
);

public record UpdateIdCardRequestDto(
    string Designation = "JRF",
    Guid? ProjectId = null,
    string? ProjectNumber = null,
    Guid DepartmentId = default,
    string? Remarks = null,
    string? LocalAddress = null,
    string? EmergencyPhone = null,
    string? MobilePhone = null,
    string? Email = null,
    string? PermanentAddress = null,
    string? PermanentDistrict = null,
    string? PermanentPin = null,
    string? Category = null,
    string? AdditionalCategory = null,
    string? PiName = null,
    string? BloodGroup = null,
    string? DateOfBirth = null,
    string? DateOfJoining = null,
    string? PeriodFrom = null,
    string? PeriodTo = null,
    string? Gender = null,
    string? AadharNumber = null,
    string? AppointmentLetterNo = null,
    string? PhotoUrl = null,
    string? SignatureUrl = null,
    string? DocumentName = null
);

public record IdCardActionDto(
    string Action,
    string? Remarks,
    string? CustomIdCardNumber,
    string? RejectionReason
);

[ApiController]
[Route("api/id-card-requests")]
[Authorize]
[PageAccess("id-card.requests")]
public class IdCardRequestsController(
    IApplicationDbContext db, UserManager<ApplicationUser> userManager,
    API.Application.Access.IInstituteWideScopeResolver instituteWideScope) : ControllerBase
{
    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextCode(CancellationToken ct)
    {
        var nextCode = await GetNextIdentityCodeAsync(db, ct);
        return Ok(new { nextCode });
    }

    [HttpGet("candidate-profile")]
    public async Task<ActionResult<object>> GetCandidateProfile(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await userManager.FindByIdAsync(userId.Value.ToString());

        var selection = await db.ManpowerSelections
            .Include(s => s.Candidate)
            .FirstOrDefaultAsync(s => s.ApplicationUserId == userId.Value || (s.Candidate != null && s.Candidate.ApplicationUserId == userId.Value), ct);

        var candidate = selection?.Candidate ?? await db.Candidates
            .OrderByDescending(c => c.AppliedAt)
            .FirstOrDefaultAsync(c => c.ApplicationUserId == userId.Value, ct);

        string? projectNumber = null;
        string? piName = null;
        Guid? departmentId = null;
        string? departmentName = null;
        string? designation = null;

        if (selection != null)
        {
            var pos = await db.SanctionedManpowerPositions
                .FirstOrDefaultAsync(p => p.Id == selection.SanctionedManpowerPositionId, ct);
            if (pos != null)
            {
                designation = pos.Designation;
                var proj = await db.Projects
                    .FirstOrDefaultAsync(p => p.Id == pos.ProjectId, ct);
                if (proj != null)
                {
                    projectNumber = proj.SanctionNo;
                    departmentId = proj.DepartmentId;
                    var dept = await db.Departments.FirstOrDefaultAsync(d => d.Id == proj.DepartmentId, ct);
                    departmentName = dept?.Name;

                    var piUser = await db.Users.FirstOrDefaultAsync(u => u.Id == proj.OwnerUserId, ct);
                    piName = piUser?.FullName ?? piUser?.UserName;
                }
            }
        }

        string? photoUrl = null;
        string? signatureUrl = null;

        if (candidate != null)
        {
            if (candidate.PhotoDocumentId.HasValue)
            {
                var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == candidate.PhotoDocumentId.Value, ct);
                if (doc != null && !string.IsNullOrEmpty(doc.StoragePath))
                {
                    photoUrl = $"/api/documents/{doc.Id}";
                }
            }
            if (candidate.SignatureDocumentId.HasValue)
            {
                var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == candidate.SignatureDocumentId.Value, ct);
                if (doc != null && !string.IsNullOrEmpty(doc.StoragePath))
                {
                    signatureUrl = $"/api/documents/{doc.Id}";
                }
            }
        }

        var studentName = candidate?.FullName ?? user?.FullName ?? user?.UserName ?? "";
        var mobilePhone = candidate?.Mobile ?? user?.PhoneNumber ?? "";
        var email = candidate?.Email ?? user?.Email ?? "";

        var dob = selection?.Dob?.ToString("yyyy-MM-dd") ?? candidate?.DateOfBirth?.ToString("yyyy-MM-dd") ?? "";
        var dateOfJoining = selection?.JoinedOn.ToString("yyyy-MM-dd") ?? "";
        var periodFrom = selection?.JoinedOn.ToString("yyyy-MM-dd") ?? "";
        var periodTo = selection?.ValidTill.ToString("yyyy-MM-dd") ?? "";

        var sexRaw = selection?.Gender?.ToString() ?? candidate?.Gender?.ToString() ?? "";
        var sex = "Male";
        if (sexRaw.StartsWith("F", StringComparison.OrdinalIgnoreCase)) sex = "Female";
        else if (sexRaw.StartsWith("M", StringComparison.OrdinalIgnoreCase)) sex = "Male";

        var catRaw = candidate?.Category?.ToString() ?? "";
        var addCategory = "GEN";
        if (catRaw.Contains("OBC", StringComparison.OrdinalIgnoreCase)) addCategory = "OBC";
        else if (catRaw.Contains("SC", StringComparison.OrdinalIgnoreCase)) addCategory = "SC";
        else if (catRaw.Contains("ST", StringComparison.OrdinalIgnoreCase)) addCategory = "ST";

        var aadharNo = selection?.AadharNo ?? candidate?.IdProofNumber ?? "";

        return Ok(new
        {
            studentName,
            mobilePhone,
            emergencyPhone = mobilePhone,
            email,
            localAddress = candidate?.PresentAddress ?? "",
            permAddress = candidate?.PermanentAddress ?? "",
            permDistrict = "",
            permPin = "",
            category = "Research Fellow",
            addCategory,
            designation = designation ?? "JRF",
            projectNumber = projectNumber ?? "",
            departmentId,
            departmentName,
            piName = piName ?? "",
            dob,
            dateOfJoining,
            periodFrom,
            periodTo,
            sex,
            aadharNo,
            appointmentLetterNo = "",
            photoUrl,
            signatureUrl
        });
    }

    public static async Task<string> GetNextIdentityCodeAsync(IApplicationDbContext db, CancellationToken ct)
    {
        var yearPrefix = $"{DateTime.UtcNow.Year}PO";
        var requests = await db.IdCardRequests
            .AsNoTracking()
            .Where(r => (r.RollNumber != null && r.RollNumber.StartsWith(yearPrefix)) ||
                        (r.IdentityCode != null && r.IdentityCode.StartsWith(yearPrefix)))
            .Select(r => new { r.RollNumber, r.IdentityCode })
            .ToListAsync(ct);

        int maxSeq = 0;
        foreach (var req in requests)
        {
            var codes = new[] { req.RollNumber, req.IdentityCode };
            foreach (var c in codes)
            {
                if (!string.IsNullOrEmpty(c) && c.StartsWith(yearPrefix))
                {
                    var numPart = c.Substring(yearPrefix.Length);
                    if (int.TryParse(numPart, out var seq))
                    {
                        if (seq > maxSeq) maxSeq = seq;
                    }
                }
            }
        }

        var nextSeq = maxSeq + 1;
        return $"{yearPrefix}{nextSeq:D3}";
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> Create([FromBody] CreateIdCardRequestDto dto, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.EmergencyPhone) || dto.EmergencyPhone.Length != 10 || !dto.EmergencyPhone.All(char.IsDigit))
        {
            return BadRequest(new { message = "Emergency Phone No. must be an exact 10-digit number." });
        }

        if (string.IsNullOrWhiteSpace(dto.MobilePhone) || dto.MobilePhone.Length != 10 || !dto.MobilePhone.All(char.IsDigit))
        {
            return BadRequest(new { message = "Personal Mobile No. must be an exact 10-digit number." });
        }

        if (!string.IsNullOrWhiteSpace(dto.AadharNumber))
        {
            var rawAadhar = new string(dto.AadharNumber.Where(char.IsDigit).ToArray());
            if (rawAadhar.Length != 12)
            {
                return BadRequest(new { message = "Aadhar Number must be an exact 12-digit number." });
            }
        }

        var dept = await db.Departments.FirstOrDefaultAsync(d => d.Id == dto.DepartmentId, ct);
        var deptName = dept?.Name ?? "Department";

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        var studentName = user?.FullName ?? user?.UserName ?? "Research Scholar";

        var generatedCode = await GetNextIdentityCodeAsync(db, ct);
        var finalRollNumber = !string.IsNullOrWhiteSpace(dto.RollNumber) ? dto.RollNumber : generatedCode;
        var finalIdentityCode = !string.IsNullOrWhiteSpace(dto.IdentityCode) ? dto.IdentityCode : finalRollNumber;

        var now = DateTimeOffset.UtcNow;
        var request = new IdCardRequest
        {
            Id = Guid.NewGuid(),
            StudentUserId = userId.Value,
            CreatedByUserId = userId.Value,
            StudentName = studentName,
            RollNumber = finalRollNumber,
            Designation = dto.Designation,
            ProjectId = dto.ProjectId,
            ProjectNumber = dto.ProjectNumber,
            DepartmentId = dto.DepartmentId,
            DepartmentName = deptName,
            Status = "Pending PI Approval",
            Remarks = dto.Remarks,
            IdentityCode = finalIdentityCode,
            LocalAddress = dto.LocalAddress,
            EmergencyPhone = dto.EmergencyPhone,
            MobilePhone = dto.MobilePhone,
            Email = dto.Email,
            PermanentAddress = dto.PermanentAddress,
            PermanentDistrict = dto.PermanentDistrict,
            PermanentPin = dto.PermanentPin,
            Category = dto.Category,
            AdditionalCategory = dto.AdditionalCategory,
            PiName = dto.PiName,
            BloodGroup = dto.BloodGroup,
            DateOfBirth = dto.DateOfBirth,
            DateOfJoining = dto.DateOfJoining,
            PeriodFrom = dto.PeriodFrom,
            PeriodTo = dto.PeriodTo,
            Gender = dto.Gender,
            AadharNumber = dto.AadharNumber,
            AppointmentLetterNo = dto.AppointmentLetterNo,
            PhotoUrl = dto.PhotoUrl,
            SignatureUrl = dto.SignatureUrl,
            DocumentName = dto.DocumentName,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.IdCardRequests.Add(request);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = request.Id }, request.Id);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIdCardRequestDto dto, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var request = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (request is null) return NotFound();

        if (request.Status != "Pending PI Approval" && request.Status != "Pending Library Approval")
        {
            return BadRequest(new { message = "Request cannot be edited once it has been forwarded by the PI." });
        }

        var isSuperAdmin = User.IsInRole("SuperAdmin");
        if (request.StudentUserId != userId.Value && request.CreatedByUserId != userId.Value && !isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not authorized to edit this request." });
        }

        if (string.IsNullOrWhiteSpace(dto.EmergencyPhone) || dto.EmergencyPhone.Length != 10 || !dto.EmergencyPhone.All(char.IsDigit))
        {
            return BadRequest(new { message = "Emergency Phone No. must be an exact 10-digit number." });
        }

        if (string.IsNullOrWhiteSpace(dto.MobilePhone) || dto.MobilePhone.Length != 10 || !dto.MobilePhone.All(char.IsDigit))
        {
            return BadRequest(new { message = "Personal Mobile No. must be an exact 10-digit number." });
        }

        if (!string.IsNullOrWhiteSpace(dto.AadharNumber))
        {
            var rawAadhar = new string(dto.AadharNumber.Where(char.IsDigit).ToArray());
            if (rawAadhar.Length != 12)
            {
                return BadRequest(new { message = "Aadhar Number must be an exact 12-digit number." });
            }
        }

        if (dto.DepartmentId != default && dto.DepartmentId != request.DepartmentId)
        {
            var dept = await db.Departments.FirstOrDefaultAsync(d => d.Id == dto.DepartmentId, ct);
            if (dept is not null)
            {
                request.DepartmentId = dto.DepartmentId;
                request.DepartmentName = dept.Name;
            }
        }

        request.Designation = dto.Designation;
        request.ProjectId = dto.ProjectId;
        request.ProjectNumber = dto.ProjectNumber;
        request.Remarks = dto.Remarks;
        request.LocalAddress = dto.LocalAddress;
        request.EmergencyPhone = dto.EmergencyPhone;
        request.MobilePhone = dto.MobilePhone;
        request.Email = dto.Email;
        request.PermanentAddress = dto.PermanentAddress;
        request.PermanentDistrict = dto.PermanentDistrict;
        request.PermanentPin = dto.PermanentPin;
        request.Category = dto.Category;
        request.AdditionalCategory = dto.AdditionalCategory;
        request.PiName = dto.PiName;
        request.BloodGroup = dto.BloodGroup;
        request.DateOfBirth = dto.DateOfBirth;
        request.DateOfJoining = dto.DateOfJoining;
        request.PeriodFrom = dto.PeriodFrom;
        request.PeriodTo = dto.PeriodTo;
        request.Gender = dto.Gender;
        request.AadharNumber = dto.AadharNumber;
        request.AppointmentLetterNo = dto.AppointmentLetterNo;
        if (!string.IsNullOrWhiteSpace(dto.PhotoUrl)) request.PhotoUrl = dto.PhotoUrl;
        if (!string.IsNullOrWhiteSpace(dto.SignatureUrl)) request.SignatureUrl = dto.SignatureUrl;
        if (!string.IsNullOrWhiteSpace(dto.DocumentName)) request.DocumentName = dto.DocumentName;
        request.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(request);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<IdCardRequest>>> GetAll(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        IQueryable<IdCardRequest> query = db.IdCardRequests.AsNoTracking();

        var isStudent = User.IsInRole("Fellow");
        var isLibrary = User.IsInRole("Library");
        var isFaculty = User.IsInRole("Faculty");
        var isHod = User.IsInRole("HOD");
        var isDean = User.IsInRole("Dean");
        var isSuperAdmin = User.IsInRole("SuperAdmin");

        // SuperAdmin is a genuine platform-wide fallback (it can already act
        // at any stage below, so seeing every request is not a wider power).
        // Dean is not: like every other office role in this codebase, a
        // Dean sees institute-wide only when their own department is R&C
        // (IInstituteWideScopeResolver) -- otherwise the same
        // department/stage-matched scoping as everyone else, the same rule
        // ReportingService and the proposal/indent queues already apply.
        var isInstituteWide = isSuperAdmin
            || (isDean && await instituteWideScope.IsInstituteWideAsync(userId.Value, ct));

        if (!isInstituteWide)
        {
            if (isStudent && !isLibrary && !isHod && !isFaculty && !isDean)
            {
                query = query.Where(r => r.StudentUserId == userId.Value || r.CreatedByUserId == userId.Value);
            }
        }

        var list = await query.OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<IdCardRequest>> GetById(Guid id, CancellationToken ct)
    {
        var item = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item is null) return NotFound();
        return Ok(item);
    }

    [HttpPost("{id:guid}/action")]
    public async Task<IActionResult> ProcessAction(Guid id, [FromBody] IdCardActionDto dto, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var item = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item is null) return NotFound();

        var isLibrary = User.IsInRole("Library");
        var isFaculty = User.IsInRole("Faculty");
        var isHod = User.IsInRole("HOD");
        var isDean = User.IsInRole("Dean");
        var isSuperAdmin = User.IsInRole("SuperAdmin");

        var isApprove = dto.Action.Equals("Approve", StringComparison.OrdinalIgnoreCase);

        // Strict Role-Based Stage Permission Validation
        if (item.Status == "Pending Library Approval" || item.Status == "Pending PI Approval")
        {
            if (!isFaculty && !isSuperAdmin)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Principal Investigator (PI) / Faculty can approve or reject at the PI Approval stage." });
            }

            if (!isApprove)
            {
                item.Status = "Rejected";
                item.RejectionReason = !string.IsNullOrWhiteSpace(dto.RejectionReason) ? dto.RejectionReason : dto.Remarks;
            }
            else
            {
                item.Status = "Pending HOD Approval";
            }
        }
        else if (item.Status == "Pending HOD Approval")
        {
            if (!isHod && !isSuperAdmin)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Head of Department (HOD) can approve or reject at the HOD Approval stage." });
            }

            if (!isApprove)
            {
                item.Status = "Rejected";
                item.RejectionReason = !string.IsNullOrWhiteSpace(dto.RejectionReason) ? dto.RejectionReason : dto.Remarks;
            }
            else
            {
                item.Status = "Pending Dean Approval";
            }
        }
        else if (item.Status == "Pending Dean Approval" || item.Status == "Pending")
        {
            if (!isDean && !isSuperAdmin)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the Dean (R&C) can approve or reject at the Dean Approval stage." });
            }

            if (!isApprove)
            {
                item.Status = "Rejected";
                item.RejectionReason = !string.IsNullOrWhiteSpace(dto.RejectionReason) ? dto.RejectionReason : dto.Remarks;
            }
            else
            {
                item.Status = "Issued";
                item.IssuedAt = DateTimeOffset.UtcNow;
                
                var generatedNo = !string.IsNullOrWhiteSpace(dto.CustomIdCardNumber)
                    ? dto.CustomIdCardNumber
                    : $"MNNIT/RNC/IDC/{DateTime.UtcNow.Year}/{Random.Shared.Next(100, 999)}";
                
                item.IdCardNumber = generatedNo;

                // Gatekeeper Integration: Update fellow appointment to unlock Fellowship and Leave modules
                // Try lookup by ApplicationUserId first (primary), then fallback to other methods
                var appointment = await db.ManpowerSelections
                    .FirstOrDefaultAsync(s => s.ApplicationUserId == item.StudentUserId, ct);
                
                // If not found by ApplicationUserId, try looking up via the candidate's ApplicationUserId
                if (appointment is null)
                {
                    appointment = await db.ManpowerSelections
                        .Include(s => s.Candidate)
                        .Where(s => s.Candidate != null && s.Candidate.ApplicationUserId == item.StudentUserId)
                        .FirstOrDefaultAsync(ct);
                }
                
                if (appointment is not null)
                {
                    appointment.IdCardNumber = generatedNo;
                    appointment.IdCardIssuedAt = item.IssuedAt;
                }
            }
        }
        else if (item.Status == "Issued" || item.Status == "Rejected")
        {
            return BadRequest(new { message = $"Cannot process action on request already in '{item.Status}' state." });
        }

        var now = DateTimeOffset.UtcNow;
        item.UpdatedAt = now;
        item.UpdatedByUserId = userId.Value;
        if (!string.IsNullOrWhiteSpace(dto.Remarks))
        {
            item.Remarks = dto.Remarks;
        }

        await db.SaveChangesAsync(ct);
        return Ok(item);
    }
}
