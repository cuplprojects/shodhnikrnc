using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExternalLinksController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public ExternalLinksController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/ExternalLinks
        [HttpGet]
        public async Task<ActionResult> GetExternalLinks()
        {
            try
            {
                var externalLinks = await _context.ExternalLinks
                    .OrderBy(el => el.DisplayOrder)
                    .ThenBy(el => el.Name)
                    .ToListAsync();

                return Ok(new { success = true, data = externalLinks });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving external links", error = ex.Message });
            }
        }

        // GET: api/ExternalLinks/active
        [HttpGet("active")]
        public async Task<ActionResult> GetActiveExternalLinks()
        {
            try
            {
                var externalLinks = await _context.ExternalLinks
                    .Where(el => el.Status == "Active")
                    .OrderBy(el => el.DisplayOrder)
                    .ThenBy(el => el.Name)
                    .ToListAsync();

                return Ok(new { success = true, data = externalLinks });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving active external links", error = ex.Message });
            }
        }

        // GET: api/ExternalLinks/by-category/{category}
        [HttpGet("by-category/{category}")]
        public async Task<ActionResult<IEnumerable<ExternalLink>>> GetExternalLinksByCategory(string category)
        {
            return await _context.ExternalLinks
                .Where(el => el.Status == "Active" && el.Category == category)
                .OrderBy(el => el.DisplayOrder)
                .ThenBy(el => el.Name)
                .ToListAsync();
        }

        // GET: api/ExternalLinks/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ExternalLink>> GetExternalLink(int id)
        {
            var externalLink = await _context.ExternalLinks.FindAsync(id);

            if (externalLink == null)
            {
                return NotFound();
            }

            return externalLink;
        }

        // PUT: api/ExternalLinks/5
        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> PutExternalLink(int id, ExternalLink externalLink)
        {
            try
            {
                if (id != externalLink.Id)
                {
                    return BadRequest(new { success = false, message = "ID mismatch" });
                }

                // Validate required fields
                if (string.IsNullOrWhiteSpace(externalLink.Name))
                {
                    return BadRequest(new { success = false, message = "Name is required" });
                }
                
                if (string.IsNullOrWhiteSpace(externalLink.Url))
                {
                    return BadRequest(new { success = false, message = "URL is required" });
                }

                // Validate URL format
                if (!Uri.TryCreate(externalLink.Url, UriKind.Absolute, out _))
                {
                    return BadRequest(new { success = false, message = "Invalid URL format" });
                }

                externalLink.UpdatedAt = DateTime.UtcNow;
                _context.Entry(externalLink).State = EntityState.Modified;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = externalLink });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ExternalLinkExists(id))
                {
                    return NotFound(new { success = false, message = "External link not found" });
                }
                else
                {
                    return StatusCode(500, new { success = false, message = "Concurrency error occurred" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error updating external link", error = ex.Message });
            }
        }

        // POST: api/ExternalLinks
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> PostExternalLink(ExternalLink externalLink)
        {
            try
            {
                // Validate required fields
                if (string.IsNullOrWhiteSpace(externalLink.Name))
                {
                    return BadRequest(new { success = false, message = "Name is required" });
                }
                
                if (string.IsNullOrWhiteSpace(externalLink.Url))
                {
                    return BadRequest(new { success = false, message = "URL is required" });
                }

                // Validate URL format
                if (!Uri.TryCreate(externalLink.Url, UriKind.Absolute, out _))
                {
                    return BadRequest(new { success = false, message = "Invalid URL format" });
                }

                externalLink.CreatedAt = DateTime.UtcNow;
                externalLink.UpdatedAt = DateTime.UtcNow;
                
                _context.ExternalLinks.Add(externalLink);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = externalLink });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error creating external link", error = ex.Message });
            }
        }

        // DELETE: api/ExternalLinks/5
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> DeleteExternalLink(int id)
        {
            try
            {
                var externalLink = await _context.ExternalLinks.FindAsync(id);
                if (externalLink == null)
                {
                    return NotFound(new { success = false, message = "External link not found" });
                }

                _context.ExternalLinks.Remove(externalLink);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "External link deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting external link", error = ex.Message });
            }
        }

        // POST: api/ExternalLinks/bulk
        [HttpPost("bulk")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> PostBulkExternalLinks(List<ExternalLink> externalLinks)
        {
            try
            {
                foreach (var link in externalLinks)
                {
                    link.CreatedAt = DateTime.UtcNow;
                    link.UpdatedAt = DateTime.UtcNow;
                }
                
                _context.ExternalLinks.AddRange(externalLinks);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = externalLinks });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error creating bulk external links", error = ex.Message });
            }
        }

        private bool ExternalLinkExists(int id)
        {
            return _context.ExternalLinks.Any(e => e.Id == id);
        }
    }
}