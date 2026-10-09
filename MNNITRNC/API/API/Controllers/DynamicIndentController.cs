using API.Application.Common;
using API.Application.Documents;
using API.Application.Procurement;
using API.Application.Projects;
using API.Contracts.Procurement;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Extensions;
using API.Infrastructure.DocumentGeneration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/indents/dynamic")]
public class DynamicIndentController(
    IDynamicIndentService indentService,
    IDynamicIndentDocumentGenerationService docGenService,
    IApplicationDbContext db,
    IDocumentStorageService storage,
    IIndentDetailQueryService detailQuery,
    IProjectService projectService) : ControllerBase
{
    /// <remarks>
    /// HeadSelectionsJson travels as a manually-deserialized string (the
    /// same reason CommitteeMembersJson.cs does the same thing -- a nested
    /// collection does not bind reliably from multipart form data), so it
    /// never goes through the MVC pipeline's AddJsonOptions
    /// (Program.cs) and its JsonStringEnumConverter registration. Without
    /// this, JsonSerializer.Deserialize's default options expect
    /// OverheadSubHead as a number, not the string ("Pdf"/"Ddf") every real
    /// client actually sends, and throw JsonException on every PDF/DDF
    /// selection.
    /// </remarks>
    private static readonly System.Text.Json.JsonSerializerOptions HeadSelectionsJsonOptions = new(System.Text.Json.JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    [HttpPost("raise")]
    public async Task<IActionResult> RaiseAsync([FromForm] RaiseDynamicIndentRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var itemsDto = System.Text.Json.JsonSerializer.Deserialize<List<DynamicIndentItemDto>>(request.ItemsJson ?? "[]") ?? [];
        var itemsInput = itemsDto.Select(i => new DynamicIndentItemInput(
            i.Name, i.IsConsumable, i.TechnicalSpecs, i.UnitOfMeasurement, i.Quantity, i.EstimatedCostInclTax
        )).ToList();

        var headSelectionsDto = System.Text.Json.JsonSerializer
            .Deserialize<List<IndentHeadSelectionDto>>(request.HeadSelectionsJson ?? "[]", HeadSelectionsJsonOptions) ?? [];
        var headSelectionsInput = headSelectionsDto
            .Select(h => new IndentHeadSelectionInput(h.BudgetHeadId, h.SubHead, h.ManualAmount))
            .ToList();

        // A PDF/DDF selection's BudgetHeadId is client-supplied and otherwise
        // never checked against the project's real RecurringOverhead head --
        // without this, a malicious or buggy caller could pair SubHead: Pdf
        // with an arbitrary BudgetHeadId and misattribute (and validate) the
        // Indent's cost against a completely unrelated head's balance.
        if (headSelectionsDto.Any(h => h.SubHead is not null))
        {
            var overheadHeadId = await db.BudgetHeads
                .Where(b => b.ProjectId == request.ProjectId && b.HeadName == BudgetHeadName.RecurringOverhead)
                .Select(b => (Guid?)b.Id)
                .FirstOrDefaultAsync(ct);

            var mismatched = headSelectionsDto.Any(h =>
                h.SubHead is not null && (overheadHeadId is null || h.BudgetHeadId != overheadHeadId.Value));

            if (mismatched)
            {
                return BadRequest("A PDF/DDF selection's BudgetHeadId does not match the project's RecurringOverhead budget head.");
            }
        }

        byte[]? ReadFormFile(Microsoft.AspNetCore.Http.IFormFile? file)
        {
            if (file is null) return null;
            using var ms = new MemoryStream();
            file.CopyTo(ms);
            return ms.ToArray();
        }

        var input = new RaiseDynamicIndentInput(
            request.IsRule166,
            request.ProjectId,
            headSelectionsInput,
            request.IndentType,
            request.GemAvailability,
            request.GemCategoryType,
            request.StockAvailability,
            request.StockBookSerialNo,
            request.StockBookPage,
            request.StockBookDate,
            request.StockDescription,
            request.StockQuantity,
            request.StockActualCost,
            request.StockCondition,
            request.Purpose,
            request.PurposeOfAcquiring,
            request.InstallationRequired,
            request.TrainingRequired,
            request.QualificationCriterion,
            request.MaxDeliveryPeriod,
            request.NumberOfEnclosures,
            request.PerpetualLicense,
            request.NonAvailabilityCertificateNumber,
            request.NonAvailabilityCertificateIssueDate,
            request.NonAvailabilityCertificateValidityDate,
            request.QuotationDate,
            request.CommitteeFacultyUserId,
            request.BiddingNumber,
            request.BidPublicationDate,
            itemsInput,
            ReadFormFile(request.EstimatePdf),
            ReadFormFile(request.GemQuotation),
            ReadFormFile(request.PecCertificate),
            ReadFormFile(request.MacCertificate),
            ReadFormFile(request.PacCertificate),
            ReadFormFile(request.OtherSingleTenderDoc),
            ReadFormFile(request.NonAvailabilityCertificate)
        );

        var indentId = await indentService.RaiseAsync(input, userId.Value, ct);
        return Ok(new { IndentId = indentId });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<IndentDetailModel>> GetDetailAsync(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var detail = await detailQuery.GetAsync(id, ct);
        if (detail is null)
        {
            return NotFound();
        }

        // Detail includes per-head budget allocation amounts, so without a
        // gate any authenticated user could read another project's committed
        // and sanctioned figures via a guessed/enumerated indent id. Reuses
        // ProjectService.GetAsync's full visibility rule (owner, RnC Office
        // roles, HOD of the project's own department, active Fellow) rather
        // than re-deriving a narrower owner-or-Fellow-only check here --
        // GetAsync throws ProjectAccessDeniedException itself when none of
        // those hold, which ProjectExceptionMiddleware maps to 403.
        await projectService.GetAsync(detail.ProjectId, userId.Value, User.GetRoles(), ct);

        return Ok(detail);
    }

    [HttpGet("{id:guid}/document")]
    public async Task<IActionResult> DownloadDocumentAsync(Guid id, CancellationToken ct)
    {
        // 1. Check if there is an uploaded signed copy document in db.Documents
        var uploadedDoc = await db.Documents
            .Where(d => d.OwnerId == id && (d.Kind == DocumentKind.SignedCopy || d.Kind == DocumentKind.Indent))
            .OrderByDescending(d => d.UploadedAt)
            .FirstOrDefaultAsync(ct);

        if (uploadedDoc is not null)
        {
            var stream = await storage.OpenReadAsync(uploadedDoc.StoragePath);
            return File(stream, "application/pdf", $"Indent_{id}.pdf");
        }

        // 2. Otherwise return generated PDF
        var pdfBytes = await docGenService.GenerateIndentDocumentAsync(id, ct);
        return File(pdfBytes, "application/pdf", $"Indent_{id}.pdf");
    }

    [HttpPost("{id:guid}/upload-signed-pdf")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadSignedPdfAsync(Guid id, [FromForm] UploadIndentPdfRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var file = request.File;
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file uploaded.");
        }

        var documentId = Guid.NewGuid();
        await using var stream = file.OpenReadStream();
        var storagePath = await storage.SaveAsync(documentId, 1, stream, file.FileName, ct);

        var document = new Document
        {
            Id = documentId,
            OwnerType = "DynamicIndent",
            OwnerId = id,
            Kind = DocumentKind.SignedCopy,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = storagePath,
            UploadedByUserId = userId.Value,
            UploadedAt = DateTimeOffset.UtcNow,
        };

        db.Documents.Add(document);
        await db.SaveChangesAsync(ct);

        return Ok(new { DocumentId = documentId });
    }
}

public record UploadIndentPdfRequest(IFormFile File);
