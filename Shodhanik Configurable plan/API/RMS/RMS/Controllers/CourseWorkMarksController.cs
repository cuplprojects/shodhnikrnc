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
    public class CourseWorkMarksController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public CourseWorkMarksController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/CourseWorkMarks
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CourseWorkMarks>>> GetCourseWorkMarks()
        {
            return await _context.CourseWorkMarks.ToListAsync();
        }

        // GET: api/CourseWorkMarks/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CourseWorkMarks>> GetCourseWorkMarks(int id)
        {
            var courseWorkMarks = await _context.CourseWorkMarks.FindAsync(id);

            if (courseWorkMarks == null)
            {
                return NotFound();
            }

            return courseWorkMarks;
        }

        // PUT: api/CourseWorkMarks/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCourseWorkMarks(int id, CourseWorkMarks courseWorkMarks)
        {
            if (id != courseWorkMarks.CWMID)
            {
                return BadRequest();
            }

            _context.Entry(courseWorkMarks).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CourseWorkMarksExists(id))
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

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchCourseWorkMarks(
    int id,
    [FromBody] CourseWorkMarksPatchRequest request)
        {
            var entity = await _context.CourseWorkMarks.FindAsync(id);

            if (entity == null)
                return NotFound($"CourseWorkMarks with ID {id} not found.");

            // ============================
            // Subject 1
            // ============================
            if (request.Subject1PaperName != null) entity.Subject1PaperName = request.Subject1PaperName;
            if (request.Subject1PaperCode != null) entity.Subject1PaperCode = request.Subject1PaperCode;
            if (request.Subject1TheoryOBT != null) entity.Subject1TheoryOBT = request.Subject1TheoryOBT;
            if (request.Subject1INTOBT != null) entity.Subject1INTOBT = request.Subject1INTOBT;
            if (request.Subject1PROBT != null) entity.Subject1PROBT = request.Subject1PROBT;
            if (request.Subject1TOTAL != null) entity.Subject1TOTAL = request.Subject1TOTAL;
            if (request.Subject1GRADE != null) entity.Subject1GRADE = request.Subject1GRADE;
            if (request.Subject1GRADEPOINT != null) entity.Subject1GRADEPOINT = request.Subject1GRADEPOINT;
            if (request.Subject1SUBJECTGRADE != null) entity.Subject1SUBJECTGRADE = request.Subject1SUBJECTGRADE;
            if (request.Subject1SCGP != null) entity.Subject1SCGP = request.Subject1SCGP;

            // ============================
            // Subject 2
            // ============================
            if (request.Subject2PaperName != null) entity.Subject2PaperName = request.Subject2PaperName;
            if (request.Subject2PaperCode != null) entity.Subject2PaperCode = request.Subject2PaperCode;
            if (request.Subject2TheoryOBT != null) entity.Subject2TheoryOBT = request.Subject2TheoryOBT;
            if (request.Subject2INTOBT != null) entity.Subject2INTOBT = request.Subject2INTOBT;
            if (request.Subject2PROBT != null) entity.Subject2PROBT = request.Subject2PROBT;
            if (request.Subject2TOTAL != null) entity.Subject2TOTAL = request.Subject2TOTAL;
            if (request.Subject2GRADE != null) entity.Subject2GRADE = request.Subject2GRADE;
            if (request.Subject2GRADEPOINT != null) entity.Subject2GRADEPOINT = request.Subject2GRADEPOINT;
            if (request.Subject2SUBJECTGRADE != null) entity.Subject2SUBJECTGRADE = request.Subject2SUBJECTGRADE;
            if (request.Subject2SCGP != null) entity.Subject2SCGP = request.Subject2SCGP;

            // ============================
            // Subject 3
            // ============================
            if (request.Subject3PaperName != null) entity.Subject3PaperName = request.Subject3PaperName;
            if (request.Subject3PaperCode != null) entity.Subject3PaperCode = request.Subject3PaperCode;
            if (request.Subject3TheoryOBT != null) entity.Subject3TheoryOBT = request.Subject3TheoryOBT;
            if (request.Subject3INTOBT != null) entity.Subject3INTOBT = request.Subject3INTOBT;
            if (request.Subject3PROBT != null) entity.Subject3PROBT = request.Subject3PROBT;
            if (request.Subject3TOTAL != null) entity.Subject3TOTAL = request.Subject3TOTAL;
            if (request.Subject3GRADE != null) entity.Subject3GRADE = request.Subject3GRADE;
            if (request.Subject3GRADEPOINT != null) entity.Subject3GRADEPOINT = request.Subject3GRADEPOINT;
            if (request.Subject3SUBJECTGRADE != null) entity.Subject3SUBJECTGRADE = request.Subject3SUBJECTGRADE;
            if (request.Subject3SCGP != null) entity.Subject3SCGP = request.Subject3SCGP;

            // ============================
            // Remarks
            // ============================
            if (request.Remarks != null)
                entity.Remarks = request.Remarks;

            await _context.SaveChangesAsync();

            return Ok(entity);
        }


        // POST: api/CourseWorkMarks
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<CourseWorkMarks>> PostCourseWorkMarks(CourseWorkMarks courseWorkMarks)
        {
            _context.CourseWorkMarks.Add(courseWorkMarks);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetCourseWorkMarks", new { id = courseWorkMarks.CWMID }, courseWorkMarks);
        }

        // DELETE: api/CourseWorkMarks/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCourseWorkMarks(int id)
        {
            var courseWorkMarks = await _context.CourseWorkMarks.FindAsync(id);
            if (courseWorkMarks == null)
            {
                return NotFound();
            }

            _context.CourseWorkMarks.Remove(courseWorkMarks);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CourseWorkMarksExists(int id)
        {
            return _context.CourseWorkMarks.Any(e => e.CWMID == id);
        }
    }

    public class CourseWorkMarksPatchRequest
    {
        public string? Subject1PaperName { get; set; }
        public string? Subject1PaperCode { get; set; }
        public string? Subject1TheoryOBT { get; set; }
        public string? Subject1INTOBT { get; set; }
        public string? Subject1PROBT { get; set; }
        public string? Subject1TOTAL { get; set; }
        public string? Subject1GRADE { get; set; }
        public string? Subject1GRADEPOINT { get; set; }
        public string? Subject1SUBJECTGRADE { get; set; }
        public string? Subject1SCGP { get; set; }

        public string? Subject2PaperName { get; set; }
        public string? Subject2PaperCode { get; set; }
        public string? Subject2TheoryOBT { get; set; }
        public string? Subject2INTOBT { get; set; }
        public string? Subject2PROBT { get; set; }
        public string? Subject2TOTAL { get; set; }
        public string? Subject2GRADE { get; set; }
        public string? Subject2GRADEPOINT { get; set; }
        public string? Subject2SUBJECTGRADE { get; set; }
        public string? Subject2SCGP { get; set; }

        public string? Subject3PaperName { get; set; }
        public string? Subject3PaperCode { get; set; }
        public string? Subject3TheoryOBT { get; set; }
        public string? Subject3INTOBT { get; set; }
        public string? Subject3PROBT { get; set; }
        public string? Subject3TOTAL { get; set; }
        public string? Subject3GRADE { get; set; }
        public string? Subject3GRADEPOINT { get; set; }
        public string? Subject3SUBJECTGRADE { get; set; }
        public string? Subject3SCGP { get; set; }

        public string? Remarks { get; set; }
    }

}
