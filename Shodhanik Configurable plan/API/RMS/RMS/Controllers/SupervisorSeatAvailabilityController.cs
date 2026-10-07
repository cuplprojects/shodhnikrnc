using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using System.Security.Claims;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorSeatAvailabilityController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorSeatAvailabilityController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/States
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorSeatAvailability>>> GetSupervisorSeatAvailability()
        {
            return await _context.SupervisorSeatAvailabilities.ToListAsync();
        }

        // GET: api/States/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetSupervisorSeatAvailability(int id)
        {
            var result = await (
                from sp in _context.SupervisorPersonal
                where sp.SupId == id

                join d in _context.Designations
                    on sp.Designation equals d.DesignationID

                join ssa in _context.SupervisorSeatAvailabilities
                    on sp.SupId equals ssa.SupId into ssaJoin
                from ssa in ssaJoin.DefaultIfEmpty()

                select new
                {
                    SupervisorSeatAvailability = ssa,
                    TotalSeats = d.TotalSeats
                }
            ).FirstOrDefaultAsync();

            if (result == null)
                return NotFound("Supervisor not found");

            return Ok(result);
        }

        [HttpGet("ScholarsDetails")]
        public async Task<ActionResult<object>> GetScholar([FromQuery] int? SupId)
        {
            int targetSupId = SupId ?? 0;
            if (targetSupId <= 0)
            {
                var claimValue = User.FindFirst(ClaimTypes.Name)?.Value 
                              ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(claimValue) && int.TryParse(claimValue, out int parsedId))
                {
                    targetSupId = parsedId;
                }
            }

            if (targetSupId <= 0)
            {
                return Ok(new List<object>());
            }

            var scholars = await (
                from s in _context.Scholars
                join ss in _context.ScholarSupervisors on s.SID equals ss.SID
                where (ss.SUPID1 == targetSupId || ss.SUPID2 == targetSupId || ss.COSUPID == targetSupId)
                   && !_context.AwardExaminees.Any(a => a.SId == s.SID && a.Level5ApprovalStatus == 1)

                // LEFT JOIN ScholarAuth
                join sa in _context.ScholarAuths
                    on s.SID equals sa.SID into saJoin
                from sa in saJoin.DefaultIfEmpty()

                // LEFT JOIN Department for ResearchArea / Subject name
                join dept in _context.Departments
                    on s.Subject_ID equals dept.DepartmentID into deptJoin
                from dept in deptJoin.DefaultIfEmpty()

                select new
                {
                    Id = s.SID,
                    ScholarId = s.SID,
                    Name = s.Name,
                    Email = s.Email,
                    PermUserName = sa != null ? sa.PermUserName : null,
                    ContactNo = s.PhoneNumber,
                    Phone = s.PhoneNumber,
                    Photo = _context.ScholarUploads
                        .Where(u => u.SID == s.SID && u.DocumentMasterID == 1)
                        .OrderByDescending(u => u.ScholarUploadID)
                        .Select(u => u.Path)
                        .FirstOrDefault(),
                    Status = "Active",
                    ResearchArea = dept != null ? dept.Subject : null,
                    Stage = _context.Thesis.Any(th => th.SID == s.SID)
                        ? "Thesis Stage"
                        : (s.DecisionStatus >= DecisionStatus.CourseworkApproved && s.DecisionStatus <= DecisionStatus.SysnopsisApproved
                            ? "Synopsis Stage"
                            : "Coursework")
                }
            ).Distinct().ToListAsync();

            return Ok(scholars);
        }



        [HttpGet("BySupervisorSeatsGrouped")]
        public async Task<IActionResult> GetSupervisorSeatAvailabilityGrouped(int supId)
        {
            // 1. Supervisor seat allocation
            var supervisorSeats = await _context.SupervisorSeatAvailabilities
                .FirstOrDefaultAsync(s => s.SupId == supId);

            if (supervisorSeats == null)
                return Ok(new List<object>());

            // 2. Supervisor subject preferences
            var supervisorSubjects = await _context.SupervisorPersonal
                .FirstOrDefaultAsync(s => s.SupId == supId);

            if (supervisorSubjects == null)
                return Ok(new List<object>());

            // 3. Scholar counts grouped by Year & Department
            var scholarCounts = await (
                from ss in _context.ScholarSupervisors
                join sc in _context.Scholars on ss.SID equals sc.SID
                where ss.SUPID1 == supId || ss.SUPID2 == supId || ss.COSUPID == supId
                 && sc.DecisionStatus != DecisionStatus.CourseworkRejected
                   && !_context.SynopsisRDCs
              .Any(syn => syn.SID == sc.SID && syn.Synopsis2Decision == SynopsisDecisions.SynopsisRejected)
                group sc by new { sc.Year, sc.Subject_ID } into g
                select new
                {
                    Year = g.Key.Year,
                    DepartmentID = g.Key.Subject_ID,
                    OccupiedSeats = g.Count()
                }
            ).ToListAsync();

            // 4. Supervisor subjects (Primary + Secondary) — ALWAYS included
            var supervisorSubjectList = await _context.Departments
                .Where(d =>
                    d.DepartmentID == supervisorSubjects.PrimarySuperviseSubject ||
                    d.DepartmentID == supervisorSubjects.SecSuperviseSubject1 ||
                    d.DepartmentID == supervisorSubjects.SecSuperviseSubject2
                )
                .Select(d => new
                {
                    d.DepartmentID,
                    d.Subject
                })
                .ToListAsync();

            // 5. Combine Years & Subjects (LEFT JOIN logic)
            var result = scholarCounts
                .Select(sc => sc.Year)
                .Distinct()
                .DefaultIfEmpty() // Handles no scholars at all
                .Select(year => new
                {
                    Year = year,
                    Subjects = supervisorSubjectList.Select(sub =>
                    {
                        var occupied = scholarCounts
                            .FirstOrDefault(x => x.Year == year && x.DepartmentID == sub.DepartmentID)
                            ?.OccupiedSeats ?? 0;

                        int totalSeats =
                            sub.DepartmentID == supervisorSubjects.PrimarySuperviseSubject
                                ? supervisorSeats.Pri_Seat
                            : sub.DepartmentID == supervisorSubjects.SecSuperviseSubject1
                                ? supervisorSeats.Sec_Seat1 ?? 0
                            : sub.DepartmentID == supervisorSubjects.SecSuperviseSubject2
                                ? supervisorSeats.Sec_Seat2 ?? 0
                            : 0;

                        return new
                        {
                            sub.DepartmentID,
                            SubjectName = sub.Subject,
                            OccupiedSeats = occupied,
                            RemainingSeats = Math.Max(totalSeats - occupied, 0)
                        };
                    }).ToList()
                })
                .ToList();

            return Ok(result);
        }



        // PUT: api/States/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorSeatAvailability(int id, SupervisorSeatAvailability state)
        {
            if (id != state.Id)
            {
                return BadRequest();
            }

            _context.Entry(state).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SeatExists(id))
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

        // POST: api/States
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorSeatAvailability>> PostState(SupervisorSeatAvailability seat)
        {
            var existing = await _context.SupervisorSeatAvailabilities
                .FirstOrDefaultAsync(a => a.SupId == seat.SupId);

            if (existing != null)
            {
                // Update existing record
                existing.Pri_Seat = seat.Pri_Seat;
                existing.Sec_Seat1 = seat.Sec_Seat1;
                existing.Sec_Seat2 = seat.Sec_Seat2;
                existing.AvailableSeat = seat.AvailableSeat;
                _context.SupervisorSeatAvailabilities.Update(existing);
            }
            else
            {
                // Insert new record
                _context.SupervisorSeatAvailabilities.Add(seat);
            }

            await _context.SaveChangesAsync();

            return Ok(seat);
        }


        // DELETE: api/States/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorSeatAvailability(int id)
        {
            var seat = await _context.SupervisorSeatAvailabilities.FindAsync(id);
            if (seat == null)
            {
                return NotFound();
            }

            _context.SupervisorSeatAvailabilities.Remove(seat);
            await _context.SaveChangesAsync();

            return NoContent();
        }

      

        private bool SeatExists(int id)
        {
            return _context.SupervisorSeatAvailabilities.Any(e => e.Id == id);
        }
    
}
}
