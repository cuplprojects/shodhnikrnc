using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LeadershipTeamMembersController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<LeadershipTeamMembersController> _logger;

        public LeadershipTeamMembersController(RMSDbContext context, IWebHostEnvironment environment, ILogger<LeadershipTeamMembersController> logger)
        {
            _context = context;
            _environment = environment;
            _logger = logger;
        }

        private string? GetCurrentUser()
        {
            return User?.Identity?.Name ?? "system";
        }

        // GET: api/LeadershipTeamMembers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LeadershipTeamMember>>> GetLeadershipTeamMembers()
        {
            try
            {
                var members = await _context.LeadershipTeamMembers
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.DisplayOrder)
                    .ToListAsync();

                return Ok(new { success = true, data = members });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leadership team members");
                return StatusCode(500, new { success = false, message = "Error retrieving leadership team members", error = ex.Message });
            }
        }

        // GET: api/LeadershipTeamMembers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<LeadershipTeamMember>> GetLeadershipTeamMember(int id)
        {
            try
            {
                var member = await _context.LeadershipTeamMembers.FindAsync(id);

                if (member == null)
                {
                    return NotFound(new { success = false, message = "Leadership team member not found" });
                }

                return Ok(new { success = true, data = member });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leadership team member");
                return StatusCode(500, new { success = false, message = "Error retrieving leadership team member", error = ex.Message });
            }
        }

        // POST: api/LeadershipTeamMembers
        [HttpPost]
        public async Task<ActionResult<LeadershipTeamMember>> PostLeadershipTeamMember([FromForm] LeadershipTeamMember member, IFormFile? imageFile = null)
        {
            try
            {
                var currentUser = GetCurrentUser();

                // Handle image upload
                if (imageFile != null)
                {
                    member.Image = await ConvertToBase64Async(imageFile);
                }

                member.IsActive = true;

                _context.LeadershipTeamMembers.Add(member);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetLeadershipTeamMember", new { id = member.Id }, new { success = true, data = member });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating leadership team member");
                return StatusCode(500, new { success = false, message = "Error creating leadership team member", error = ex.Message });
            }
        }

        // PUT: api/LeadershipTeamMembers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLeadershipTeamMember(int id, [FromForm] LeadershipTeamMember member, IFormFile? imageFile = null)
        {
            try
            {
                if (id != member.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                var existingMember = await _context.LeadershipTeamMembers.FindAsync(id);
                if (existingMember == null)
                {
                    return NotFound(new { success = false, message = "Leadership team member not found" });
                }

                var currentUser = GetCurrentUser();

                // Handle image upload
                if (imageFile != null)
                {
                    existingMember.Image = await ConvertToBase64Async(imageFile);
                }

                existingMember.Name = member.Name;
                existingMember.Title = member.Title;
                existingMember.Subtitle = member.Subtitle;
                existingMember.Description = member.Description;
                existingMember.DisplayOrder = member.DisplayOrder;


                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = existingMember });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!LeadershipTeamMemberExists(id))
                {
                    return NotFound(new { success = false, message = "Leadership team member not found" });
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating leadership team member");
                return StatusCode(500, new { success = false, message = "Error updating leadership team member", error = ex.Message });
            }
        }

        // DELETE: api/LeadershipTeamMembers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLeadershipTeamMember(int id)
        {
            try
            {
                var member = await _context.LeadershipTeamMembers.FindAsync(id);
                if (member == null)
                {
                    return NotFound(new { success = false, message = "Leadership team member not found" });
                }

                _context.LeadershipTeamMembers.Remove(member);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Leadership team member deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting leadership team member");
                return StatusCode(500, new { success = false, message = "Error deleting leadership team member", error = ex.Message });
            }
        }

        private bool LeadershipTeamMemberExists(int id)
        {
            return _context.LeadershipTeamMembers.Any(e => e.Id == id);
        }

        private async Task<string?> ConvertToBase64Async(IFormFile imageFile)
        {
            if (imageFile == null || imageFile.Length == 0)
                return null;

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".svg" };
            var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(fileExtension))
            {
                throw new ArgumentException($"Invalid file type. Allowed types: {string.Join(", ", allowedExtensions)}");
            }

            // Validate file size (max 5MB)
            if (imageFile.Length > 5 * 1024 * 1024)
            {
                throw new ArgumentException("File size cannot exceed 5MB");
            }

            using (var memoryStream = new MemoryStream())
            {
                await imageFile.CopyToAsync(memoryStream);
                var imageBytes = memoryStream.ToArray();
                var base64String = Convert.ToBase64String(imageBytes);
                
                // Include MIME type for proper display
                var mimeType = GetMimeType(fileExtension);
                return $"data:{mimeType};base64,{base64String}";
            }
        }

        private string GetMimeType(string extension)
        {
            return extension.ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".svg" => "image/svg+xml",
                _ => "image/jpeg"
            };
        }
    }
}