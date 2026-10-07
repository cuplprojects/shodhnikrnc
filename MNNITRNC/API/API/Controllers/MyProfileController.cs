using API.Application.FacultyUsers;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Self-service profile completion -- scoped to the caller's own account,
/// no [PageAccess] gate beyond [Authorize], since this is inherently
/// "my own data." Distinct from FacultyUsersController, the admin-facing
/// directory tool.
/// </summary>
[ApiController]
[Route("api/my/profile")]
[Authorize]
public class MyProfileController(IMyProfileService myProfile, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MyProfileResponse>> Get(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await myProfile.GetAsync(userId.Value, ct));
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] SaveMyProfileRequest body, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await myProfile.SaveAsync(userId.Value, body, ct);
        return NoContent();
    }

    /// <summary>Cap on an uploaded profile photo. Rejected before anything is written to disk.</summary>
    private const long MaxPhotoBytes = 5 * 1024 * 1024;

    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];
    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];

    [HttpPost("photo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxPhotoBytes)]
    public async Task<ActionResult<MyProfilePhotoUploadResponse>> UploadPhoto(IFormFile file, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        if (file is null || file.Length == 0)
            return BadRequest(new { detail = "No file uploaded." });

        if (file.Length > MaxPhotoBytes)
            return BadRequest(new { detail = $"The file exceeds the {MaxPhotoBytes / (1024 * 1024)} MB limit." });

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".png" && extension != ".jpg" && extension != ".jpeg")
            return BadRequest(new { detail = "Only PNG or JPEG images are allowed." });

        if (!await HasImageHeaderAsync(file, ct))
            return BadRequest(new { detail = "The file is not a valid image." });

        var uploadsFolder = Path.Combine(
            environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            "uploads", "profile-photos");
        Directory.CreateDirectory(uploadsFolder);

        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadsFolder, uniqueFileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
            await file.CopyToAsync(stream, ct);

        return Ok(new MyProfilePhotoUploadResponse($"/uploads/profile-photos/{uniqueFileName}"));
    }

    private static async Task<bool> HasImageHeaderAsync(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var header = new byte[4];
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        if (read < 3) return false;

        return (header[0] == PngMagic[0] && header[1] == PngMagic[1] && header[2] == PngMagic[2] && read >= 4 && header[3] == PngMagic[3])
            || (header[0] == JpegMagic[0] && header[1] == JpegMagic[1] && header[2] == JpegMagic[2]);
    }
}
