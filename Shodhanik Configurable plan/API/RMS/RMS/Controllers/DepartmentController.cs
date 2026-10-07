using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DepartmentController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public DepartmentController(RMSDbContext context)
        {
            _context = context;
        }

        // ===============================
        // GET: api/Department
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Department>>> GetDepartments()
        {
            return await _context.Departments.ToListAsync();
        }

        // ===============================
        // GET: api/Department/5
        // ===============================
        [HttpGet("{id}")]
        public async Task<ActionResult<Department>> GetDepartment(int id)
        {
            var department = await _context.Departments.FindAsync(id);

            if (department == null)
                return NotFound();

            return department;
        }

        // ===============================
        // PUT: api/Department/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutDepartment(int id, Department department)
        {
            if (id != department.DepartmentID)
                return BadRequest("DepartmentID mismatch.");

            _context.Entry(department).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!DepartmentExists(id))
                    return NotFound();

                throw;
            }

            return NoContent();
        }

        [HttpGet("subject-list")]
        public async Task<IActionResult> GetDepartmentSubjects()
        {
            var result = await _context.Departments
                .AsNoTracking()
                .Select(d => new
                {
                    d.DepartmentID,
                    d.Subject
                })
                .OrderBy(d => d.Subject)
                .ToListAsync();

            return Ok(result);
        }




        // ===============================
        // POST: api/Department
        // ===============================
        [HttpPost]
        public async Task<ActionResult<Department>> PostDepartment(Department department)
        {
            _context.Departments.Add(department);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDepartment), new { id = department.DepartmentID }, department);
        }

        // ===============================
        // DELETE: api/Department/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDepartment(int id)
        {
            var department = await _context.Departments.FindAsync(id);

            if (department == null)
                return NotFound();

            _context.Departments.Remove(department);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        [HttpGet("subjects-by-faculty")]
        public async Task<IActionResult> GetSubjectsByFaculty([FromQuery] string faculity)
        {
            if (string.IsNullOrWhiteSpace(faculity))
                return BadRequest("Faculity is required.");

            var subjects = await _context.Departments
                .Where(d => d.Faculity == faculity)
                .OrderBy(d => d.SortOrder)
                .Select(d => new
                {
                    d.DepartmentID,
                    d.Subject
                })
                .ToListAsync();

            return Ok(subjects);
        }


        // ===============================
        // HELPERS
        // ===============================
        private bool DepartmentExists(int id)
        {
            return _context.Departments.Any(e => e.DepartmentID == id);
        }
    }
}
