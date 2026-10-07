using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorEducationController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public SupervisorEducationController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // GET: api/SupervisorEdus
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorEducation>>> GetSupervisorEdus()
        {
            return await _context.SupervisorEducations.ToListAsync();
        }


        // GET: api/SupervisorEdus/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorEducation>> GetSupervisorEdu(int id)
        {
            var supervisorEdu = await _context.SupervisorEducations.FirstOrDefaultAsync(c => c.SupId == id);

            if (supervisorEdu == null) // ✅ Check for empty list
            {
                return NotFound($"No education records found for supervisor with ID {id}.");
            }

            return supervisorEdu;
        }

        [HttpGet("BySupervisor")]
        public async Task<ActionResult> GetSupervisorEducation(int id)
        {
            var result = await (
                from se in _context.SupervisorEducations
                
                join u in _context.Universities
                    on se.UniversityId equals u.UniversityId into uni
                from u in uni.DefaultIfEmpty()
                join sp in _context.SupervisorPersonal
                on se.SupId equals sp.SupId
                    // Left join for colleges
                join c in _context.CollegeLists
                    on se.CollegeId equals c.Id into col
                from c in col.DefaultIfEmpty()

                    // Left join for departments
                join s in _context.Departments
                    on sp.PrimarySuperviseSubject equals s.DepartmentID into dept
                from s in dept.DefaultIfEmpty()

                where se.SupId == id
                select new
                {
                    se.SupId,
                    UniversityNames = u != null ? u.UniversityName : null,
                    CollegeNames = se.CollegeId > 0 && c != null ? c.CollegeName : null, // ✅ Only if CollegeId > 0
                    Subjects = s != null ? s.Subject : null,
                    se.CollegeName,
                    se.UniversityId,
                    se.UniversityName,
                    se.CollegeId,
                    sp.PrimarySuperviseSubject,
                    se.CollegeType,
                    se.ResearchExp,
                    se.DeptEst,
                    se.MonthAndYear,
                    se.Description,
                    se.ThesisTitle,
                    se.PhdUniversity,
                    se.SupervisorName,
                    se.AreaOfSpec,
                    se.PhdSubject,
                    se.ResearchCenter,
                }
            ).FirstOrDefaultAsync();

            if (result == null)
            {
                return NotFound($"No education records found for supervisor with ID {id}.");
            }

            return Ok(result);
        }


        // PUT: api/SupervisorEdus/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorEdu(int id, SupervisorEducation supervisorEdu)
        {
            if (id != supervisorEdu.Id)
            {
                return BadRequest();
            }

            _context.Entry(supervisorEdu).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorEduExists(id))
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

        public class SupervisorEducationDto
        {
            // 🔑 Common
            public int SupId { get; set; }

            // ===== EDUCATION TABLE =====
            public int UniversityId { get; set; }
            public string CollegeType { get; set; }
            public string? UniversityName { get; set; }
            public string? CollegeName { get; set; }
            public int CollegeId { get; set; }
            public string ResearchExp { get; set; }

            [StringLength(4)]
            public string DeptEst { get; set; }

            public string? ResearchCenter { get; set; }
            public string PhdSubject { get; set; }
            public string MonthAndYear { get; set; }
            public string SupervisorName { get; set; }
            public string AreaOfSpec { get; set; }
            public string ThesisTitle { get; set; }
            public string PhdUniversity { get; set; }
            public string Description { get; set; }

            // ===== PERSONAL TABLE =====
            public int Subject { get; set; }   // 👈 ONLY THIS GOES TO PERSONAL
        }


        // POST: api/SupervisorEdus
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult> PostSupRes(
     [FromForm] SupervisorEducationDto dto
 )
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // ============================
                // EDUCATION TABLE
                // ============================
                var existingEdu = await _context.SupervisorEducations
                    .Where(x => x.SupId == dto.SupId)
                    .ToListAsync();

                if (existingEdu.Any())
                {
                    _context.SupervisorEducations.RemoveRange(existingEdu);
                    await _context.SaveChangesAsync();
                }

                var education = new SupervisorEducation
                {
                    SupId = dto.SupId,
                    UniversityId = dto.UniversityId,
                    CollegeType = dto.CollegeType,
                    UniversityName = dto.UniversityName,
                    CollegeName = dto.CollegeName,
                    CollegeId = dto.CollegeId,
                    ResearchExp = dto.ResearchExp,
                    DeptEst = dto.DeptEst,
                    Description = dto.Description,
                    ResearchCenter = dto.ResearchCenter,
                    PhdSubject = dto.PhdSubject,
                    MonthAndYear = dto.MonthAndYear,
                    SupervisorName = dto.SupervisorName,
                    AreaOfSpec = dto.AreaOfSpec,
                    ThesisTitle = dto.ThesisTitle,
                    PhdUniversity = dto.PhdUniversity
                };

                _context.SupervisorEducations.Add(education);

                // ============================
                // PERSONAL TABLE (ONLY SUBJECT)
                // ============================
                var personal = await _context.SupervisorPersonal
                    .FirstOrDefaultAsync(p => p.SupId == dto.SupId);

                if (personal != null)
                {
                    personal.PrimarySuperviseSubject = dto.Subject;
                    _context.SupervisorPersonal.Update(personal);
                }

                // ============================
                // APPLICATION STATUS LOGIC
                // ============================
                var existingStatus = await _context.SupervisorApplicationStatuses
                    .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

                if (existingStatus != null)
                {
                    bool wasStep2AlreadyTrue = existingStatus.Step_2;

                    existingStatus.Step_2 = true;
                    existingStatus.Step_2At = DateTime.UtcNow;
                    _context.SupervisorApplicationStatuses.Update(existingStatus);

                    if (wasStep2AlreadyTrue)
                    {
                        var screening = await _context.SupervisorScreenings
                            .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

                        if (screening != null)
                        {
                            screening.Screening1Status = 0;
                            screening.Screening2Status = 0;
                            screening.Screening3Status = 0;
                            screening.Screening4Status = 0;
                            screening.Screening5Status = 0;
                            screening.Screening6Status = 0;

                            _context.SupervisorScreenings.Update(screening);
                        }
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "Education & subject details saved successfully" });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }


        // DELETE: api/SupervisorEdus/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorEdu(int id)
        {
            var supervisorEdu = await _context.SupervisorEducations.FindAsync(id);
            if (supervisorEdu == null)
            {
                return NotFound();
            }

            _context.SupervisorEducations.Remove(supervisorEdu);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        //For DOR website

        [HttpGet("list-of-typewise-supervisor")]
        public async Task<IActionResult> GetSupervisors()
        {
            var baseQuery =
                from e in _context.SupervisorEducations
                join r in _context.SupervisorRegistrations
                    on e.SupId equals r.SupId
                join p in _context.SupervisorPersonal
                    on e.SupId equals p.SupId
                select new
                {
                    e.UniversityId,
                    e.CollegeId,
                    r.FullName,
                    r.MobileNo,
                    r.Email,
                    p.Designation
                };

            var data = await baseQuery.ToListAsync();

            var result = new
            {
                internalSupervisors = data
                    .Where(x => x.UniversityId == 1 && x.CollegeId > 0)
                    .Select(x => new
                    {
                        x.FullName,
                        x.MobileNo,
                        x.Email,
                        x.Designation
                    })
                    .Distinct(),

                externalSupervisors = data
                    .Where(x => x.UniversityId == 2)
                    .Select(x => new
                    {
                        x.FullName,
                        x.MobileNo,
                        x.Email,
                        x.Designation
                    })
                    .Distinct(),

                coSupervisors = data
                    .Where(x => x.UniversityId == 1 || x.UniversityId == 2)
                    .Select(x => new
                    {
                        x.FullName,
                        x.MobileNo,
                        x.Email,
                        x.Designation
                    })
                    .Distinct()
            };

            return Ok(result);
        }

        
        private bool SupervisorEduExists(int id)
        {
            return _context.SupervisorEducations.Any(e => e.Id == id);
        }
    }
}
