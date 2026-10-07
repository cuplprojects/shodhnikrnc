using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OfficeStaffsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public OfficeStaffsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<OfficeStaff>>> GetOfficeStaffs()
        {
            return await _context.OfficeStaffs.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<OfficeStaff>> GetOfficeStaff(int id)
        {
            var staff = await _context.OfficeStaffs.FindAsync(id);
            if (staff == null)
            {
                return NotFound();
            }
            return staff;
        }

        [HttpPost]
        public async Task<ActionResult<OfficeStaff>> PostOfficeStaff([FromForm] OfficeStaffDto dto, IFormFile? image)
        {
            var staff = new OfficeStaff
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
                    filePrefix: $"OFFICE_{staff.Id}"
                );
            }

            _context.OfficeStaffs.Add(staff);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetOfficeStaff", new { id = staff.Id }, staff);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutOfficeStaff(int id, [FromForm] OfficeStaffDto dto, IFormFile? image)
        {
            var existingStaff = await _context.OfficeStaffs.FindAsync(id);
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
                        filePrefix: $"OFFICE_{id}"
                    );
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!OfficeStaffExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOfficeStaff(int id)
        {
            var staff = await _context.OfficeStaffs.FindAsync(id);
            if (staff == null)
            {
                return NotFound();
            }

            _context.OfficeStaffs.Remove(staff);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool OfficeStaffExists(int id)
        {
            return _context.OfficeStaffs.Any(e => e.Id == id);
        }
    }

    public class OfficeStaffDto
    {
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
    }
}