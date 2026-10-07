using API.Application.Access;
using API.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/admin/user-management")]
[Authorize]
public class AdminUsersController(IAdminUsersService adminUsersService) : ControllerBase
{
    [HttpGet]
    [PageAccess("admin.users.manage")]
    public async Task<ActionResult<IReadOnlyList<AdminUserListItemResponse>>> GetAll(CancellationToken ct)
    {
        return Ok(await adminUsersService.GetAllAsync(ct));
    }

    [HttpPut("{id:guid}/employee-id")]
    [PageAccess("admin.users.manage")]
    public async Task<IActionResult> SetEmployeeId(Guid id, [FromBody] SetEmployeeIdRequest body, CancellationToken ct)
    {
        await adminUsersService.SetEmployeeIdAsync(id, body.EmployeeId, ct);
        return NoContent();
    }
}
