using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FacultyAwardsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public FacultyAwardsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/FacultyAwards/FacultiesWithSubjects
        [HttpGet("FacultiesWithSubjects")]
        public async Task<ActionResult<object>> GetFacultiesWithSubjects()
        {
            try
            {
                var facultiesWithSubjects = await _context.Departments
                    .Where(d => d.Status == "Y") // Only active departments (Y = Yes/Active)
                    .GroupBy(d => d.Faculity)
                    .Select(g => new
                    {
                        Faculty = g.Key,
                        Subjects = g.Select(d => new
                        {
                            SubjectId = d.DepartmentID,
                            SubjectName = d.Subject
                        }).ToList()
                    })
                    .OrderBy(f => f.Faculty)
                    .ToListAsync();

                return Ok(facultiesWithSubjects);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching faculties with subjects: {ex.Message}");
            }
        }

        // GET: api/FacultyAwards/SubjectAwards/{subjectId}
        [HttpGet("SubjectAwards/{subjectId}")]
        public async Task<ActionResult<object>> GetSubjectAwards(int subjectId)
        {
            try
            {
                // Get subject details
                var subject = await _context.Departments
                    .Where(d => d.DepartmentID == subjectId)
                    .Select(d => new
                    {
                        SubjectId = d.DepartmentID,
                        SubjectName = d.Subject,
                        Faculty = d.Faculity
                    })
                    .FirstOrDefaultAsync();

                if (subject == null)
                {
                    return NotFound("Subject not found");
                }

                // Get supervisors and their awards for this subject
                var supervisorAwards = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join sa in _context.SupervisorAwards on sp.SupId equals sa.SupId into awards
                    from sa in awards.DefaultIfEmpty()
                    where sp.PrimarySuperviseSubject == subjectId || 
                          sp.SecSuperviseSubject1 == subjectId || 
                          sp.SecSuperviseSubject2 == subjectId
                    select new
                    {
                        SupervisorId = sp.SupId,
                        SupervisorName = sr.FullName,
                        Email = sr.Email,
                        Award = sa != null ? new
                        {
                            AwardId = sa.Id,
                            Fellowship = sa.Fellowship,
                            Agency = sa.Agency,
                            Year = sa.Year
                        } : null
                    }
                ).ToListAsync();

                // Group awards by supervisor
                var result = supervisorAwards
                    .GroupBy(x => new { x.SupervisorId, x.SupervisorName, x.Email })
                    .Select(g => new
                    {
                        SupervisorId = g.Key.SupervisorId,
                        SupervisorName = g.Key.SupervisorName,
                        Email = g.Key.Email,
                        Awards = g.Where(x => x.Award != null)
                                  .Select(x => x.Award)
                                  .ToList()
                    })
                    .ToList();

                return Ok(new
                {
                    Subject = subject,
                    Supervisors = result
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching subject awards: {ex.Message}");
            }
        }

        // GET: api/FacultyAwards/AllAwards
        [HttpGet("AllAwards")]
        public async Task<ActionResult<object>> GetAllAwards(
            [FromQuery] string? faculty = null,
            [FromQuery] int? subjectId = null,
            [FromQuery] string? year = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                var query = from sp in _context.SupervisorPersonal
                           join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                           join sa in _context.SupervisorAwards on sp.SupId equals sa.SupId
                           join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                           from d1 in dept1.DefaultIfEmpty()
                           join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                           from d2 in dept2.DefaultIfEmpty()
                           join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                           from d3 in dept3.DefaultIfEmpty()
                           select new
                           {
                               SupervisorId = sp.SupId,
                               SupervisorName = sr.FullName,
                               Email = sr.Email,
                               AwardId = sa.Id,
                               Fellowship = sa.Fellowship,
                               Agency = sa.Agency,
                               Year = sa.Year,
                               PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                               SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                               SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null
                           };

                // Apply filters
                if (!string.IsNullOrEmpty(faculty))
                {
                    query = query.Where(x => 
                        (x.PrimarySubject != null && x.PrimarySubject.Faculty.Contains(faculty)) ||
                        (x.SecondarySubject1 != null && x.SecondarySubject1.Faculty.Contains(faculty)) ||
                        (x.SecondarySubject2 != null && x.SecondarySubject2.Faculty.Contains(faculty)));
                }

                if (subjectId.HasValue)
                {
                    query = query.Where(x => 
                        (x.PrimarySubject != null && x.PrimarySubject.Id == subjectId.Value) ||
                        (x.SecondarySubject1 != null && x.SecondarySubject1.Id == subjectId.Value) ||
                        (x.SecondarySubject2 != null && x.SecondarySubject2.Id == subjectId.Value));
                }

                if (!string.IsNullOrEmpty(year))
                {
                    query = query.Where(x => x.Year == year);
                }

                var totalCount = await query.CountAsync();

                var awards = await query
                    .OrderByDescending(x => x.Year)
                    .ThenBy(x => x.SupervisorName)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return Ok(new
                {
                    Data = awards,
                    Total = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching all awards: {ex.Message}");
            }
        }
    }
}