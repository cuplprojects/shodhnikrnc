using API.Application.Recruitment;
using API.Authorization;
using API.Contracts.Recruitment;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using API.Application.Common;

namespace API.Controllers;

[ApiController]
[Authorize]
public class RecruitmentController(
    IRecruitmentService recruitment, IApplicationDbContext db, UserManager<ApplicationUser> userManager,
    Microsoft.AspNetCore.Hosting.IWebHostEnvironment environment) : ControllerBase
{
    // ------------------------------------------------- PI-facing (Faculty)

    private static readonly string[] DeanOrOfficeRoles =
        ["Dean", "HOD", "SuperAdmin", "DeputyRegistrar", "Superintendent", "RegularStaff", "Director"];

    private bool IsDeanOrOffice() => DeanOrOfficeRoles.Any(User.IsInRole);

    /// <summary>
    /// Which user id authorizes the advertisement TEMPLATE chosen on an
    /// advertise/readvertise call -- deliberately not the same question as which
    /// id authorizes the recruitment.
    /// </summary>
    /// <remarks>
    /// <see cref="GetPiUserIdAsync"/> substitutes the project owner's id for the
    /// caller's own so a Dean/Office user can act on a PI's behalf. That
    /// substitution is right for the recruitment/project check, but fatal for
    /// the template check: <c>ResolveAsync</c>'s only guard is
    /// <c>OwnerUserId != piUserId</c>, so a substituted id matches by
    /// construction and would hand the caller that PI's private template
    /// wording -- straight into <c>Advertisement.Text</c>, which the recruitment
    /// summary reads back. <c>recruitment.detail</c> is an Institute-scoped
    /// page, so a plain Faculty account can reach another PI's recruitment id
    /// and would otherwise exploit exactly that.
    /// <para>
    /// So the impersonated PI's id is honoured ONLY when the caller actually
    /// holds a Dean/Office role -- the legitimate use of the shim. Everyone else
    /// is authorized against their own identity, which for a PI acting on their
    /// own recruitment is the same id the substitution would have produced.
    /// </para>
    /// </remarks>
    private Guid TemplateCallerUserId(Guid realUserId, Guid substitutedPiUserId) =>
        IsDeanOrOffice() ? substitutedPiUserId : realUserId;

    private async Task<Guid> GetPiUserIdAsync(Guid recruitmentId, Guid fallbackUserId, CancellationToken ct)
    {
        var req = await db.RecruitmentRequests.FirstOrDefaultAsync(r => r.Id == recruitmentId, ct);
        if (req is not null)
        {
            var proj = await db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId, ct);
            if (proj is not null) return proj.OwnerUserId;
        }
        return fallbackUserId;
    }

    [HttpPost("api/projects/{projectId:guid}/recruitments")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<Guid>> Create(
        Guid projectId, [FromBody] CreateRecruitmentRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var id = await recruitment.CreateAsync(
            new CreateRecruitmentInput(projectId, body.SanctionedManpowerPositionId), userId.Value, ct);

        return Created($"{Request.Path}/{id}", id);
    }

    [HttpGet("api/projects/{projectId:guid}/recruitments")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> List(
        Guid projectId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListForProjectAsync(projectId, userId.Value, User.GetRoles(), ct));
    }

    // ------------------------------------------------- Dean-facing (all recruitments list)

    [HttpGet("api/recruitments")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListAllForDean(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        // Return all recruitments that are at stages requiring Dean's attention.
        // Project to anonymous type first — EF expression trees cannot call
        // constructors that have optional parameters (CS0854).
        var rows = await db.RecruitmentRequests
            .Where(r => r.Stage == RecruitmentStage.MeritListPrepared
                     || r.Stage == RecruitmentStage.Approved
                     || r.Stage == RecruitmentStage.OfferIssued
                     || r.Stage == RecruitmentStage.Advertised
                     || r.Stage == RecruitmentStage.SelectionScheduled)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.ProjectId,
                r.SanctionedManpowerPositionId,
                r.Stage,
                r.AdvertisementRound,
                r.InterviewDate,
                r.InterviewTime,
                r.InterviewVenue,
                // Must agree with RecruitmentService.ToSummariesAsync's and
                // ReportingService's own Submitted-only scoping: a Draft is an
                // unsubmitted application-wizard row, not a real candidate, and
                // the Dean's list is the third place this count is built. Any
                // FOURTH place must carry the same filter.
                CandidateCount = r.Candidates.Count(c => c.ApplicationStatus == ApplicationStatus.Submitted),
                r.CreatedAt
            })
            .ToListAsync(ct);

        var reqs = rows
            .Select(r => new RecruitmentSummary(
                r.Id,
                r.ProjectId,
                r.SanctionedManpowerPositionId,
                r.Stage,
                r.AdvertisementRound,
                r.InterviewDate,
                r.InterviewTime,
                r.InterviewVenue,
                r.CandidateCount,
                r.CreatedAt))
            .ToList();

        return Ok(reqs);
    }

    [HttpGet("api/recruitments/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<RecruitmentSummary>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.GetAsync(id, userId.Value, User.GetRoles(), ct));
    }

    /// <summary>The PI's recruitments across all of their projects -- the
    /// landing list before drilling into one project's recruitments.</summary>
    [HttpGet("api/my/recruitments")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListOwn(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListOwnAsync(userId.Value, IsDeanOrOffice(), ct));
    }

    /// <summary>
    /// The live entity-bound token values for this recruitment (project
    /// title, PI name, salary figures, etc.), resolved without requiring an
    /// existing saved advertisement template -- used by the advertise-time
    /// rich text editor to insert a live value at the cursor.
    /// </summary>
    [HttpGet("api/recruitments/{id:guid}/advertisement-token-values")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<IReadOnlyDictionary<string, string>>> GetAdvertisementTokenValues(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        return Ok(await recruitment.GetAdvertisementTokenValuesAsync(id, piUserId, ct));
    }

    /// <summary>
    /// Saves the PI's in-progress advertisement text so it survives closing
    /// the modal. No workflow, no approval routing -- purely a save point.
    /// </summary>
    [HttpPost("api/recruitments/{id:guid}/advertisement-draft")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SaveAdvertisementDraft(
        Guid id, [FromBody] SaveAdvertisementDraftRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SaveAdvertisementDraftAsync(
            id, piUserId, body.Text, body.ClosingDate,
            body.RequiredQualifications, body.AllowDiplomaFor12th,
            body.RequireExperience, body.MinExperienceMonths,
            body.RequirePublications, body.RequireResume, ct);
        return NoContent();
    }

    /// <summary>
    /// Renders the caller's current (possibly unsaved) editor text through
    /// the real advertisement layout, for the "Preview" button -- nothing is
    /// persisted by this call.
    /// </summary>
    [HttpPost("api/recruitments/{id:guid}/advertisement-preview")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<string>> PreviewAdvertisement(
        Guid id, [FromBody] SaveAdvertisementDraftRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        var html = await recruitment.PreviewAdvertisementHtmlAsync(id, piUserId, body.Text, body.ClosingDate, ct);
        return Content(html, "text/html");
    }

    /// <summary>Cap on an uploaded advertisement image. Rejected before anything is written to disk.</summary>
    private const long MaxAdvertisementImageBytes = 5 * 1024 * 1024;

    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];
    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];

    [HttpPost("api/recruitments/{id:guid}/advertisement-images")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxAdvertisementImageBytes)]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<AdvertisementImageUploadResponse>> UploadAdvertisementImage(
        Guid id, IFormFile file, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        // Ownership check -- same pattern as GetAdvertisementTokenValues.
        await GetPiUserIdAsync(id, userId.Value, ct);

        if (file is null || file.Length == 0)
            return BadRequest(new { detail = "No file uploaded." });

        if (file.Length > MaxAdvertisementImageBytes)
            return BadRequest(new { detail = $"The file exceeds the {MaxAdvertisementImageBytes / (1024 * 1024)} MB limit." });

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".png" && extension != ".jpg" && extension != ".jpeg")
            return BadRequest(new { detail = "Only PNG or JPEG images are allowed." });

        if (!await HasImageHeaderAsync(file, ct))
            return BadRequest(new { detail = "The file is not a valid image." });

        var uploadsFolder = Path.Combine(
            environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            "uploads", "advertisement-images");
        Directory.CreateDirectory(uploadsFolder);

        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
            await file.CopyToAsync(stream, ct);

        return Ok(new AdvertisementImageUploadResponse($"/uploads/advertisement-images/{uniqueFileName}"));
    }

    private static async Task<bool> HasImageHeaderAsync(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var header = new byte[4];
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        if (read < 3) return false;

        return (header[0] == PngMagic[0] && header[1] == PngMagic[1] && header[2] == PngMagic[2] && read >= 4 && header[3] == PngMagic[3])
            || (header[0] == JpegMagic[0] && header[1] == JpegMagic[1] && header[2] == JpegMagic[2]);
    }

    [HttpPost("api/recruitments/{id:guid}/advertise")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> Advertise(
        Guid id, [FromBody] AdvertiseRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);

        // piUserId authorizes the RECRUITMENT (possibly substituted); the second
        // id authorizes the chosen TEMPLATE. See TemplateCallerUserId.
        await recruitment.AdvertiseAsync(
            new AdvertiseInput(
                id, body.PublishedOn, body.ClosingDate, body.Text, body.Remarks,
                body.AdvertisementTemplateId, body.FreeTextTokenValues,
                body.RequiredQualifications, body.AllowDiplomaFor12th,
                body.RequireExperience, body.MinExperienceMonths,
                body.RequirePublications, body.RequireResume),
            piUserId, TemplateCallerUserId(userId.Value, piUserId), ct);

        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/readvertise")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> Readvertise(
        Guid id, [FromBody] ReadvertiseRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        // Same split as Advertise: see TemplateCallerUserId.
        await recruitment.ReadvertiseAsync(
            new ReadvertiseInput(
                id, body.CandidateCountAtClose, body.PublishedOn, body.ClosingDate, body.Text,
                body.AdvertisementTemplateId, body.FreeTextTokenValues,
                body.RequiredQualifications, body.AllowDiplomaFor12th,
                body.RequireExperience, body.MinExperienceMonths,
                body.RequirePublications, body.RequireResume),
            piUserId, TemplateCallerUserId(userId.Value, piUserId), ct);

        return NoContent();
    }

    // ------------------------------------------------- Advertisement approval chain
    //
    // The three-stage internal chain (PI -> RnC office -> Computer Centre) is
    // enforced by the workflow engine reading the roles on each stage of the
    // stored route (see AdvertisementWorkflowSeeder), not by attributes here --
    // the same shape ProposalsController uses for its own chain actions.
    //
    // Do not add [Authorize(Roles = ...)] or [PageAccess] to these four: a
    // static role/page gate would silently override the configured route the
    // same way a hardcoded role list did before Phase 7, and a SuperAdmin
    // editing who may act at a stage would appear to do nothing.

    [HttpPost("api/recruitments/{id:guid}/advertisement/forward")]
    public async Task<IActionResult> ForwardAdvertisement(
        Guid id, [FromBody] RemarksRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ForwardAdvertisementAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/advertisement/approve")]
    public async Task<IActionResult> ApproveAdvertisement(
        Guid id, [FromBody] RemarksRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ApproveAdvertisementAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/advertisement/reject")]
    public async Task<IActionResult> RejectAdvertisement(
        Guid id, [FromBody] RemarksRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.RejectAdvertisementAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/advertisement/return")]
    public async Task<IActionResult> ReturnAdvertisement(
        Guid id, [FromBody] RemarksRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ReturnAdvertisementAsync(id, userId.Value, User.GetRoles(), body.Remarks, ct);
        return NoContent();
    }

    // Discovery queues for the chain above: unlike the four actions, these ARE
    // gated by [PageAccess] -- the queue pages are ordinary Institute/Department
    // scoped list views, not stage-authorized actions, so PageCatalogue's
    // department/institute scoping is the right (and sufficient) gate.
    [HttpGet("api/recruitments/advertisement-rnc-queue")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListRnCAdvertisementQueue(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListForRnCOfficeAdvertisementQueueAsync(userId.Value, ct));
    }

    [HttpGet("api/recruitments/advertisement-cc-queue")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListComputerCentreAdvertisementQueue(CancellationToken ct)
    {
        return Ok(await recruitment.ListForComputerCentreQueueAsync(ct));
    }

    [HttpGet("api/recruitments/advertisement-cc-history")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListComputerCentreAdvertisementHistory(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListComputerCentreAdvertisementHistoryAsync(userId.Value, ct));
    }

    [HttpGet("api/recruitments/{id:guid}/candidates")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<CandidateSummary>>> ListCandidates(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        return Ok(await recruitment.ListCandidatesAsync(id, piUserId, ct));
    }

    [HttpGet("api/recruitments/{id:guid}/candidates/details")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<CandidateFullDetail>>> ListCandidateDetails(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListCandidateDetailsAsync(id, userId.Value, User.GetRoles(), ct));
    }

    [HttpGet("api/recruitments/{id:guid}/committee")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<CommitteeMemberSummary>>> ListCommittee(
        Guid id, [FromQuery] CommitteeKind kind, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        return Ok(await recruitment.ListCommitteeAsync(id, kind, piUserId, ct));
    }

    /// <summary>
    /// Real login accounts for the committee-member picker (CommitteeForm.jsx),
    /// so a member picked from the list always carries a genuine
    /// ApplicationUserId -- see FacultyDirectoryEntry's own remarks for why
    /// this cannot reuse FacultyUsersController's /brief endpoint, which reads
    /// the legacy FacultyProfiles import instead.
    /// </summary>
    [HttpGet("api/recruitments/faculty-directory")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<IReadOnlyList<FacultyDirectoryEntry>>> ListFacultyDirectory(
        [FromQuery] Guid? departmentId, CancellationToken ct)
    {
        var facultyUsers = await userManager.GetUsersInRoleAsync("Faculty");
        if (departmentId.HasValue)
        {
            facultyUsers = facultyUsers.Where(u => u.DepartmentId == departmentId.Value).ToList();
        }

        var departmentIds = facultyUsers.Select(u => u.DepartmentId).Where(id => id.HasValue).Select(id => id!.Value).ToList();
        var departmentNamesById = await db.Departments
            .Where(d => departmentIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Name, ct);

        var userIds = facultyUsers.Select(u => u.Id).ToList();
        var designationsByUserId = await db.FacultyProfiles
            .Where(p => p.ApplicationUserId.HasValue && userIds.Contains(p.ApplicationUserId.Value))
            .ToDictionaryAsync(p => p.ApplicationUserId!.Value, p => p.Designation, ct);

        var entries = facultyUsers
            .Where(u => u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new FacultyDirectoryEntry(
                u.Id, u.FullName, u.Email,
                u.DepartmentId.HasValue && departmentNamesById.TryGetValue(u.DepartmentId.Value, out var name) ? name : null,
                designationsByUserId.GetValueOrDefault(u.Id),
                u.DepartmentId))
            .ToList();

        return Ok(entries);
    }

    [HttpPost("api/recruitments/{id:guid}/screening-committee")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SubmitScreeningCommittee(
        Guid id, [FromBody] SubmitCommitteeRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SubmitScreeningCommitteeAsync(id, ToMembers(body), piUserId, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/selection-committee")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SubmitSelectionCommittee(
        Guid id, [FromBody] SubmitCommitteeRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SubmitSelectionCommitteeAsync(id, ToMembers(body), piUserId, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/screening-committee/submit-for-approval")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SubmitScreeningCommitteeForApproval(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SubmitScreeningCommitteeForApprovalAsync(id, piUserId, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/screening-committee/assign")]
    [Authorize(Roles = "Dean,SuperAdmin")]
    public async Task<IActionResult> AssignScreeningCommitteeMember(
        Guid id, [FromBody] AssignScreeningCommitteeMemberRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.AssignScreeningCommitteeMemberAsync(id, body.Nominee, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/selection-committee/submit-for-approval")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SubmitSelectionCommitteeForApproval(
        Guid id, [FromBody] SubmitSelectionCommitteeForApprovalRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SubmitSelectionCommitteeForApprovalAsync(
            id, body.OptionalMember, body.RecommendedMembers, piUserId, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/selection-committee/select")]
    [Authorize(Roles = "Dean,SuperAdmin")]
    public async Task<IActionResult> SelectSelectionCommitteeMember(
        Guid id, [FromBody] SelectSelectionCommitteeMemberRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SelectSelectionCommitteeMemberAsync(id, body.SelectedCommitteeMemberId, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/selection-committee/return")]
    [Authorize(Roles = "Dean,SuperAdmin")]
    public async Task<IActionResult> ReturnSelectionCommittee(
        Guid id, [FromBody] ReturnSelectionCommitteeRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ReturnSelectionCommitteeAsync(id, body.Remarks, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/screening-result")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> RecordScreeningResult(
        Guid id, [FromBody] RecordScreeningRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.RecordScreeningResultAsync(
            new RecordScreeningInput(body.CandidateId, body.Result, body.Remarks), piUserId, ct);

        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/screening/send-not-eligible-notifications")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SendNotEligibleNotifications(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        var notified = await recruitment.SendNotEligibleNotificationsAsync(id, piUserId, ct);
        return Ok(new { notifiedCount = notified.Count, notifiedCandidateIds = notified });
    }

    [HttpPost("api/recruitments/committee-members/{memberId:guid}/availability")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SetAvailability(
        Guid memberId, [FromBody] SetAvailabilityRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SetNomineeAvailabilityAsync(memberId, body.AvailabilityDate, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/interview")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> ScheduleInterview(
        Guid id, [FromBody] ScheduleInterviewRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.ScheduleInterviewAsync(
            new ScheduleInterviewInput(id, body.InterviewDate, body.InterviewTime, body.InterviewVenue), piUserId, ct);

        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/interview-mode")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SetInterviewMode(
        Guid id, 
        [FromBody] SetInterviewModeRequestBody body, 
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SetInterviewModeAsync(
            new SetInterviewModeInput(body.CandidateId, body.Mode),
            piUserId, body.DeanApprovalUserId, ct);

        return NoContent();
    }

    [HttpPost("api/recruitments/candidates/{candidateId:guid}/interview-mode/approve")]
    [Authorize]
    public async Task<IActionResult> ApproveInterviewMode(
        Guid candidateId, [FromBody] SetInterviewModeRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ApproveInterviewModeAsync(candidateId, body.Mode, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/screening-committee/nominate")]
    [Authorize]
    public async Task<IActionResult> NominateScreeningFaculty(
        Guid id, [FromBody] CommitteeMemberInput body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.NominateScreeningFacultyAsync(
            id, body.Name, body.Department, body.Position, userId.Value,
            body.ApplicationUserId, body.Email, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/joining/submit")]
    [Authorize(Roles = "Faculty")]
    public async Task<IActionResult> SubmitJoining(
        Guid id, [FromBody] RecordJoiningRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SubmitJoiningReportAsync(
            new RecordJoiningInput(
                body.CandidateId, body.JoinedOn, body.ValidTill, body.RecommendedStipend,
                body.AadharNo, body.PanNo, body.BankAccountNo, body.IfscCode, body.Dob, body.Gender),
            userId.Value, ct);

        return NoContent();
    }

    /// <summary>
    /// The joining details a PI already submitted for one candidate, so HOD/
    /// Dean can see what they are verifying or approving rather than only the
    /// PI who filled the form (previously tracked in the PI's own browser
    /// localStorage, invisible to every other role/machine -- see
    /// RecruitmentDetailPage.jsx's joining panel).
    /// </summary>
    [HttpGet("api/recruitments/candidates/{candidateId:guid}/joining")]
    [Authorize]
    public async Task<ActionResult<JoiningReportDetail?>> GetJoiningReport(Guid candidateId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.GetJoiningReportAsync(candidateId, ct));
    }

    [HttpGet("api/recruitments/joining-queue")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<JoiningQueueItemSummary>>> ListJoiningQueue(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListJoiningQueueAsync(userId.Value, ct));
    }

    /// <summary>
    /// The PI's own forward of the candidate's joining report to HOD -- the
    /// step that replaced the PI filling the report in themselves once
    /// submission moved to the candidate's portal.
    /// </summary>
    [HttpPost("api/recruitments/joining/{candidateId:guid}/forward-to-hod")]
    [Authorize(Roles = "Faculty")]
    public async Task<IActionResult> ForwardJoiningToHod(
        Guid candidateId, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        string? remarks = body.TryGetProperty("remarks", out var r) ? r.GetString() : null;
        await recruitment.ForwardJoiningReportToHodAsync(candidateId, remarks, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/joining/{candidateId:guid}/forward")]
    [Authorize(Roles = "HOD,Superintendent,DeputyRegistrar,SuperAdmin")]
    public async Task<IActionResult> ForwardJoining(
        Guid candidateId, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        string? remarks = body.TryGetProperty("remarks", out var r) ? r.GetString() : null;
        await recruitment.ForwardJoiningReportAsync(candidateId, remarks, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/joining/{candidateId:guid}/approve")]
    [Authorize(Roles = "Dean,SuperAdmin")]
    public async Task<IActionResult> ApproveJoining(
        Guid candidateId, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        string? remarks = body.TryGetProperty("remarks", out var r) ? r.GetString() : null;
        await recruitment.ApproveJoiningReportAsync(candidateId, remarks, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/joining/{candidateId:guid}/return")]
    [Authorize(Roles = "Faculty,HOD,Superintendent,DeputyRegistrar,Dean,SuperAdmin")]
    public async Task<IActionResult> ReturnJoining(
        Guid candidateId, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        string? remarks = body.TryGetProperty("remarks", out var r) ? r.GetString() : null;
        await recruitment.ReturnJoiningReportAsync(candidateId, remarks, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/merit-list")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SubmitMeritList(
        Guid id, [FromBody] SubmitMeritListRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.SubmitMeritListAsync(
            id, [.. body.Ranks.Select(r => new MeritRankInput(r.CandidateId, r.Rank))],
            piUserId, ct);

        return NoContent();
    }

    /// <summary>Dean only: the BRD gives final merit-list approval to the Dean.</summary>
    [HttpPost("api/recruitments/{id:guid}/approve")]
    [Authorize(Roles = "Dean,SuperAdmin")]
    public async Task<IActionResult> ApproveMeritList(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ApproveMeritListAsync(id, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/offer")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> IssueOffer(
        Guid id, [FromBody] IssueOfferRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        await recruitment.IssueOfferLetterAsync(
            new IssueOfferInput(body.CandidateId, body.RecommendedStipend, body.JoiningDate),
            piUserId, ct);

        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/offer/release")]
    [Authorize(Roles = "RegularStaff,SuperAdmin")]
    public async Task<IActionResult> ReleaseOffer(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.ReleaseOfferLetterAsync(id, userId.Value, ct);
        return NoContent();
    }

    [HttpPost("api/recruitments/{id:guid}/joining")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<Guid>> RecordJoining(
        Guid id, [FromBody] RecordJoiningRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        var selectionId = await recruitment.RecordJoiningAsync(
            new RecordJoiningInput(
                body.CandidateId, body.JoinedOn, body.ValidTill, body.RecommendedStipend,
                body.AadharNo, body.PanNo, body.BankAccountNo, body.IfscCode, body.Dob, body.Gender),
            piUserId, ct);

        return Ok(selectionId);
    }

    [HttpPost("api/fellow-appointments/{selectionId:guid}/id-card")]
    [Authorize(Roles = "Faculty,HOD,Dean,SuperAdmin,DeputyRegistrar,Superintendent,RegularStaff")]
    public async Task<IActionResult> IssueIdCard(
        Guid selectionId, [FromBody] IssueIdCardRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.IssueIdCardAsync(
            new IssueIdCardInput(selectionId, body.IdCardNumber), userId.Value, ct);

        return NoContent();
    }

    /// <summary>
    /// Renders a recruitment document on demand.
    /// </summary>
    /// <remarks>
    /// Generated per request rather than served from storage: these reflect the
    /// live state of the drive, so a stored copy would go stale as candidates are
    /// screened and members sign.
    /// </remarks>
    [HttpGet("api/recruitments/{id:guid}/documents/{kind}")]
    [Authorize]
    public async Task<IActionResult> GetDocument(
        Guid id,
        RecruitmentDocumentKind kind,
        [FromQuery] string? coPi,
        [FromQuery] string? candidateName,
        [FromQuery] string? parentName,
        [FromQuery] string? address,
        [FromQuery] string? city,
        [FromQuery] string? state,
        [FromQuery] string? pincode,
        [FromQuery] decimal? fellowshipAmount,
        [FromQuery] decimal? hraAmount,
        [FromQuery] DateOnly? joiningDate,
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        OfferLetterManualOverrides? overrides = null;
        if (!string.IsNullOrEmpty(candidateName))
        {
            overrides = new OfferLetterManualOverrides(
                candidateName,
                parentName,
                address,
                city,
                state,
                pincode,
                fellowshipAmount,
                hraAmount,
                joiningDate);

            // Save form inputs to disk
            try
            {
                var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
                Directory.CreateDirectory(cacheFolder);
                var dataFilePath = Path.Combine(cacheFolder, $"{id}-OfferLetter.json");
                var jsonData = System.Text.Json.JsonSerializer.Serialize(overrides);
                await System.IO.File.WriteAllTextAsync(dataFilePath, jsonData, ct);
            }
            catch
            {
                // Non-fatal
            }
        }

        var piUserId = await GetPiUserIdAsync(id, userId.Value, ct);
        var document = await recruitment.GenerateDocumentAsync(id, kind, piUserId, coPi, overrides, ct);
        return File(document.Content, "application/pdf", document.FileName);
    }

    [HttpGet("api/recruitments/{id:guid}/offer-letter-data")]
    [Authorize]
    public async Task<IActionResult> GetOfferLetterData(Guid id, CancellationToken ct)
    {
        var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
        var dataFilePath = Path.Combine(cacheFolder, $"{id}-OfferLetter.json");

        if (!System.IO.File.Exists(dataFilePath))
        {
            return NotFound();
        }

        var jsonData = await System.IO.File.ReadAllTextAsync(dataFilePath, ct);
        return Content(jsonData, "application/json");
    }

    [HttpGet("api/recruitments/{id:guid}/documents/{kind}/data")]
    [Authorize]
    public async Task<IActionResult> GetDocumentData(Guid id, string kind, CancellationToken ct)
    {
        var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
        var dataFilePath = Path.Combine(cacheFolder, $"{id}-{kind}.json");

        if (!System.IO.File.Exists(dataFilePath))
        {
            return NotFound();
        }

        var jsonData = await System.IO.File.ReadAllTextAsync(dataFilePath, ct);
        return Content(jsonData, "application/json");
    }

    [HttpPost("api/recruitments/{id:guid}/documents/{kind}/data")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> SaveDocumentData(Guid id, string kind, [FromBody] System.Text.Json.JsonElement body, CancellationToken ct)
    {
        var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
        Directory.CreateDirectory(cacheFolder);
        var dataFilePath = Path.Combine(cacheFolder, $"{id}-{kind}.json");

        var jsonData = body.GetRawText();
        await System.IO.File.WriteAllTextAsync(dataFilePath, jsonData, ct);
        return NoContent();
    }

    // ------------------------------------------------- Applicant-facing

    [HttpGet("api/recruitments/open")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<RecruitmentSummary>>> ListOpen(CancellationToken ct)
    {
        return Ok(await recruitment.ListOpenAsync(ct));
    }

    [HttpPost("api/recruitments/{id:guid}/apply")]
    [PageAccess("applications.apply")]
    public async Task<ActionResult<Guid>> Apply(
        Guid id, [FromBody] ApplyRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var candidateId = await recruitment.ApplyAsync(
            new ApplyInput(id, body.FullName, body.Mobile, body.Qualification,
                body.Experience, body.PrefillFromCandidateId),
            userId.Value, ct);

        return Created($"{Request.Path}/{candidateId}", candidateId);
    }

    /// <summary>
    /// The applicant's own applications -- and the only source of candidate ids
    /// they can legitimately use to prefill a new one.
    /// </summary>
    [HttpGet("api/my/applications")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<CandidateSummary>>> MyApplications(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.ListOwnApplicationsAsync(userId.Value, ct));
    }

    /// <summary>
    /// The candidate's own joining-report submission, once their offer has
    /// been issued -- moves this step off the PI's recruitment detail page
    /// onto the candidate's own portal (client request, 2026-09-15). HOD/Dean
    /// approval routing is unchanged.
    /// </summary>
    [HttpPost("api/my/applications/{candidateId:guid}/joining")]
    [Authorize]
    public async Task<IActionResult> SubmitOwnJoining(
        Guid candidateId, [FromBody] RecordJoiningRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SubmitOwnJoiningReportAsync(
            new RecordJoiningInput(
                candidateId, body.JoinedOn, body.ValidTill, body.RecommendedStipend,
                body.AadharNo, body.PanNo, body.BankAccountNo, body.IfscCode, body.Dob, body.Gender),
            userId.Value, ct);

        return NoContent();
    }

    /// <summary>The candidate's own acceptance of an issued offer.</summary>
    [HttpPost("api/recruitments/candidates/{candidateId:guid}/offer/accept")]
    [Authorize]
    public async Task<IActionResult> AcceptOffer(Guid candidateId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.AcceptOfferAsync(candidateId, userId.Value, ct);
        return NoContent();
    }

    /// <summary>
    /// The candidate's own decline of an issued offer -- reopens the other
    /// candidates from this round and returns the request to Approved for a
    /// manual re-offer.
    /// </summary>
    [HttpPost("api/recruitments/candidates/{candidateId:guid}/offer/decline")]
    [Authorize]
    public async Task<IActionResult> DeclineOffer(Guid candidateId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.DeclineOfferAsync(candidateId, userId.Value, ct);
        return NoContent();
    }

    /// <summary>
    /// A PI/Dean's terminal declaration that this recruitment's candidate pool
    /// is exhausted with no one accepting.
    /// </summary>
    [HttpPost("api/recruitments/{id:guid}/no-candidate-accepted")]
    [PageAccess("recruitment.detail")]
    public async Task<IActionResult> MarkNoCandidateAccepted(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.MarkNoCandidateAcceptedAsync(id, userId.Value, ct);
        return NoContent();
    }

    // ------------------------------------------------- Application wizard

    [HttpPost("api/recruitments/{id:guid}/draft")]
    [PageAccess("applications.apply")]
    public async Task<ActionResult<Guid>> StartOrResumeDraft(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var candidateId = await recruitment.StartOrResumeDraftAsync(id, userId.Value, ct);
        return Ok(candidateId);
    }

    [HttpPost("api/recruitments/{id:guid}/draft/prefill")]
    [PageAccess("applications.apply")]
    public async Task<ActionResult<Guid>> PrefillDraft(
        Guid id, [FromBody] PrefillRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var candidateId = await recruitment.PrefillFromPreviousApplicationAsync(
            id, body.SourceCandidateId, userId.Value, ct);
        return Ok(candidateId);
    }

    [HttpPut("api/candidates/draft/step1")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SaveStep1(
        [FromBody] SaveStep1PersonalRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SaveStep1PersonalAsync(
            new SaveStep1PersonalInput(
                body.CandidateId, body.FullName, body.Mobile, body.Gender, body.IsMarried,
                body.DateOfBirth, body.FatherOrHusbandName, body.PresentAddress, body.PermanentAddress,
                body.Email, body.Nationality, body.Category, body.CategoryCertificateDocumentId,
                body.IdProofType, body.IdProofNumber, body.IdProofDocumentId),
            userId.Value, ct);

        return NoContent();
    }

    [HttpPut("api/candidates/draft/step2")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SaveStep2(
        [FromBody] SaveStep2QualificationsRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SaveStep2QualificationsAsync(
            new SaveStep2QualificationsInput(
                body.CandidateId, body.GateNetGpatQualified, body.GateNetGpatRollNo,
                body.GateNetGpatYear, body.GateNetGpatScore,
                [.. body.Education.Select(e => new CandidateEducationInput(
                    e.Id, e.Level, e.OtherLevelName, e.Subject, e.BoardInstituteUniv, e.Year,
                    e.MarksOrCgpa, e.Division, e.CertificateDocumentId))],
                body.GateNetGpatCertificateDocumentId),
            userId.Value, ct);

        return NoContent();
    }

    [HttpPut("api/candidates/draft/step3")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SaveStep3(
        [FromBody] SaveStep3ExperienceRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SaveStep3ExperienceAsync(
            new SaveStep3ExperienceInput(
                body.CandidateId,
                [.. body.Experiences.Select(x => new CandidateExperienceInput(
                    x.Id, x.SortOrder, x.Organization, x.Position, x.SalaryEmoluments,
                    x.NatureOfDuties, x.NatureOfAppointment, x.PeriodYears, x.PeriodMonths,
                    x.PeriodDays, x.CertificateDocumentId))]),
            userId.Value, ct);

        return NoContent();
    }

    [HttpPut("api/candidates/draft/step4")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SaveStep4(
        [FromBody] SaveStep4PublicationsRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SaveStep4PublicationsAsync(
            new SaveStep4PublicationsInput(
                body.CandidateId, body.SciJournalCount, body.ScopusJournalCount, body.NonSciJournalCount,
                body.InternationalConfCount, body.NationalConfCount, body.OtherInformation,
                body.WantsHigherDegreeRegistration, body.PublicationsDocumentId, body.PublicationName),
            userId.Value, ct);

        return NoContent();
    }

    [HttpPut("api/candidates/draft/step5")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SaveStep5(
        [FromBody] SaveStep5ResumeRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SaveStep5ResumeAsync(
            new SaveStep5ResumeInput(body.CandidateId, body.ResumeDocumentId, body.Remarks),
            userId.Value, ct);

        return NoContent();
    }

    [HttpPost("api/candidates/{id:guid}/submit")]
    [PageAccess("applications.apply")]
    public async Task<IActionResult> SubmitDraft(
        Guid id, [FromBody] SubmitDraftRequestBody? body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await recruitment.SubmitDraftAsync(id, userId.Value, body?.PhotoDocumentId, body?.SignatureDocumentId, ct);
        return NoContent();
    }

    /// <summary>
    /// Full current state of the applicant's own still-Draft application.
    /// Consumed only by the wizard's Step 5 review screen -- not needed by the
    /// four save-step endpoints, which each only need their own step's slice.
    /// </summary>
    [HttpGet("api/candidates/{id:guid}/draft")]
    [Authorize]
    public async Task<ActionResult<CandidateDraftDetail>> GetOwnDraft(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await recruitment.GetOwnDraftAsync(id, userId.Value, ct));
    }

    private static IReadOnlyList<CommitteeMemberInput> ToMembers(SubmitCommitteeRequestBody body) =>
    [
        .. (body.Members ?? []).Select(m =>
            new CommitteeMemberInput(
                m.Role, m.Name, m.Department, m.Position, m.IsExternal,
                m.ApplicationUserId, m.Email, m.IsOutsideInstitute, m.ConsentDocumentId))
    ];
}
