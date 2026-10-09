using API.Application.FundingAgencies;
using API.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// The funding agency master behind the New Proposal dropdown. Reading the
/// active list only requires a signed-in account -- any Faculty member
/// creating a proposal needs it -- while managing the list (create, edit,
/// deactivate, or seeing inactive rows) is gated to content.funding-agencies,
/// matching AnnouncementsController's read/write split.
/// </summary>
[ApiController]
[Route("api/funding-agencies")]
[Authorize]
public class FundingAgenciesController(IFundingAgencyService fundingAgencyService) : ControllerBase
{
    [HttpGet("active")]
    public async Task<ActionResult<IReadOnlyList<FundingAgencyResponse>>> ListActive(CancellationToken ct)
    {
        var result = await fundingAgencyService.ListActiveAsync(ct);
        return Ok(result);
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<FundingAgencyResponse>>> ListAll(CancellationToken ct)
    {
        var result = await fundingAgencyService.ListAllAsync(ct);
        return Ok(result);
    }

    [HttpPost]
    [PageAccess("content.funding-agencies")]
    public async Task<ActionResult<FundingAgencyResponse>> Create(
        [FromBody] CreateFundingAgencyRequest request, CancellationToken ct)
    {
        var result = await fundingAgencyService.CreateAsync(request, ct);
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [PageAccess("content.funding-agencies")]
    public async Task<ActionResult<FundingAgencyResponse>> Update(
        Guid id, [FromBody] UpdateFundingAgencyRequest request, CancellationToken ct)
    {
        var result = await fundingAgencyService.UpdateAsync(id, request, ct);
        return Ok(result);
    }
}
