using API.Application.Access;
using API.Contracts.Access;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// What the signed-in user may reach. The sidebar and the route guard both
/// read this rather than deciding for themselves.
/// </summary>
[ApiController]
[Route("api/my")]
[Authorize]
public class MyAccessController(IPageAccessService pageAccess) : ControllerBase
{
    /// <summary>
    /// The user's pages, grouped by module and ordered for the sidebar.
    /// </summary>
    /// <remarks>
    /// Non-navigable pages are included. The sidebar filters them out, but the
    /// route guard needs them -- a project detail page has no link and still
    /// must be reachable by the people who may open it.
    /// </remarks>
    [HttpGet("pages")]
    public async Task<ActionResult<MyPagesResponse>> GetPages(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var pages = await pageAccess.GetPagesForUserAsync(userId.Value, ct);

        var modules = pages
            .GroupBy(p => new { p.ModuleKey, p.ModuleName, p.ModuleGroup, p.ModuleOrder })
            .OrderBy(g => g.Key.ModuleOrder)
            .Select(g => new MyModuleResponse(
                g.Key.ModuleKey,
                g.Key.ModuleName,
                g.Key.ModuleGroup,
                g.OrderBy(p => p.PageOrder)
                    .Select(p => new MyPageResponse(
                        p.PageKey, p.PageName, p.Route, p.IsNavigable, p.Scope))
                    .ToList()))
            .ToList();

        return Ok(new MyPagesResponse(modules));
    }
}
