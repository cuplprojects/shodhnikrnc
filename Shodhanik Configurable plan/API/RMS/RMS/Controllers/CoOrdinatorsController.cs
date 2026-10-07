using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CoOrdinatorsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public CoOrdinatorsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CoOrdinator>>> GetCoOrdinators()
        {
            return await _context.CoOrdinators
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CoOrdinator>> GetCoOrdinator(int id)
        {
            var coordinator = await _context.CoOrdinators.FindAsync(id);
            if (coordinator == null)
            {
                return NotFound();
            }
            return coordinator;
        }

        [HttpPost]
        public async Task<ActionResult<CoOrdinator>> PostCoOrdinator([FromForm] CoOrdinatorDto dto, IFormFile? pdfFile)
        {
            var coordinator = new CoOrdinator
            {
                Name = dto.Name ?? "",
                AffiliationResearchCenter = dto.AffiliationResearchCenter,
                Department = dto.Department,
                ContactNo = dto.ContactNo,
                Email = dto.Email,
                Status = dto.Status ?? true
            };

            if (pdfFile != null)
            {
                coordinator.PdfFile = await _fileStorage.SaveAsync(
                    pdfFile,
                    subFolder: "coordinators",
                    filePrefix: $"COORDINATOR_{Guid.NewGuid()}"
                );
            }

            _context.CoOrdinators.Add(coordinator);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetCoOrdinator", new { id = coordinator.Id }, coordinator);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCoOrdinator(int id, [FromForm] CoOrdinatorDto dto, IFormFile? pdfFile)
        {
            var existingCoordinator = await _context.CoOrdinators.FindAsync(id);
            if (existingCoordinator == null)
            {
                return NotFound();
            }

            existingCoordinator.Name = dto.Name ?? "";
            existingCoordinator.AffiliationResearchCenter = dto.AffiliationResearchCenter;
            existingCoordinator.Department = dto.Department;
            existingCoordinator.ContactNo = dto.ContactNo;
            existingCoordinator.Email = dto.Email;
            existingCoordinator.Status = dto.Status ?? true;

            if (pdfFile != null)
            {
                if (!string.IsNullOrWhiteSpace(existingCoordinator.PdfFile))
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(pdfFile, existingCoordinator.PdfFile);
                }
                else
                {
                    // First-time upload
                    existingCoordinator.PdfFile = await _fileStorage.SaveAsync(
                        pdfFile,
                        subFolder: "coordinators",
                        filePrefix: $"COORDINATOR_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CoOrdinatorExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCoOrdinator(int id)
        {
            var coordinator = await _context.CoOrdinators.FindAsync(id);
            if (coordinator == null)
            {
                return NotFound();
            }

            // Delete associated PDF file if exists
            if (!string.IsNullOrWhiteSpace(coordinator.PdfFile))
            {
                try
                {
                    await _fileStorage.DeleteAsync(coordinator.PdfFile);
                }
                catch (Exception ex)
                {
                    // Log the error but continue with deletion
                    Console.WriteLine($"Error deleting file: {ex.Message}");
                }
            }

            // Permanently delete the coordinator record
            _context.CoOrdinators.Remove(coordinator);
            await _context.SaveChangesAsync();
            
            return NoContent();
        }

        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadCoOrdinatorPdf(int id)
        {
            var coordinator = await _context.CoOrdinators.FindAsync(id);
            if (coordinator == null || string.IsNullOrWhiteSpace(coordinator.PdfFile))
            {
                return NotFound("PDF file not found");
            }

            try
            {
                var fileBytes = await _fileStorage.GetFileAsync(coordinator.PdfFile);
                var fileName = $"{coordinator.Name?.Replace(" ", "_") ?? "coordinator"}_{id}.pdf";
                
                return File(fileBytes, "application/pdf", fileName);
            }
            catch (FileNotFoundException)
            {
                return NotFound("PDF file not found on server");
            }
            catch (Exception ex)
            {
                return BadRequest($"Error retrieving file: {ex.Message}");
            }
        }

        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<CoOrdinator>>> GetActiveCoOrdinators()
        {
            return await _context.CoOrdinators
                .Where(c => c.Status == true)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        [HttpGet("archived")]
        public async Task<ActionResult<IEnumerable<CoOrdinator>>> GetArchivedCoOrdinators()
        {
            return await _context.CoOrdinators
                .Where(c => c.Status == false)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        [HttpGet("by-department/{department}")]
        public async Task<ActionResult<IEnumerable<CoOrdinator>>> GetCoOrdinatorsByDepartment(string department)
        {
            return await _context.CoOrdinators
                .Where(c => c.Department == department && c.Status == true)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        [HttpGet("by-research-center/{center}")]
        public async Task<ActionResult<IEnumerable<CoOrdinator>>> GetCoOrdinatorsByResearchCenter(string center)
        {
            return await _context.CoOrdinators
                .Where(c => c.AffiliationResearchCenter == center && c.Status == true)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        private bool CoOrdinatorExists(int id)
        {
            return _context.CoOrdinators.Any(e => e.Id == id);
        }
    }

    public class CoOrdinatorDto
    {
        public string? Name { get; set; }
        public string? AffiliationResearchCenter { get; set; }
        public string? Department { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
        public bool? Status { get; set; }
    }
}