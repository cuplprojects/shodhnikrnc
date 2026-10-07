using API.Application.Departments;
using API.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// The department master. Reading the active list requires no account --
/// the Faculty self-registration form (LoginPage.jsx) needs it before the
/// registrant has one -- while every other action, including reading the
/// full list, stays gated: managing the list (create, edit, deactivate, or
/// seeing inactive rows) to content.departments, matching
/// FundingAgenciesController's read/write split.
/// </summary>
[ApiController]
[Route("api/departments")]
[Authorize]
public class DepartmentsController(IDepartmentService departmentService) : ControllerBase
{
    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<ActiveDepartmentResponse>>> ListActive(CancellationToken ct)
    {
        var result = await departmentService.ListActiveAsync(ct);

        // Trimmed to ActiveDepartmentResponse here, not in DepartmentService: this
        // action is now reachable anonymously (see the class remarks), and
        // HeadUserId -- an internal ApplicationUser id -- has no reason to be
        // readable by an unauthenticated caller. No dropdown consumer of this
        // endpoint has ever used it.
        return Ok(result.Select(d => new ActiveDepartmentResponse(
            d.Id, d.Code, d.Name, d.IsInstituteWide, d.IsActive)).ToList());
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<DepartmentResponse>>> ListAll(CancellationToken ct)
    {
        var result = await departmentService.ListAllAsync(ct);
        return Ok(result);
    }

    [HttpPost]
    [PageAccess("content.departments")]
    public async Task<ActionResult<DepartmentResponse>> Create(
        [FromBody] CreateDepartmentRequest request, CancellationToken ct)
    {
        var result = await departmentService.CreateAsync(request, ct);
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [PageAccess("content.departments")]
    public async Task<ActionResult<DepartmentResponse>> Update(
        Guid id, [FromBody] UpdateDepartmentRequest request, CancellationToken ct)
    {
        var result = await departmentService.UpdateAsync(id, request, ct);
        return Ok(result);
    }
}
