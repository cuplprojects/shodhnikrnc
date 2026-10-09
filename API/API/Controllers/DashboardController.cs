using API.Application.Dashboard;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// The signed-in user's cross-request-type "pending my action" panel,
/// backing the Dashboard's Pending Actions tile.
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(IDashboardService dashboard) : ControllerBase
{
    [HttpGet("pending-actions")]
    public async Task<ActionResult<IReadOnlyList<PendingActionItem>>> GetPendingActions(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var roles = User.GetRoles();
        var items = await dashboard.ListPendingActionsAsync(userId.Value, roles, ct);
        return Ok(items);
    }
}
