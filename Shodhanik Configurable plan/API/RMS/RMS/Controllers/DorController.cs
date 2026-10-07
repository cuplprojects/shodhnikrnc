using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Asn1.IsisMtt.X509;
using RMS.Data;
using RMS.Models;
using System.Linq;
using static RMS.Controllers.SupervisorRegistrationController;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DorController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public DorController(RMSDbContext context)
        {
            _context = context;
        }

        [HttpGet("Counts")]
        public async Task<IActionResult> GetSupervisorCountDepartmentWise()
        {
            var supervisorData = from sp in _context.SupervisorPersonal
                                 join sa in _context.SupervisorSeatAvailabilities
                                 on sp.SupId equals sa.SupId
                                 join sd in _context.Designations
                                 on sp.Designation equals sd.DesignationID
                                 select new
                                 {
                                     sp.PrimarySuperviseSubject,
                                     sp.SecSuperviseSubject1,
                                     sp.SecSuperviseSubject2,
                                     sa.Pri_Seat,
                                     sa.Sec_Seat1,
                                     sa.Sec_Seat2,
                                     sa.AvailableSeat,
                                     sd.TotalSeats,
                                 };

            var result = await _context.Departments
                .Select(d => new
                {
                    Departmentid = d.DepartmentID,
                    Subject = d.Subject,
                    SupervisorCount = supervisorData.Count(s => s.PrimarySuperviseSubject == d.DepartmentID
                                                              || s.SecSuperviseSubject1 == d.DepartmentID
                                                              || s.SecSuperviseSubject2 == d.DepartmentID),
                    TotalSeats = supervisorData
                .Where(s => s.PrimarySuperviseSubject == d.DepartmentID)
                .Sum(s => s.TotalSeats),

                    ScholarCount = _context.Scholars.Count(sc => sc.Subject_ID == d.DepartmentID && sc.DecisionStatus>=DecisionStatus.CounsellingApprovedFinal),
                    SeatsForAdmission = supervisorData
                    .Where(s => s.PrimarySuperviseSubject == d.DepartmentID)
                    .Sum(s => s.AvailableSeat)

                })
                .Select(x => new
                {
                    x.Departmentid,
                    x.Subject,
                    x.SupervisorCount,
                    x.TotalSeats,
                    x.ScholarCount,
                    SeatsAvailable = x.TotalSeats - x.ScholarCount,
                    x.SeatsForAdmission
                })
                .ToListAsync();

            return Ok(result);
        }


        [HttpGet("ExistingSupervisor")]
        public async Task<ActionResult> GetExistingSupervisor()
        {
            var supervisors = await (
                from sp in _context.SupervisorPersonal
                join sr in _context.SupervisorRegistrations
                    on sp.SupId equals sr.SupId
                join sa in _context.SupervisorAuths
                    on sp.SupId equals sa.SupId   // Auth table join
                where sr.IsAccepted == 1
                      && sr.Active == true
                select new
                {
                    // Supervisor Personal
                    sp.SupId,
                    sr.FullName,
                    sp.Designation,
                    sp.PrimarySuperviseSubject,
                    // Registration
                    sr.MobileNo,
                    sr.Email,
                    sa.PermUserName,
                }
            ).ToListAsync();

            if (!supervisors.Any())
            {
                return NotFound("No supervisors found");
            }

            return Ok(supervisors);
        }

        [HttpPatch("ExistingSupervisor/{supId}")]
        public async Task<IActionResult> UpdateSupervisorContact(
 int supId,
 [FromBody] UpdateSupervisorContactDto dto)
        {
            if (dto == null)
            {
                return BadRequest("Invalid request body");
            }

            var supervisorRegistration = await _context.SupervisorRegistrations
                .FirstOrDefaultAsync(x => x.SupId == supId && x.IsAccepted == 1 && x.Active);

            if (supervisorRegistration == null)
            {
                return NotFound("Supervisor not found");
            }

            // Update only provided fields
            if (!string.IsNullOrWhiteSpace(dto.Email))
            {
                supervisorRegistration.Email = dto.Email;
            }

            if (!string.IsNullOrWhiteSpace(dto.MobileNo))
            {
                supervisorRegistration.MobileNo = dto.MobileNo;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                Message = "Supervisor contact details updated successfully",
                supervisorRegistration.SupId,
                supervisorRegistration.Email,
                supervisorRegistration.MobileNo
            });
        }

     

        [HttpPost("AddRDC")]
        public async Task<IActionResult> AddOrUpdateRDC([FromBody] RmsDor model)
        {
            if (model == null)
                return BadRequest("Invalid data");

            // Check if the department exists
            bool departmentExists = await _context.Departments
                .AnyAsync(d => d.DepartmentID == model.DepartmentId);

            if (!departmentExists)
                return NotFound("Department does not exist");

                // ADD new RDC
               var rdc = new RmsDor
                {
                    DepartmentId = model.DepartmentId,
                    Name = model.Name,
                    ContactNo = model.ContactNo,
                    Email = model.Email,
                    Address = model.Address,
                    From = model.From,
                    To = model.To,
                };

                _context.RmsDors.Add(rdc);
                await _context.SaveChangesAsync();
                return Ok();
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDor(int id, RmsDor rms)
        {
            if (id != rms.Id)
            {
                return BadRequest();
            }

            _context.Entry(rms).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CommitteeExists(id))
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


        // Helper method to update details for all members


        // Helper method to update a single member's info

        [HttpGet("{id}")]
        public async Task<ActionResult<RmsDor>> GetRDCCommittee(int id)
        {
            var designation = await _context.RmsDors.Where(s=>s.DepartmentId == id).ToListAsync();

            if (designation == null)
            {
                return NotFound();
            }

            return Ok(designation);
        }

        [HttpGet("departments-with-members")]
        public async Task<IActionResult> GetAllDepartmentsWithMembers()
        {
            var result = await _context.Departments
                .Select(d => new
                {
                    DepartmentId = d.DepartmentID,
                    DepartmentName = d.Subject,
                    Members = _context.RmsDors
                        .Where(m => m.DepartmentId == d.DepartmentID)
                        .Select(m => new
                        {
                            m.Name,
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(result);
        }


        [HttpGet("DeptWiseSup")]
        public async Task<IActionResult> GetSupervisorDepartmentWise(int deptId)
        {
            try
            {
                // Pre-calculate scholar counts per supervisor
                var scholarCounts1 = _context.ScholarSupervisors
                    .Where(ss => ss.SUPID1 != null)
                    .Select(ss => new { SupId = (int?)ss.SUPID1, ss.SID });

                var scholarCounts2 = _context.ScholarSupervisors
                    .Where(ss => ss.SUPID2 != null)
                    .Select(ss => new { SupId = (int?)ss.SUPID2, ss.SID });

                var scholarCounts3 = _context.ScholarSupervisors
                    .Where(ss => ss.COSUPID != null)
                    .Select(ss => new { SupId = (int?)ss.COSUPID, ss.SID });

                // Get unique scholar-supervisor combinations
                var scholarCounts = scholarCounts1
                    .Union(scholarCounts2)
                    .Union(scholarCounts3)
                    .Where(x => x.SupId != null)
                    .GroupBy(x => new { x.SupId, x.SID }) // Group by both to get unique scholars per supervisor
                    .Select(g => g.Key)
                    .GroupBy(x => x.SupId!.Value)
                    .Select(g => new { SupId = g.Key, ScholarCount = g.Count() })
                    .ToList(); // Materialize to avoid complex query

                var supervisorData = await (
                    from s in _context.SupervisorPersonal
                    join r in _context.SupervisorRegistrations on s.SupId equals r.SupId
                    join se in _context.SupervisorEducations on s.SupId equals se.SupId
                    join a in _context.SupervisorAuths on s.SupId equals a.SupId
                    join sa in _context.SupervisorSeatAvailabilities on s.SupId equals sa.SupId
                    where s.PrimarySuperviseSubject == deptId
                        || s.SecSuperviseSubject1 == deptId
                        || s.SecSuperviseSubject2 == deptId
                    select new
                    {
                        SupervisorId = s.SupId,
                        SupervisorName = r.FullName,
                        se.CollegeName,
                        se.CollegeId,
                        College = _context.CollegeLists.FirstOrDefault(s=>s.Id == se.CollegeId),
                        ShodhnikId = a.PermUserName,
                        PrimarySubject = s.PrimarySuperviseSubject,
                        SecSubject1 = s.SecSuperviseSubject1,
                        SecSubject2 = s.SecSuperviseSubject2,
                        PriSeat = sa.Pri_Seat,
                        SecSeat1 = sa.Sec_Seat1,
                        SecSeat2 = sa.Sec_Seat2,
                        AvailableSeat = sa.AvailableSeat,
                    }
                ).ToListAsync();

                // Process in memory to avoid nullable issues
                var supervisors = supervisorData.Select(x =>
                {
                    int totalSeats = 0;
                    int admissionseats = 0 ;

                    if (x.PrimarySubject == deptId)
                    {
                        totalSeats = x.PriSeat;
                        admissionseats = x.AvailableSeat;
                    }
                    else if (x.SecSubject1 == deptId)
                    {
                        totalSeats = x.SecSeat1 ?? 0;
                    }
                    else if (x.SecSubject2 == deptId)
                    {
                        totalSeats = x.SecSeat2 ?? 0;
                    }

                    var scholarCount = scholarCounts.FirstOrDefault(sc => sc.SupId == x.SupervisorId)?.ScholarCount ?? 0;

                    return new
                    {
                        x.SupervisorId,
                        x.SupervisorName,
                        x.CollegeName,
                        x.ShodhnikId,
                        deptId,
                        TotalSeats = totalSeats,
                        ScholarCount = scholarCount,
                        Available = totalSeats - scholarCount,
                       Admissions = admissionseats,
                    };
                }).ToList();

                return Ok(supervisors);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while fetching supervisor data", error = ex.Message });
            }
        }


      


        [HttpGet("PrePhd")]
        public async Task<IActionResult> GetPrePhdStudentCount()
        {
            var prephd = await _context.Scholars
                .Where(s => s.DecisionStatus == DecisionStatus.CounsellingApprovedFinal)
                .GroupBy(s => s.Year)
                .Select(g => new
                {
                    Year = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            return Ok(prephd);
        }

        [HttpGet("Phd")]
        public async Task<IActionResult> GetPhdStudentCount()
        {
            var prephd = await _context.Scholars
                .Where(s => s.DecisionStatus == DecisionStatus.CourseworkApproved)
                .GroupBy(s => s.Year)
                .Select(g => new
                {
                    Year = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            return Ok(prephd);
        }

        private bool CommitteeExists(int id)
        {
            return _context.RmsDors.Any(e => e.Id == id);
        }

    }
}
