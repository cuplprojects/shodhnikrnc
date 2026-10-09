using API.Application.Fellowship;
using API.Authorization;
using API.Contracts.Fellowship;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Authorize]
public class LeaveController(ILeaveService leave) : ControllerBase
{
    [HttpPost("api/leave-requests")]
    [PageAccess("leave.requests")]
    public async Task<ActionResult<Guid>> Raise(
        [FromBody] RaiseLeaveRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var id = await leave.RaiseLeaveAsync(
            new RaiseLeaveInput(body.LeaveType, body.Dates, body.OutOfStationDates, body.Purpose),
            userId.Value, ct);

        return Created($"/api/leave-requests/{id}", id);
    }

    [HttpPost("api/leave-requests/{id:guid}/withdraw")]
    public async Task<IActionResult> Withdraw(
        Guid id, [FromBody] WithdrawRequestBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

        await leave.CancelLeaveAsync(id, userId.Value, roles, body.Remarks ?? "Withdrawn by Fellow", ct);
        return NoContent();
    }

    [HttpGet("api/my/leave-requests")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<LeaveRequestSummary>>> MyRequests(
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await leave.ListOwnRequestsAsync(userId.Value, ct));
    }

    /// <summary>
    /// Entitled, consumed, pending and remaining. Pending is shown separately
    /// because it counts against the balance -- a fellow needs to see why their
    /// remaining allowance is lower than approved leave alone would suggest.
    /// </summary>
    [HttpGet("api/my/leave-balance")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<LeaveBalance>>> MyBalance(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await leave.GetBalanceAsync(userId.Value, ct));
    }

    /// <summary>
    /// All leave requests with scholar, project, and workflow details for
    /// review -- scoped to the caller's department (or institute-wide for an
    /// Office-group role whose own department is R&amp;C), matching this
    /// endpoint's real allowed roles (PageCatalogue.cs's hod.leaves grant).
    /// </summary>
    [HttpGet("api/leave-requests")]
    [Authorize(Roles = "Faculty,HOD,RegularStaff,Superintendent,DeputyRegistrar,Dean,Director,SuperAdmin")]
    public async Task<ActionResult<IReadOnlyList<LeaveRequestDetail>>> ListAll(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await leave.ListRequestsAsync(userId.Value, User.GetRoles(), ct));
    }

    /// <summary>
    /// Advances the consumed days once a request is approved. Called by the
    /// office after the workflow reaches Approved; the service refuses if it has
    /// not.
    /// </summary>
    [HttpPost("api/leave-requests/{id:guid}/consume")]
    [PageAccess("hod.leaves")]
    public async Task<IActionResult> Consume(Guid id, CancellationToken ct)
    {
        await leave.ConsumeOnApprovalAsync(id, ct);
        return NoContent();
    }

    public class RaiseCancellationBody
    {
        public List<DateOnly> DatesToCancel { get; set; } = [];
        [Required, MinLength(1)]
        public string Reason { get; set; } = "";
    }

    [HttpPost("api/leave-requests/{id:guid}/cancellations")]
    public async Task<IActionResult> RaiseCancellation(Guid id, [FromBody] RaiseCancellationBody body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var cancellationId = await leave.RaiseCancellationAsync(id, body.DatesToCancel, body.Reason, userId.Value, ct);
        return Ok(new { id = cancellationId });
    }

    [HttpPost("api/leave-cancellations/{id:guid}/refund")]
    [PageAccess("hod.leaves")]
    public async Task<IActionResult> Refund(Guid id, CancellationToken ct)
    {
        await leave.RefundOnCancellationApprovalAsync(id, ct);
        return NoContent();
    }
}
