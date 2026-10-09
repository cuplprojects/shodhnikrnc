using API.Application.Procurement;
using API.Contracts.Procurement;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Request mapping shared by the three indent controllers. Only the route and the
/// injected service differ between them.
/// </summary>
public abstract class IndentControllerBase(IIndentService indentService) : ControllerBase
{
    protected async Task<ActionResult<Guid>> RaiseCoreAsync(
        Guid projectId, RaiseIndentRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var input = new RaiseIndentInput(
            ProjectId: projectId,
            BudgetHeadId: request.BudgetHeadId,
            Name: request.Name,
            TechnicalSpecs: request.TechnicalSpecs,
            UnitOfMeasurement: request.UnitOfMeasurement,
            Quantity: request.Quantity,
            Purpose: request.Purpose,
            GemAvailability: request.GemAvailability,
            EstimatedCost: request.EstimatedCost,
            NonAvailabilityCertificateNumber: request.NonAvailabilityCertificateNumber,
            NonAvailabilityCertificateIssueDate: request.NonAvailabilityCertificateIssueDate,
            NonAvailabilityCertificateValidityDate: request.NonAvailabilityCertificateValidityDate,
            SanctionedEquipmentId: request.SanctionedEquipmentId,
            CommitteeMembers: CommitteeMembersJson.Parse(request.CommitteeMembersJson),
            GemQuotationPdf: await ReadFileAsync(request.GemQuotation, ct),
            PaymentRouting: request.PaymentRouting ?? "Party Payment",
            BiddingNumber: request.BiddingNumber,
            BidPublicationDate: request.BidPublicationDate,
            NacItemName: request.NacItemName,
            QuotationDate: request.QuotationDate);

        var indentId = await indentService.RaiseAsync(input, userId.Value, ct);
        return Created($"{Request.Path}/{indentId}", indentId);
    }

    protected async Task<ActionResult<IReadOnlyList<IndentListItemResponse>>> ListCoreAsync(
        Guid projectId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var summaries = await indentService.ListForProjectAsync(projectId, userId.Value, User.GetRoles(), ct);
        return Ok(summaries.Select(ToListItem).ToList());
    }

    protected async Task<ActionResult<IndentResponse>> GetCoreAsync(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var summary = await indentService.GetAsync(id, userId.Value, User.GetRoles(), ct);
        return Ok(ToResponse(summary));
    }

    protected async Task<IActionResult> ProcessBillCoreAsync(
        Guid id, ProcessBillRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var input = new ProcessBillInput(
            OriginalBillReference: request.OriginalBillReference ?? request.BillNumber ?? request.BillNo ?? string.Empty,
            StockEntryConfirmed: request.StockEntryConfirmed,
            EWayBillNumber: request.EWayBillNumber,
            MeasurementBookNumber: request.MeasurementBookNumber,
            StockBookPage: request.StockBookPage,
            StockDescription: request.StockDescription,
            StockQuantity: request.StockQuantity,
            StockActualCost: request.StockActualCost,
            StockCondition: request.StockCondition,
            MiscellaneousExpenditure: request.MiscellaneousExpenditure,
            PurchaseOrderNumber: request.PurchaseOrderNumber,
            PurchaseOrderDate: request.PurchaseOrderDate,
            BindingLocation: request.BindingLocation ?? "Prayagraj",
            ComparativeStatementNumber: request.ComparativeStatementNumber,
            ComparativeStatementSigned: request.ComparativeStatementSigned,
            EWayBillPartA: request.EWayBillPartA,
            EWayBillPartB: request.EWayBillPartB,
            BillNumber: request.BillNumber ?? request.BillNo ?? request.OriginalBillReference,
            BillAmount: request.BillAmount,
            GenerationDate: request.GenerationDate,
            ItemReceivingDate: request.ItemReceivingDate,
            BillProcessStatus: request.BillProcessStatus ?? "Submitted",
            BillFileUrl: request.BillFileUrl,
            EWayBillFileUrl: request.EWayBillFileUrl,
            SatisfactoryCertificateFileUrl: request.SatisfactoryCertificateFileUrl);


        await indentService.ProcessBillAsync(id, input, userId.Value, User.GetRoles(), ct);
        return NoContent();
    }

    protected async Task<IActionResult> ForwardCoreAsync(Guid id, RemarksRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.ForwardAsync(id, userId.Value, User.GetRoles(), request.Remarks, ct);
        return NoContent();
    }

    protected async Task<IActionResult> ForwardToDirectorCoreAsync(Guid id, RemarksRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.ForwardToDirectorAsync(id, userId.Value, User.GetRoles(), request.Remarks, ct);
        return NoContent();
    }

    protected async Task<IActionResult> ApproveCoreAsync(Guid id, RemarksRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.ApproveAsync(id, userId.Value, User.GetRoles(), request.Remarks, ct);
        return NoContent();
    }

    protected async Task<IActionResult> RejectCoreAsync(Guid id, RemarksRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.RejectAsync(id, userId.Value, User.GetRoles(), request.Remarks, ct);
        return NoContent();
    }

    protected async Task<IActionResult> ReturnCoreAsync(Guid id, RemarksRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.ReturnAsync(id, userId.Value, User.GetRoles(), request.Remarks, ct);
        return NoContent();
    }

    protected async Task<ActionResult<MarketCommitteeStepsResponse?>> GetMarketCommitteeStepsCoreAsync(
        Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var summary = await indentService.GetMarketCommitteeStepsAsync(id, ct);
        return Ok(summary is null
            ? null
            : new MarketCommitteeStepsResponse(
                summary.CommitteeFormedOn, summary.NoticeIssuedOn, summary.ComparativeStatementSignedOn,
                summary.IsComplete));
    }

    protected async Task<IActionResult> RecordMarketCommitteeStepCoreAsync(
        Guid id, RecordMarketCommitteeStepRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await indentService.RecordMarketCommitteeStepAsync(id, request.Step, request.RecordedOn, userId.Value,
            User.GetRoles(), ct);
        return NoContent();
    }

    private static async Task<byte[]?> ReadFileAsync(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return null;
        }

        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        return stream.ToArray();
    }

    private static IndentListItemResponse ToListItem(IndentSummary s) => new(
        s.Id, s.Name, s.EstimatedCost, s.GemAvailability, s.Tier, s.CurrentStage, s.CreatedAt, s.WorkflowInstanceId);

    private static IndentResponse ToResponse(IndentSummary s) => new(
        s.Id, s.ProjectId, s.BudgetHeadId, s.WorkflowInstanceId, s.Name,
        s.EstimatedCost, s.GemAvailability, s.Tier, s.CurrentStage, s.CreatedAt,
        s.PaymentRouting, s.MiscellaneousExpenditure, s.BiddingNumber, s.BidPublicationDate,
        s.PurchaseOrderNumber, s.PurchaseOrderDate, s.BindingLocation,
        s.ComparativeStatementNumber, s.ComparativeStatementSigned,
        s.OriginalBillReference, s.OriginalBillReference, s.OriginalBillReference,
        s.BillAmount, s.GenerationDate, s.ItemReceivingDate, s.BillProcessStatus,
        s.StockEntryConfirmed, s.EWayBillNumber, s.StockBookPage, s.StockDescription,
        s.StockQuantity, s.StockActualCost, s.StockCondition, s.MeasurementBookNumber,
        s.BillFileUrl, s.EWayBillFileUrl, s.SatisfactoryCertificateFileUrl,
        s.IndentNumber);

}
