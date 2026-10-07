using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CarouselSlidesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;
        private readonly ILogger<CarouselSlidesController> _logger;

        public CarouselSlidesController(RMSDbContext context, IFileStorageService fileStorage, ILogger<CarouselSlidesController> logger)
        {
            _context = context;
            _fileStorage = fileStorage;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/CarouselSlides
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CarouselSlide>>> GetCarouselSlides()
        {
            try
            {
                var slides = await _context.CarouselSlides
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.DisplayOrder)
                    .ThenByDescending(s => s.Id)
                    .ToListAsync();

                return Ok(new { success = true, data = slides });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving carousel slides");
                return StatusCode(500, new { success = false, message = "Error retrieving carousel slides", error = ex.Message });
            }
        }

        // GET: api/CarouselSlides/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CarouselSlide>> GetCarouselSlide(int id)
        {
            try
            {
                var slide = await _context.CarouselSlides.FindAsync(id);

                if (slide == null)
                {
                    return NotFound(new { success = false, message = "Carousel slide not found" });
                }

                return Ok(new { success = true, data = slide });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving carousel slide");
                return StatusCode(500, new { success = false, message = "Error retrieving carousel slide", error = ex.Message });
            }
        }

        // POST: api/CarouselSlides
        [HttpPost]
        public async Task<ActionResult<CarouselSlide>> PostCarouselSlide([FromForm] string caption, [FromForm] int displayOrder = 0, IFormFile? imageFile = null)
        {
            try
            {
                var currentUser = GetCurrentUser();

                // Validate required fields
                if (string.IsNullOrWhiteSpace(caption))
                {
                    return BadRequest(new { success = false, message = "Caption is required" });
                }

                // Handle image upload using FileStorageService
                string? imagePath = null;
                if (imageFile != null)
                {
                    _logger.LogInformation($"Processing image file: {imageFile.FileName}, Size: {imageFile.Length} bytes");
                    try
                    {
                        // Validate file type
                        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                        var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
                        
                        if (!allowedExtensions.Contains(fileExtension))
                        {
                            return BadRequest(new { success = false, message = "Invalid file type. Only image files are allowed." });
                        }

                        // Validate file size (max 5MB)
                        if (imageFile.Length > 5 * 1024 * 1024)
                        {
                            return BadRequest(new { success = false, message = "File size too large. Maximum size is 5MB." });
                        }

                        imagePath = await _fileStorage.SaveAsync(
                            imageFile,
                            subFolder: "carousel",
                            filePrefix: $"CAROUSEL_{DateTime.UtcNow:yyyyMMddHHmmss}"
                        );
                        _logger.LogInformation($"Image saved to: {imagePath}");
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(new { success = false, message = ex.Message });
                    }
                }
                else
                {
                    return BadRequest(new { success = false, message = "Image file is required" });
                }

                var slide = new CarouselSlide
                {
                    Caption = caption,
                    DisplayOrder = displayOrder,
                    Image = imagePath,
                    IsActive = true
                };

                _logger.LogInformation($"Attempting to save carousel slide with caption: {caption}");
                _context.CarouselSlides.Add(slide);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Successfully saved carousel slide with ID: {slide.Id}");

                return CreatedAtAction("GetCarouselSlide", new { id = slide.Id }, new { success = true, data = slide });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating carousel slide. Inner exception: {InnerException}", ex.InnerException?.Message);
                
                // Get more detailed error information
                var errorMessage = ex.Message;
                if (ex.InnerException != null)
                {
                    errorMessage += $" Inner: {ex.InnerException.Message}";
                    if (ex.InnerException.InnerException != null)
                    {
                        errorMessage += $" Inner2: {ex.InnerException.InnerException.Message}";
                    }
                }
                
                return StatusCode(500, new { success = false, message = "Error creating carousel slide", error = errorMessage });
            }
        }

        // PUT: api/CarouselSlides/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCarouselSlide(int id, [FromForm] string caption, [FromForm] int displayOrder = 0, IFormFile? imageFile = null)
        {
            try
            {
                var existingSlide = await _context.CarouselSlides.FindAsync(id);
                if (existingSlide == null)
                {
                    return NotFound(new { success = false, message = "Carousel slide not found" });
                }

                var currentUser = GetCurrentUser();

                // Validate required fields
                if (string.IsNullOrWhiteSpace(caption))
                {
                    return BadRequest(new { success = false, message = "Caption is required" });
                }

                // Handle image upload using FileStorageService
                if (imageFile != null)
                {
                    // Validate file type
                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                    var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
                    
                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        return BadRequest(new { success = false, message = "Invalid file type. Only image files are allowed." });
                    }

                    // Validate file size (max 5MB)
                    if (imageFile.Length > 5 * 1024 * 1024)
                    {
                        return BadRequest(new { success = false, message = "File size too large. Maximum size is 5MB." });
                    }

                    if (!string.IsNullOrWhiteSpace(existingSlide.Image))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(imageFile, existingSlide.Image);
                    }
                    else
                    {
                        // First-time upload
                        existingSlide.Image = await _fileStorage.SaveAsync(
                            imageFile,
                            subFolder: "carousel",
                            filePrefix: $"CAROUSEL_{id}"
                        );
                    }
                }
                else if (string.IsNullOrWhiteSpace(existingSlide.Image))
                {
                    return BadRequest(new { success = false, message = "Image is required" });
                }

                existingSlide.Caption = caption;
                existingSlide.DisplayOrder = displayOrder;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingSlide });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CarouselSlideExists(id))
                {
                    return NotFound(new { success = false, message = "Carousel slide not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating carousel slide");
                return StatusCode(500, new { success = false, message = "Error updating carousel slide", error = ex.Message });
            }
        }

        // DELETE: api/CarouselSlides/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCarouselSlide(int id)
        {
            try
            {
                var slide = await _context.CarouselSlides.FindAsync(id);
                if (slide == null)
                {
                    return NotFound(new { success = false, message = "Carousel slide not found" });
                }

                // Note: FileStorageService handles file deletion internally when needed
                // No manual file deletion required

                _context.CarouselSlides.Remove(slide);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Carousel slide deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting carousel slide");
                return StatusCode(500, new { success = false, message = "Error deleting carousel slide", error = ex.Message });
            }
        }

        private bool CarouselSlideExists(int id)
        {
            return _context.CarouselSlides.Any(e => e.Id == id);
        }
    }
}