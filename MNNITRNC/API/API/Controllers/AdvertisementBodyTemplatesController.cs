using API.Application.Recruitment;
using API.Authorization;
using API.Contracts.Recruitment;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// A PI's saved advertisement bodies -- the raw rich-text HTML from the
/// "Generate Advertisement" editor, named and reusable across different
/// recruitments. Every template here is private to the PI who saved it.
/// </summary>
[ApiController]
[Authorize]
[Route("api/advertisement-body-templates")]
public class AdvertisementBodyTemplatesController(IAdvertisementBodyTemplateService templates) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdvertisementBodyTemplateResponse>>> List(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var result = await templates.ListForUserAsync(userId.Value, ct);
        return Ok(result.Select(t => new AdvertisementBodyTemplateResponse(t.Id, t.Name, t.HtmlBody, t.CreatedAt)).ToList());
    }

    [HttpPost]
    [PageAccess("recruitment.pi-manage")]
    public async Task<ActionResult<Guid>> Create([FromBody] CreateAdvertisementBodyTemplateRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var id = await templates.CreateAsync(userId.Value, body.Name, body.HtmlBody, ct);
        return Ok(id);
    }

    [HttpDelete("{id:guid}")]
    [PageAccess("recruitment.pi-manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await templates.DeleteAsync(id, userId.Value, ct);
        return NoContent();
    }
}
