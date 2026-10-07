using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SupportingStaffsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public SupportingStaffsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupportingStaff>>> GetSupportingStaffs()
        {
            return await _context.SupportingStaffs.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<SupportingStaff>> GetSupportingStaff(int id)
        {
            var staff = await _context.SupportingStaffs.FindAsync(id);
            if (staff == null)
            {
                return NotFound();
            }
            return staff;
        }

        [HttpPost]
        public async Task<ActionResult<SupportingStaff>> PostSupportingStaff([FromForm] SupportingStaffDto dto, IFormFile? image)
        {
            var staff = new SupportingStaff
            {
                Name = dto.Name ?? "",
                Designation = dto.Designation ?? "",
                ContactNo = dto.ContactNo ?? "",
                Email = dto.Email ?? ""
            };

            if (image != null)
            {
                staff.Image = await _fileStorage.SaveAsync(
                    image,
                    subFolder: "aboutus",
                    filePrefix: $"SUPPORT_{staff.Id}"
                );
            }

            _context.SupportingStaffs.Add(staff);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetSupportingStaff", new { id = staff.Id }, staff);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupportingStaff(int id, [FromForm] SupportingStaffDto dto, IFormFile? image)
        {
            var existingStaff = await _context.SupportingStaffs.FindAsync(id);
            if (existingStaff == null)
            {
                return NotFound();
            }

            existingStaff.Name = dto.Name ?? "";
            existingStaff.Designation = dto.Designation ?? "";
            existingStaff.ContactNo = dto.ContactNo ?? "";
            existingStaff.Email = dto.Email ?? "";

            if (image != null)
            {
                if (!string.IsNullOrWhiteSpace(existingStaff.Image))
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(image, existingStaff.Image);
                }
                else
                {
                    // First-time upload
                    existingStaff.Image = await _fileStorage.SaveAsync(
                        image,
                        subFolder: "aboutus",
                        filePrefix: $"SUPPORT_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupportingStaffExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupportingStaff(int id)
        {
            var staff = await _context.SupportingStaffs.FindAsync(id);
            if (staff == null)
            {
                return NotFound();
            }

            _context.SupportingStaffs.Remove(staff);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool SupportingStaffExists(int id)
        {
            return _context.SupportingStaffs.Any(e => e.Id == id);
        }
    }

    public class SupportingStaffDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}