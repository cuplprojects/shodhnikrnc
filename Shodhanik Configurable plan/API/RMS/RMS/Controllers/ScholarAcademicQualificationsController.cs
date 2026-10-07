using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarAcademicQualificationsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public ScholarAcademicQualificationsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/AcademicQualifications
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarAcademicQualification>>> GetAcademicQualifications()
        {
            return await _context.ScholarAcademicQualifications.ToListAsync();
        }

        // GET: api/AcademicQualifications/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarAcademicQualification>> GetAcademicQualification(int id)
        {
            var academicQualification = await _context.ScholarAcademicQualifications.FindAsync(id);

            if (academicQualification == null)
            {
                return NotFound();
            }

            return academicQualification;
        }

        // PUT: api/AcademicQualifications/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutAcademicQualification(int id, ScholarAcademicQualification academicQualification)
        {
            if (id != academicQualification.AQID)
            {
                return BadRequest();
            }

            _context.Entry(academicQualification).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AcademicQualificationExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/AcademicQualifications
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ScholarAcademicQualification>> PostAcademicQualification(ScholarAcademicQualification academicQualification)
        {
            _context.ScholarAcademicQualifications.Add(academicQualification);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetAcademicQualification", new { id = academicQualification.AQID }, academicQualification);
        }

        // DELETE: api/AcademicQualifications/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAcademicQualification(int id)
        {
            var academicQualification = await _context.ScholarAcademicQualifications.FindAsync(id);
            if (academicQualification == null)
            {
                return NotFound();
            }

            _context.ScholarAcademicQualifications.Remove(academicQualification);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        [HttpGet("GetAcademicBySID")]
        public async Task<IActionResult> GetAcademicBySID([FromQuery] int sid)
        {
            if (sid <= 0)
            {
                return BadRequest(new { Message = "Please provide a valid SID." });
            }

            var data = await _context.ScholarAcademicQualifications
                .Where(x => x.SID == sid)
                .ToListAsync();

            if (data == null || data.Count == 0)
            {
                return NotFound(new { Message = "No academic records found for this SID." });
            }

            return Ok(data);
        }


        private bool AcademicQualificationExists(int id)
        {
            return _context.ScholarAcademicQualifications.Any(e => e.AQID == id);
        }
    }
}
