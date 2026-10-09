using API.Application.Announcements;
using API.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

public class UploadAnnouncementPdfRequest
{
    public required IFormFile File { get; set; }
}

/// <summary>
/// Announcements are public notices, so reads are anonymous. Writes are not:
/// they arrived unauthenticated, which left create, update, delete and PDF
/// upload open to anyone who could reach the API. Gated to content.announcements
/// (Office + Director), a database-backed permission a SuperAdmin can widen or
/// narrow from /admin/roles, matching the "Manage Announcements" sidebar entry.
/// </summary>
[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsController(
    IAnnouncementService announcementService,
    IWebHostEnvironment environment) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AnnouncementResponse>>> GetAll(
        [FromQuery] string? category,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var result = await announcementService.GetAllAsync(category, status, cancellationToken);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<AnnouncementResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var result = await announcementService.GetByIdAsync(id, cancellationToken);
        if (result is null)
        {
            return NotFound(new { detail = $"Announcement with ID '{id}' not found." });
        }

        return Ok(result);
    }

    [HttpPost]
    [PageAccess("content.announcements")]
    public async Task<ActionResult<AnnouncementResponse>> Create(
        [FromBody] CreateAnnouncementRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await announcementService.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            var message = ex.GetBaseException().Message;
            return StatusCode(500, new { detail = message });
        }
    }

    [HttpPut("{id:int}")]
    [PageAccess("content.announcements")]
    public async Task<ActionResult<AnnouncementResponse>> Update(
        int id,
        [FromBody] UpdateAnnouncementRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await announcementService.UpdateAsync(id, request, cancellationToken);
            if (result is null)
            {
                return NotFound(new { detail = $"Announcement with ID '{id}' not found." });
            }

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            var message = ex.GetBaseException().Message;
            return StatusCode(500, new { detail = message });
        }
    }

    [HttpDelete("{id:int}")]
    [PageAccess("content.announcements")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var success = await announcementService.DeleteAsync(id, cancellationToken);
        if (!success)
        {
            return NotFound(new { detail = $"Announcement with ID '{id}' not found." });
        }

        return NoContent();
    }

    /// <summary>Cap on an uploaded announcement PDF. Rejected before anything is written to disk.</summary>
    private const long MaxPdfBytes = 10 * 1024 * 1024;

    /// <summary>"%PDF-" — the header every PDF begins with.</summary>
    private static readonly byte[] PdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D];

    // No [FromForm] on the IFormFile parameter: Swashbuckle cannot generate an
    // operation for that combination and throws while building the Swagger
    // document, which takes out the whole /swagger endpoint rather than just
    // this operation. ASP.NET binds IFormFile from multipart form data without
    // it, so the attribute was redundant as well as breaking.
    [HttpPost("upload-pdf")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxPdfBytes)]
    public async Task<IActionResult> UploadPdf([FromForm] UploadAnnouncementPdfRequest request, CancellationToken cancellationToken)
    {
        var file = request.File;
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { detail = "No file uploaded." });
        }

        if (file.Length > MaxPdfBytes)
        {
            return BadRequest(new { detail = $"The file exceeds the {MaxPdfBytes / (1024 * 1024)} MB limit." });
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".pdf")
        {
            return BadRequest(new { detail = "Only PDF files are allowed." });
        }

        // The extension is caller-supplied, so it says nothing about the bytes.
        // Read the header before writing anything to disk: without this, any
        // payload renamed to .pdf is accepted and stored under wwwroot.
        if (!await HasPdfHeaderAsync(file, cancellationToken))
        {
            return BadRequest(new { detail = "The file is not a valid PDF." });
        }

        var uploadsFolder = Path.Combine(environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "announcements");
        Directory.CreateDirectory(uploadsFolder);

        // Guid name, fixed directory: the caller's filename never reaches the path.
        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        var relativePath = $"uploads/announcements/{uniqueFileName}";
        return Ok(new { pdfPath = relativePath });
    }

    private static async Task<bool> HasPdfHeaderAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var header = new byte[PdfMagic.Length];
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        return read == header.Length && header.SequenceEqual(PdfMagic);
    }
}
