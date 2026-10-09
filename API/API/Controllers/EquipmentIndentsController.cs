using API.Application.Procurement;
using API.Authorization;
using API.Contracts.Procurement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
// Procurement access is configured, not compiled in: a SuperAdmin granting
// this page to another role takes effect without a redeploy.
// GET endpoints are open to any authenticated user; the service layer
// filters results to what the caller is allowed to see.
[Authorize]
public class EquipmentIndentsController(EquipmentIndentService indentService)
    : IndentControllerBase(indentService)
{
    /// <summary>
    /// Requires <c>SanctionedEquipmentId</c> on the request; the service rejects the
    /// raise otherwise, and also rejects equipment belonging to a different project.
    /// </summary>
    [HttpPost("api/projects/{projectId:guid}/equipment-indents")]
    [Consumes("multipart/form-data")]
    [PageAccess("procurement.list")]
    public Task<ActionResult<Guid>> Raise(
        Guid projectId, [FromForm] RaiseIndentRequest request, CancellationToken ct)
        => RaiseCoreAsync(projectId, request, ct);

    [HttpGet("api/projects/{projectId:guid}/equipment-indents")]
    public Task<ActionResult<IReadOnlyList<IndentListItemResponse>>> List(Guid projectId, CancellationToken ct)
        => ListCoreAsync(projectId, ct);

    [HttpGet("api/equipment-indents/{id:guid}")]
    public Task<ActionResult<IndentResponse>> Get(Guid id, CancellationToken ct)
        => GetCoreAsync(id, ct);

    /// <summary>Requires <c>MeasurementBookNumber</c> (BRD A7.4, equipment only).</summary>
    [HttpPost("api/equipment-indents/{id:guid}/process-bill")]
    [PageAccess("procurement.list")]
    public Task<IActionResult> ProcessBill(Guid id, [FromBody] ProcessBillRequest request, CancellationToken ct)
        => ProcessBillCoreAsync(id, request, ct);

    [HttpPost("api/equipment-indents/{id:guid}/forward")]
    public Task<IActionResult> Forward(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ForwardCoreAsync(id, request, ct);

    [HttpPost("api/equipment-indents/{id:guid}/forward-to-director")]
    public Task<IActionResult> ForwardToDirector(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ForwardToDirectorCoreAsync(id, request, ct);

    [HttpPost("api/equipment-indents/{id:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ApproveCoreAsync(id, request, ct);

    [HttpPost("api/equipment-indents/{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => RejectCoreAsync(id, request, ct);

    [HttpPost("api/equipment-indents/{id:guid}/return")]
    public Task<IActionResult> Return(Guid id, [FromBody] RemarksRequest request, CancellationToken ct)
        => ReturnCoreAsync(id, request, ct);

    [HttpGet("api/equipment-indents/{id:guid}/market-committee")]
    public Task<ActionResult<MarketCommitteeStepsResponse?>> GetMarketCommitteeSteps(Guid id, CancellationToken ct)
        => GetMarketCommitteeStepsCoreAsync(id, ct);

    [HttpPost("api/equipment-indents/{id:guid}/market-committee")]
    public Task<IActionResult> RecordMarketCommitteeStep(Guid id, [FromBody] RecordMarketCommitteeStepRequest request,
        CancellationToken ct)
        => RecordMarketCommitteeStepCoreAsync(id, request, ct);
}
