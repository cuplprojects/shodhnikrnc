using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProgramEventsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public ProgramEventsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        // GET: api/ProgramEvents
        [HttpGet]
        public async Task<ActionResult> GetProgramEvents()
        {
            try
            {
                var programEvents = await _context.ProgramEvents
                    .OrderBy(pe => pe.DisplayOrder)
                    .ThenByDescending(pe => pe.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = programEvents });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving program events", error = ex.Message });
            }
        }

        // GET: api/ProgramEvents/active
        [HttpGet("active")]
        public async Task<ActionResult> GetActiveProgramEvents()
        {
            try
            {
                var programEvents = await _context.ProgramEvents
                    .Where(pe => pe.Status == "Active")
                    .OrderBy(pe => pe.DisplayOrder)
                    .ThenByDescending(pe => pe.CreatedAt)
                    .ToListAsync();

                return Ok(new { success = true, data = programEvents });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving active program events", error = ex.Message });
            }
        }

        // GET: api/ProgramEvents/5
        [HttpGet("{id}")]
        public async Task<ActionResult> GetProgramEvent(int id)
        {
            try
            {
                var programEvent = await _context.ProgramEvents.FindAsync(id);

                if (programEvent == null)
                {
                    return NotFound(new { success = false, message = "Program event not found" });
                }

                return Ok(new { success = true, data = programEvent });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error retrieving program event", error = ex.Message });
            }
        }

        // POST: api/ProgramEvents - Single method for creating with data and image
        [HttpPost]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> CreateProgramEvent(
            [FromForm] string? title, 
            [FromForm] string? date, 
            [FromForm] string? description, 
            [FromForm] string? link, 
            [FromForm] string? status, 
            [FromForm] int? displayOrder, 
            IFormFile? imageFile)
        {
            try
            {
                var programEvent = new ProgramEvent
                {
                    Title = title ?? "",
                    Date = date ?? "",
                    Description = description ?? "",
                    Link = link ?? "",
                    Status = status ?? "Active",
                    DisplayOrder = displayOrder ?? 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Handle image upload if provided
                if (imageFile != null && imageFile.Length > 0)
                {
                    programEvent.Image = await _fileStorage.SaveAsync(
                        imageFile,
                        subFolder: "events",
                        filePrefix: $"EVENT_{programEvent.Id}"
                    );
                }

                _context.ProgramEvents.Add(programEvent);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = programEvent });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error creating program event", error = ex.Message });
            }
        }

        // PUT: api/ProgramEvents/5 - Single method for updating with data and image
        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> UpdateProgramEvent(
            int id, 
            [FromForm] string? title, 
            [FromForm] string? date, 
            [FromForm] string? description, 
            [FromForm] string? link, 
            [FromForm] string? status, 
            [FromForm] int? displayOrder, 
            IFormFile? imageFile)
        {
            try
            {
                var programEvent = await _context.ProgramEvents.FindAsync(id);
                if (programEvent == null)
                {
                    return NotFound(new { success = false, message = "Program event not found" });
                }

                // Update properties
                programEvent.Title = title ?? programEvent.Title;
                programEvent.Date = date ?? programEvent.Date;
                programEvent.Description = description ?? programEvent.Description;
                programEvent.Link = link ?? programEvent.Link;
                programEvent.Status = status ?? programEvent.Status;
                programEvent.DisplayOrder = displayOrder ?? programEvent.DisplayOrder;
                programEvent.UpdatedAt = DateTime.UtcNow;

                // Handle image upload if provided
                if (imageFile != null && imageFile.Length > 0)
                {
                    if (!string.IsNullOrWhiteSpace(programEvent.Image))
                    {
                        // Overwrite existing file
                        await _fileStorage.OverwriteAsync(imageFile, programEvent.Image);
                    }
                    else
                    {
                        // First-time upload
                        programEvent.Image = await _fileStorage.SaveAsync(
                            imageFile,
                            subFolder: "events",
                            filePrefix: $"EVENT_{id}"
                        );
                    }
                }

                _context.Entry(programEvent).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = programEvent });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ProgramEventExists(id))
                {
                    return NotFound(new { success = false, message = "Program event not found" });
                }
                else
                {
                    return StatusCode(500, new { success = false, message = "Concurrency error occurred" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error updating program event", error = ex.Message });
            }
        }

        // DELETE: api/ProgramEvents/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProgramEvent(int id)
        {
            try
            {
                var programEvent = await _context.ProgramEvents.FindAsync(id);
                if (programEvent == null)
                {
                    return NotFound(new { success = false, message = "Program event not found" });
                }

                // Note: FileStorageService handles file deletion internally when needed
                // No manual file deletion required

                _context.ProgramEvents.Remove(programEvent);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Program event deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error deleting program event", error = ex.Message });
            }
        }

        // Helper method to check if program event exists
        private bool ProgramEventExists(int id)
        {
            return _context.ProgramEvents.Any(e => e.Id == id);
        }
    }
}