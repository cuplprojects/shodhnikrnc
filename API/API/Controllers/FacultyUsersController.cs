using API.Application.FacultyUsers;
using API.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// User-creation as an assignable permission (BRD Prompt 6 / A11), not a
/// hardcoded role: gated to the existing <c>faculty-admin.create</c> page
/// grant, seeded to Office roles by default and editable per-role/per-user
/// via AdminAccessController without a redeploy -- the same mechanism every
/// other controller here already uses. Previously this controller carried
/// no authorization at all; GetAll/GetByUserId leaked every faculty profile
/// to an unauthenticated caller. One class-level gate, matching this
/// codebase's own convention of a single [PageAccess] per controller rather
/// than a finer read/write split (see ProjectsController's precedent).
/// </summary>
[ApiController]
[Route("api/faculty-users")]
[Authorize]
public class FacultyUsersController(IFacultyUserService facultyUserService) : ControllerBase
{
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<FacultyProfileResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var profiles = await facultyUserService.GetAllFacultyProfilesAsync(cancellationToken);
        return Ok(profiles);
    }

    [HttpGet("brief")]
    public async Task<ActionResult<IReadOnlyList<FacultyProfileResponse>>> GetBrief(CancellationToken cancellationToken)
    {
        var profiles = await facultyUserService.GetAllFacultyProfilesAsync(cancellationToken);
        return Ok(profiles);
    }

    [HttpGet("{userId}")]
    [Authorize]
    public async Task<ActionResult<FacultyProfileResponse>> GetByUserId(string userId, CancellationToken cancellationToken)
    {
        var profile = await facultyUserService.GetFacultyProfileByUserIdAsync(userId, cancellationToken);
        if (profile is null)
        {
            return NotFound(new { detail = $"Faculty user with ID '{userId}' not found." });
        }

        return Ok(profile);
    }

    [HttpPost]
    [PageAccess("faculty-admin.create")]
    public async Task<ActionResult<FacultyProfileResponse>> Create([FromBody] CreateFacultyUserRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await facultyUserService.CreateFacultyUserAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetByUserId), new { userId = result.UserId }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            var message = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
            return StatusCode(500, new { detail = message });
        }
    }
}
