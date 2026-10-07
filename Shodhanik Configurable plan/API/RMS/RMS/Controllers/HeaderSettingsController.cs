using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HeaderSettingsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;
        private readonly ILogger<HeaderSettingsController> _logger;
        private readonly IWebHostEnvironment _environment;

        public HeaderSettingsController(RMSDbContext context, IFileStorageService fileStorage, ILogger<HeaderSettingsController> logger, IWebHostEnvironment environment)
        {
            _context = context;
            _fileStorage = fileStorage;
            _logger = logger;
            _environment = environment;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        [HttpGet]
        public async Task<ActionResult<HeaderSettings>> GetHeaderSettings()
        {
            try
            {
                var settings = await _context.HeaderSettings
                    .Where(h => h.IsActive)
                    .FirstOrDefaultAsync();

                if (settings == null)
                {
                    return NotFound(new { success = false, message = "Header settings not found" });
                }

                return Ok(new { success = true, data = settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving header settings");
                return StatusCode(500, new { success = false, message = "Error retrieving header settings", error = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<HeaderSettings>> GetHeaderSettingsById(int id)
        {
            try
            {
                var settings = await _context.HeaderSettings.FindAsync(id);

                if (settings == null)
                {
                    return NotFound(new { success = false, message = "Header settings not found" });
                }

                return Ok(new { success = true, data = settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving header settings");
                return StatusCode(500, new { success = false, message = "Error retrieving header settings", error = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<HeaderSettings>> UpdateHeaderSettings(int id, [FromForm] HeaderSettings headerSettings, IFormFile? logoFile = null, IFormFile? rmsLogoFile = null)
        {
            try
            {
                if (id != headerSettings.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingSettings = await _context.HeaderSettings.FindAsync(id);
                if (existingSettings == null)
                {
                    return NotFound(new { success = false, message = "Header settings not found" });
                }

                var currentUser = GetCurrentUser();
                
                // Handle file uploads using FileStorageService
                if (logoFile != null)
                {
                    // Validate file type
                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".svg" };
                    var fileExtension = Path.GetExtension(logoFile.FileName).ToLowerInvariant();
                    
                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        return BadRequest(new { success = false, message = "Invalid logo file type. Only image files are allowed." });
                    }

                    if (!string.IsNullOrWhiteSpace(existingSettings.Logo))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(logoFile, existingSettings.Logo);
                    }
                    else
                    {
                        // First-time upload
                        existingSettings.Logo = await _fileStorage.SaveAsync(
                            logoFile,
                            subFolder: "header",
                            filePrefix: $"LOGO_{id}"
                        );
                    }
                }
                
                if (rmsLogoFile != null)
                {
                    // Validate file type
                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".svg" };
                    var fileExtension = Path.GetExtension(rmsLogoFile.FileName).ToLowerInvariant();
                    
                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        return BadRequest(new { success = false, message = "Invalid RMS logo file type. Only image files are allowed." });
                    }

                    if (!string.IsNullOrWhiteSpace(existingSettings.RmsLogo))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(rmsLogoFile, existingSettings.RmsLogo);
                    }
                    else
                    {
                        // First-time upload
                        existingSettings.RmsLogo = await _fileStorage.SaveAsync(
                            rmsLogoFile,
                            subFolder: "header",
                            filePrefix: $"RMSLOGO_{id}"
                        );
                    }
                }

                // Update properties
                existingSettings.UniversityNameHindi = headerSettings.UniversityNameHindi;
                existingSettings.UniversityNameEnglish = headerSettings.UniversityNameEnglish;
                existingSettings.UniversityFullNameHindi = headerSettings.UniversityFullNameHindi;
                existingSettings.UniversityFullNameEnglish = headerSettings.UniversityFullNameEnglish;
                existingSettings.ApprovalText = headerSettings.ApprovalText;
                existingSettings.WebsiteTitle = headerSettings.WebsiteTitle;
                existingSettings.Helpline = headerSettings.Helpline;
                existingSettings.Email = headerSettings.Email;
                existingSettings.WorkingHours = headerSettings.WorkingHours;
                existingSettings.TopBarColor = headerSettings.TopBarColor;
                existingSettings.NavBarColor = headerSettings.NavBarColor;


                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating header settings");
                return StatusCode(500, new { success = false, message = "Error updating header settings", error = ex.Message });
            }
        }

        [HttpPost]
        public async Task<ActionResult<HeaderSettings>> CreateHeaderSettings([FromForm] HeaderSettings headerSettings, IFormFile? logoFile = null, IFormFile? rmsLogoFile = null)
        {
            try
            {
                // Check if settings already exist
                var existingSettings = await _context.HeaderSettings.AnyAsync(h => h.IsActive);
                if (existingSettings)
                {
                    return Conflict(new { success = false, message = "Header settings already exist. Use PUT to update." });
                }

                var currentUser = GetCurrentUser();
                
                // Handle file uploads using FileStorageService
                if (logoFile != null)
                {
                    // Validate file type
                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".svg" };
                    var fileExtension = Path.GetExtension(logoFile.FileName).ToLowerInvariant();
                    
                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        return BadRequest(new { success = false, message = "Invalid logo file type. Only image files are allowed." });
                    }

                    headerSettings.Logo = await _fileStorage.SaveAsync(
                        logoFile,
                        subFolder: "header",
                        filePrefix: "LOGO_NEW"
                    );
                }
                
                if (rmsLogoFile != null)
                {
                    // Validate file type
                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".svg" };
                    var fileExtension = Path.GetExtension(rmsLogoFile.FileName).ToLowerInvariant();
                    
                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        return BadRequest(new { success = false, message = "Invalid RMS logo file type. Only image files are allowed." });
                    }

                    headerSettings.RmsLogo = await _fileStorage.SaveAsync(
                        rmsLogoFile,
                        subFolder: "header",
                        filePrefix: "RMSLOGO_NEW"
                    );
                }

                headerSettings.IsActive = true;

                _context.HeaderSettings.Add(headerSettings);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetHeaderSettings), new { success = true, data = headerSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating header settings");
                return StatusCode(500, new { success = false, message = "Error creating header settings", error = ex.Message });
            }
        }

        [HttpPost("reset")]
        public async Task<ActionResult> ResetHeaderSettings()
        {
            try
            {
                var existingSettings = await _context.HeaderSettings.Where(h => h.IsActive).ToListAsync();
                
                foreach (var setting in existingSettings)
                {
                    setting.IsActive = false;
                }

                // Create default settings
                var defaultSettings = new HeaderSettings
                {
                    UniversityNameHindi = "विश्वविद्यालय",
                    UniversityNameEnglish = "University",
                    WebsiteTitle = "University Website",
                    TopBarColor = "#0066cc",
                    NavBarColor = "#003366",
                    IsActive = true
                };

                _context.HeaderSettings.Add(defaultSettings);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Header settings reset to default successfully", data = defaultSettings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting header settings");
                return StatusCode(500, new { success = false, message = "Error resetting header settings", error = ex.Message });
            }
        }
    }
}