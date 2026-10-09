using API.Application.Common;
using API.Application.Projects;
using API.Application.Recruitment;
using API.Authorization;
using API.Contracts.Recruitment;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

/// <summary>
/// A PI's reusable advertisement wording: clone the system default (or one of
/// their own templates), edit/delete their own copies, and resolve a chosen
/// template's tokens against one real recruitment when advertising it.
/// </summary>
[ApiController]
[Authorize]
public class AdvertisementTemplatesController(
    IAdvertisementTemplateService templates, IApplicationDbContext db) : ControllerBase
{
    [HttpGet("api/advertisement-templates")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<AdvertisementTemplateResponse>>> List(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var result = await templates.ListForUserAsync(userId.Value, ct);
        return Ok(result.Select(ToResponse).ToList());
    }

    [HttpPost("api/advertisement-templates/{id:guid}/clone")]
    [PageAccess("recruitment.pi-manage")]
    public async Task<ActionResult<Guid>> Clone(Guid id, [FromBody] CloneTemplateRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var newId = await templates.CloneAsync(id, body.NewName, userId.Value, ct);
        return Ok(newId);
    }

    [HttpPut("api/advertisement-templates/{id:guid}")]
    [PageAccess("recruitment.pi-manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await templates.UpdateAsync(
            id, body.Name,
            body.Sections.Select(s => new AdvertisementTemplateSectionInput(s.Key, s.Content, s.IsIncluded, s.SortOrder)).ToList(),
            userId.Value, ct);
        return NoContent();
    }

    [HttpDelete("api/advertisement-templates/{id:guid}")]
    [PageAccess("recruitment.pi-manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await templates.DeleteAsync(id, userId.Value, ct);
        return NoContent();
    }

    /// <summary>
    /// Resolves a template's tokens against one specific recruitment. Scoped by
    /// <c>recruitment.detail</c> like every other recruitment-scoped PI action in
    /// <see cref="RecruitmentController"/>, and -- critically -- verifies the
    /// caller owns the PROJECT behind <paramref name="recruitmentRequestId"/>
    /// before ever calling <see cref="IAdvertisementTemplateService.ResolveAsync"/>.
    /// </summary>
    /// <remarks>
    /// <see cref="AdvertisementTemplateService.ResolveAsync"/> only checks that
    /// the caller owns the TEMPLATE; it never checks who owns the recruitment's
    /// project, because it was written before any caller could reach it. Now
    /// that this endpoint reaches it, a caller could otherwise pass any other
    /// PI's <c>recruitmentRequestId</c> together with the shared system-default
    /// template and read that PI's project/recruitment data back through the
    /// resolved tokens. This mirrors
    /// <c>RecruitmentService.LoadOwnedProjectAsync</c>'s ownership check exactly:
    /// look up the recruitment's project and throw
    /// <see cref="ProjectAccessDeniedException"/> (mapped to 403 by
    /// <c>ProjectExceptionMiddleware</c>) unless <c>project.OwnerUserId</c>
    /// equals the caller. A missing recruitment likewise throws
    /// <see cref="ProjectAccessDeniedException"/> rather than leaking whether
    /// the id exists, matching that helper's not-found-collapses-into-denied
    /// behavior.
    /// </remarks>
    [HttpPost("api/advertisement-templates/{id:guid}/resolve/{recruitmentRequestId:guid}")]
    [PageAccess("recruitment.detail")]
    public async Task<ActionResult<ResolvedTemplateResponse>> Resolve(
        Guid id, Guid recruitmentRequestId, [FromBody] ResolveTemplateRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await EnsureOwnsRecruitmentProjectAsync(recruitmentRequestId, userId.Value, ct);

        var resolved = await templates.ResolveAsync(id, recruitmentRequestId, userId.Value, body.AdvertisementNo, body.AdvertisementDate, ct);
        return Ok(new ResolvedTemplateResponse(
            resolved.Sections.Select(s => new ResolvedSectionResponse(s.Key, s.Content, s.IsIncluded, s.SortOrder)).ToList(),
            resolved.UnresolvedTokens));
    }

    /// <summary>
    /// Same ownership check as <c>RecruitmentService.LoadOwnedProjectAsync</c>
    /// (project not found, or found but owned by someone else, both throw
    /// <see cref="ProjectAccessDeniedException"/>) -- applied here against the
    /// recruitment's project rather than a project id directly, since Resolve
    /// is addressed by recruitmentRequestId.
    /// </summary>
    private async Task EnsureOwnsRecruitmentProjectAsync(Guid recruitmentRequestId, Guid userId, CancellationToken ct)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new ProjectAccessDeniedException(recruitmentRequestId);

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, ct)
            ?? throw new ProjectAccessDeniedException(request.ProjectId);

        if (project.OwnerUserId != userId)
        {
            throw new ProjectAccessDeniedException(project.Id);
        }
    }

    private static AdvertisementTemplateResponse ToResponse(AdvertisementTemplateSummary t) => new(
        t.Id, t.Name, t.IsSystemDefault, t.IsOwnedByCaller,
        t.Sections.Select(s => new AdvertisementTemplateSectionResponse(s.Id, s.Key, s.Content, s.IsIncluded, s.SortOrder)).ToList());
}
