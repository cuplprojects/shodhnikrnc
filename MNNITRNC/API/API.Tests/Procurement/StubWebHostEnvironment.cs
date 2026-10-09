using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace API.Tests.Procurement;

/// <summary>
/// A minimal IWebHostEnvironment for controller tests that write uploaded
/// files (e.g. RecruitmentController.UploadAdvertisementImage) -- points
/// WebRootPath at a fresh temp directory per instance so test writes never
/// touch the real repo's wwwroot.
/// </summary>
public sealed class StubWebHostEnvironment : IWebHostEnvironment
{
    public StubWebHostEnvironment()
    {
        WebRootPath = Path.Combine(Path.GetTempPath(), "api-tests-wwwroot", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(WebRootPath);
    }

    public string WebRootPath { get; set; }
    public IFileProvider WebRootFileProvider { get; set; } = null!;
    public string ApplicationName { get; set; } = "API.Tests";
    public IFileProvider ContentRootFileProvider { get; set; } = null!;
    public string ContentRootPath { get; set; } = Path.GetTempPath();
    public string EnvironmentName { get; set; } = "Testing";
}
