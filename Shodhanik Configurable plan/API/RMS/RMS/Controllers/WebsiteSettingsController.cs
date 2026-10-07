using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WebsiteSettingsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<WebsiteSettingsController> _logger;

        public WebsiteSettingsController(RMSDbContext context, ILogger<WebsiteSettingsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/WebsiteSettings/all
        [HttpGet("all")]
        public async Task<ActionResult> GetAllWebsiteSettings()
        {
            try
            {
                var headerSettings = await _context.HeaderSettings
                    .Where(h => h.IsActive)
                    .FirstOrDefaultAsync();

                var bannerAnnouncements = await _context.BannerAnnouncements
                    .Where(b => b.IsActive)
                    .OrderBy(b => b.DisplayOrder)
                    .ToListAsync();

                var carouselSlides = await _context.CarouselSlides
                    .Where(c => c.IsActive)
                    .OrderBy(c => c.DisplayOrder)
                    .ToListAsync();

                var newsAnnouncements = await _context.NewsAnnouncements
                    .Where(n => n.IsActive)
                    .OrderByDescending(n => n.Date)
                    .Take(10)
                    .ToListAsync();

                var welcomeSection = await _context.WelcomeSections
                    .Where(w => w.IsActive)
                    .OrderByDescending(w => w.Id)
                    .FirstOrDefaultAsync();

                var leadershipTeam = await _context.LeadershipTeamMembers
                    .Where(l => l.IsActive)
                    .OrderBy(l => l.DisplayOrder)
                    .ToListAsync();

                var universityStatistics = await _context.UniversityStatistics
                    .Where(u => u.IsActive)
                    .OrderBy(u => u.DisplayOrder)
                    .ToListAsync();

                var noticeboardNotices = await _context.NoticeboardNotices
                    .Where(n => n.IsActive)
                    .OrderByDescending(n => n.Id)
                    .Take(10)
                    .ToListAsync();

                var programEvents = await _context.ProgramEvents
                    .Where(pe => pe.Status == "Active")
                    .OrderBy(pe => pe.DisplayOrder)
                    .ThenByDescending(pe => pe.CreatedAt)
                    .ToListAsync();

                var externalLinks = await _context.ExternalLinks
                    .Where(el => el.Status == "Active")
                    .OrderBy(el => el.DisplayOrder)
                    .ThenBy(el => el.Name)
                    .ToListAsync();

                var result = new
                {
                    success = true,
                    data = new
                    {
                        headerSettings,
                        bannerAnnouncements,
                        carouselSlides,
                        newsAnnouncements,
                        welcomeSection,
                        leadershipTeam,
                        universityStatistics,
                        noticeboardNotices,
                        programEvents,
                        externalLinks
                    }
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all website settings");
                return StatusCode(500, new { success = false, message = "Error retrieving website settings", error = ex.Message });
            }
        }

        // GET: api/WebsiteSettings/public
        [HttpGet("public")]
        public async Task<ActionResult> GetPublicWebsiteSettings()
        {
            try
            {
                var headerSettings = await _context.HeaderSettings
                    .Where(h => h.IsActive)
                    .Select(h => new
                    {
                        h.Id,
                        h.UniversityNameHindi,
                        h.UniversityNameEnglish,
                        h.UniversityFullNameHindi,
                        h.UniversityFullNameEnglish,
                        h.ApprovalText,
                        h.WebsiteTitle,
                        h.Helpline,
                        h.Email,
                        h.WorkingHours,
                        h.Logo,
                        h.RmsLogo,
                        h.TopBarColor,
                        h.NavBarColor
                    })
                    .FirstOrDefaultAsync();

                var bannerAnnouncements = await _context.BannerAnnouncements
                    .Where(b => b.IsActive && b.Status == "Active")
                    .OrderBy(b => b.DisplayOrder)
                    .Select(b => new
                    {
                        b.Id,
                        b.Title,
                        b.Category,
                        b.Language,
                        b.Date,
                        b.DisplayOrder
                    })
                    .ToListAsync();

                var carouselSlides = await _context.CarouselSlides
                    .Where(c => c.IsActive)
                    .OrderBy(c => c.DisplayOrder)
                    .Select(c => new
                    {
                        c.Id,
                        c.Image,
                        c.Caption,
                        c.DisplayOrder
                    })
                    .ToListAsync();

                var welcomeSection = await _context.WelcomeSections
                    .Where(w => w.IsActive)
                    .OrderByDescending(w => w.Id)
                    .Select(w => new
                    {
                        w.Id,
                        w.WelcomeTitle,
                        w.WelcomeText
                    })
                    .FirstOrDefaultAsync();

                var programEvents = await _context.ProgramEvents
                    .Where(pe => pe.Status == "Active")
                    .OrderBy(pe => pe.DisplayOrder)
                    .ThenByDescending(pe => pe.CreatedAt)
                    .Select(pe => new
                    {
                        pe.Id,
                        pe.Title,
                        pe.Image,
                        pe.Date,
                        pe.Description,
                        pe.Link,
                        pe.DisplayOrder
                    })
                    .ToListAsync();

                var externalLinks = await _context.ExternalLinks
                    .Where(el => el.Status == "Active")
                    .OrderBy(el => el.DisplayOrder)
                    .ThenBy(el => el.Name)
                    .Select(el => new
                    {
                        el.Id,
                        el.Name,
                        el.Url,
                        el.Category,
                        el.DisplayOrder
                    })
                    .ToListAsync();

                var result = new
                {
                    success = true,
                    data = new
                    {
                        headerSettings,
                        bannerAnnouncements,
                        carouselSlides,
                        welcomeSection,
                        programEvents,
                        externalLinks
                    }
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving public website settings");
                return StatusCode(500, new { success = false, message = "Error retrieving public website settings", error = ex.Message });
            }
        }

        // POST: api/WebsiteSettings/reset-all
        [HttpPost("reset-all")]
        public async Task<ActionResult> ResetAllWebsiteSettings()
        {
            try
            {
                var currentUser = User?.Identity?.Name ?? "system";

                // Deactivate all existing settings
                var allHeaderSettings = await _context.HeaderSettings.ToListAsync();
                foreach (var setting in allHeaderSettings)
                {
                    setting.IsActive = false;
                }

                var allBannerAnnouncements = await _context.BannerAnnouncements.ToListAsync();
                foreach (var announcement in allBannerAnnouncements)
                {
                    announcement.IsActive = false;
                }

                var allCarouselSlides = await _context.CarouselSlides.ToListAsync();
                foreach (var slide in allCarouselSlides)
                {
                    slide.IsActive = false;
                }

                var allWelcomeSections = await _context.WelcomeSections.ToListAsync();
                foreach (var section in allWelcomeSections)
                {
                    section.IsActive = false;
                }

                // Create default settings
                var defaultHeaderSettings = new HeaderSettings
                {
                    UniversityNameHindi = "विश्वविद्यालय",
                    UniversityNameEnglish = "University",
                    WebsiteTitle = "University Website",
                    TopBarColor = "#0066cc",
                    NavBarColor = "#003366",
                    IsActive = true
                };

                var defaultWelcomeSection = new WelcomeSection
                {
                    WelcomeTitle = "Welcome to Our University",
                    WelcomeText = "Welcome to our prestigious institution of higher learning.",
                    IsActive = true
                };

                _context.HeaderSettings.Add(defaultHeaderSettings);
                _context.WelcomeSections.Add(defaultWelcomeSection);

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "All website settings reset to default successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting all website settings");
                return StatusCode(500, new { success = false, message = "Error resetting website settings", error = ex.Message });
            }
        }
    }
}