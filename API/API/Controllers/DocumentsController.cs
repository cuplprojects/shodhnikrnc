using API.Application.Audit;
using API.Application.Common;
using API.Application.Documents;
using API.Contracts.Documents;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController(
    IApplicationDbContext db,
    IDocumentStorageService storage,
    IDocumentChecklistService checklistService,
    IAuditService audit) : ControllerBase
{
    /// <summary>
    /// Which configured documents this request has and which it is missing.
    /// Advisory: nothing gates a workflow transition on the result.
    /// </summary>
    [HttpGet("checklist")]
    public async Task<ActionResult<DocumentChecklistResponse>> GetChecklist(
        [FromQuery] RequestType requestType,
        [FromQuery] WorkflowPhase phase,
        [FromQuery] Guid requestId,
        [FromQuery] string ownerType,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ownerType))
        {
            return BadRequest("ownerType is required.");
        }

        var result = await checklistService.GetChecklistAsync(requestType, phase, requestId, ownerType, ct);

        return Ok(new DocumentChecklistResponse(
            result.RequestType,
            result.Phase,
            result.RequestId,
            result.Items
                .Select(i => new DocumentChecklistItemResponse(
                    i.ChecklistItemId, i.Name, i.DocumentKind, i.IsMandatory, i.IsSatisfied, i.DisplayOrder,
                    i.DocumentId))
                .ToList()));
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<Guid>> Upload([FromForm] UploadDocumentRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var documentId = Guid.NewGuid();

        await using var stream = request.File.OpenReadStream();
        var storagePath = await storage.SaveAsync(documentId, 1, stream, request.File.FileName);

        var document = new Document
        {
            Id = documentId,
            OwnerType = request.OwnerType,
            OwnerId = request.OwnerId,
            Kind = request.Kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = storagePath,
            UploadedByUserId = userId.Value,
            UploadedAt = DateTimeOffset.UtcNow,
        };

        db.Documents.Add(document);
        await db.SaveChangesAsync(CancellationToken.None);

        // When SignedCopy is uploaded for an indent in stage Raised, automatically complete the step & advance to SignedCopyUploaded
        if (request.Kind == DocumentKind.SignedCopy)
        {
            var instance = await db.WorkflowInstances
                .Include(w => w.Steps)
                .FirstOrDefaultAsync(w => w.RequestId == request.OwnerId && w.Phase == WorkflowPhase.Indent);

            if (instance is null)
            {
                var indent = await db.Indents.FirstOrDefaultAsync(i => i.Id == request.OwnerId);
                if (indent != null)
                {
                    instance = await db.WorkflowInstances
                        .Include(w => w.Steps)
                        .FirstOrDefaultAsync(w => w.Id == indent.WorkflowInstanceId);
                }
            }

            if (instance != null && (instance.CurrentStage == WorkflowStage.Raised || instance.CurrentStage == WorkflowStage.WithPIFellowship))
            {
                instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
                var step = new WorkflowStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowInstanceId = instance.Id,
                    Stage = WorkflowStage.SignedCopyUploaded,
                    Action = WorkflowAction.UploadSignedCopy,
                    ActorUserId = userId.Value,
                    Remarks = "Signed copy uploaded",
                    IsInternal = true,
                    Timestamp = DateTimeOffset.UtcNow
                };
                instance.Steps.Add(step);
                db.WorkflowSteps.Add(step);
                await db.SaveChangesAsync(CancellationToken.None);
            }
        }

        return Ok(documentId);
    }

    private static string GetContentType(string filePath)
    {
        var ext = Path.GetExtension(filePath)?.ToLowerInvariant();
        return ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            _ => "application/octet-stream"
        };
    }

    /// <summary>
    /// Gets the most recent document IDs uploaded for a specific owner, grouped by kind.
    /// Used by UIs (like Candidate applications and Recruitment workflow) that do not use configured checklists.
    /// </summary>
    [HttpGet("owner/{ownerType}/{ownerId:guid}")]
    public async Task<ActionResult<Dictionary<string, Guid>>> GetByOwner(string ownerType, Guid ownerId, CancellationToken ct)
    {
        var documents = await db.Documents
            .Where(d => d.OwnerType == ownerType && d.OwnerId == ownerId)
            .GroupBy(d => d.Kind)
            .Select(g => new { Kind = g.Key.ToString(), DocumentId = g.OrderByDescending(d => d.UploadedAt).First().Id })
            .ToDictionaryAsync(x => x.Kind, x => x.DocumentId, ct);
            
        return Ok(documents);
    }

    [HttpGet("{id:guid}/download")]
    [AllowAnonymous]
    public async Task<IActionResult> Download(Guid id)
    {
        var document = await db.Documents.FindAsync(id);
        if (document is null)
        {
            return NotFound();
        }

        Stream stream;
        try
        {
            stream = await storage.OpenReadAsync(document.StoragePath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // The DB row exists but the underlying file could not be read --
            // most commonly a DocumentStorage:RootPath the app process
            // cannot reach (e.g. a UNC share ApplicationPoolIdentity has no
            // credentials for, including one on the app's own host machine).
            // Surfaced as a clear 503 rather than an unhandled 500, so this
            // is diagnosable from the client instead of a generic failure.
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                detail = "The document could not be read from storage. Document storage may be misconfigured or unreachable.",
            });
        }

        var contentType = GetContentType(document.StoragePath);
        return File(stream, contentType, Path.GetFileName(document.StoragePath));
    }

    /// <summary>
    /// Deletes an uploaded document, permanently -- the storage-service call
    /// and the row removal both happen, so re-uploading afterward creates a
    /// genuinely new Document row rather than resurrecting the old one.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        var document = await db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new DocumentNotFoundException(id);

        if (!await CanDeleteAsync(document, userId.Value, User.GetRoles(), db, ct))
        {
            throw new NotAuthorizedToDeleteDocumentException(id);
        }

        storage.Delete(document.StoragePath);
        db.Documents.Remove(document);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            "Document", document.Id, "Deleted", userId.Value,
            $"OwnerType={document.OwnerType};OwnerId={document.OwnerId};Kind={document.Kind}", ct);

        return NoContent();
    }

    /// <summary>
    /// Internal, but not private: exposed so DocumentDeleteTests can assert
    /// this rule directly without standing up an HTTP host.
    /// </summary>
    internal static async Task<bool> CanDeleteAsync(
        Document document, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        IApplicationDbContext db, CancellationToken ct = default)
    {
        // 1. The user who uploaded the document can delete it (e.g. replacing a photo/signature/cert during draft)
        if (document.UploadedByUserId == actorUserId)
        {
            return true;
        }

        // 2. Admins can delete documents
        if (actorRoles.Any(r => r.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || r.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        // 3. Candidate-owned documents: the applicant who owns the candidate row can delete
        if (document.OwnerType == "Candidate")
        {
            var isCandidateOwner = await db.Candidates.AnyAsync(c => c.Id == document.OwnerId && c.ApplicationUserId == actorUserId, ct);
            if (isCandidateOwner) return true;
        }

        // 4. ResearchProposal documents: office roles or proposal owner
        if (document.OwnerType == "ResearchProposal")
        {
            var isOfficeRole = actorRoles.Any(r =>
                r.Equals("Dean", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("DeputyRegistrar", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Superintendent", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("RegularStaff", StringComparison.OrdinalIgnoreCase));

            if (isOfficeRole)
            {
                return true;
            }

            var proposal = await db.ResearchProposals.FirstOrDefaultAsync(p => p.Id == document.OwnerId, ct);
            return proposal is not null && proposal.OwnerUserId == actorUserId;
        }

        return false;
    }
}
