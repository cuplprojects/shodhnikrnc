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
    public class SupervisorApplicationStatusController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorApplicationStatusController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupAppStatus
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SuplicationApplicationStatus>>> GetSupAppStatus()
        {
            return await _context.SupervisorApplicationStatuses.ToListAsync();
        }

        [HttpGet("ByUser")]
        public async Task<ActionResult<IEnumerable<SuplicationApplicationStatus>>> GetSupApplicationStatus(int supId)
        {
            return await _context.SupervisorApplicationStatuses.Where(c=>c.SupId == supId).ToListAsync();
        }

        // GET: api/SupAppStatus/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SuplicationApplicationStatus>> GetSupAppStatus(int id)
        {
            var supAppStatus = await _context.SupervisorApplicationStatuses.FindAsync(id);

            if (supAppStatus == null)
            {
                return NotFound();
            }

            return supAppStatus;
        }

        // PUT: api/SupAppStatus/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
       

        // POST: api/SupAppStatus
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SuplicationApplicationStatus>> PostSupAppStatus(SuplicationApplicationStatus supAppStatus)
        {
            var existingList = await _context.SupervisorApplicationStatuses
                                    .Where(s => s.SupId == supAppStatus.SupId)
                                    .ToListAsync();

            if (existingList.Any())
            {
                // Delete old DB rows
                _context.SupervisorApplicationStatuses.RemoveRange(existingList);
                await _context.SaveChangesAsync();
            }
            _context.SupervisorApplicationStatuses.Add(supAppStatus);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupAppStatus", new { id = supAppStatus.Id }, supAppStatus);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] int stepNo)
        {
            var existing = await _context.SupervisorApplicationStatuses
                                         .FirstOrDefaultAsync(c => c.SupId == id);

            if (existing == null)
                return NotFound();

            switch (stepNo)
            {
                case 1:
                    if (!existing.Step_1)
                    {
                        existing.Step_1 = true;
                        existing.Step_1At = DateTime.Now;
                    }
                    break;

                case 2:
                    if (!existing.Step_2)
                    {
                        existing.Step_2 = true;
                        existing.Step_2At = DateTime.Now;
                    }
                    break;

                case 3:
                    if (!existing.Step_3)
                    {
                        existing.Step_3 = true;
                        existing.Step_3At = DateTime.Now;
                    }
                    break;

                case 4:
                    if (!existing.Step_4)
                    {
                        existing.Step_4 = true;
                        existing.Step_4At = DateTime.Now;
                    }
                    break;

                case 5:
                    if (!existing.Step_5)
                    {
                        existing.Step_5 = true;
                        existing.Step_5At = DateTime.Now;
                    }
                    break;

                case 6:
                    if (!existing.Step_6)
                    {
                        existing.Step_6 = true;
                        existing.Step_6At = DateTime.Now;
                    }
                    break;

                case 7:
                    if (!existing.Step_7)
                    {
                        existing.Step_7 = true;
                        existing.Step_7At = DateTime.Now;
                    }
                    break;

                case 8:
                    if (!existing.Step_8)
                    {
                        existing.Step_8 = true;
                        existing.Step_8At = DateTime.Now;
                    }
                    break;

                default:
                    return BadRequest("Invalid step number.");
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/SupAppStatus/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupAppStatus(int id)
        {
            var supAppStatus = await _context.SupervisorApplicationStatuses.FindAsync(id);
            if (supAppStatus == null)
            {
                return NotFound();
            }

            _context.SupervisorApplicationStatuses.Remove(supAppStatus);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("stats")]
        public async Task<ActionResult<object>> GetApplicationStats()
        {
            // Step 1: Fetch completed applications with screening info
            var applications = await (
                from status in _context.SupervisorApplicationStatuses
                join reg in _context.SupervisorRegistrations
                    on status.SupId equals reg.SupId
                join screening in _context.SupervisorScreenings
                    on status.SupId equals screening.SupId into screeningGroup
                from screening in screeningGroup.DefaultIfEmpty()
                join inst in _context.WorkflowInstances on new { ID = status.SupId, Type = "Supervisor" } equals new { ID = inst.EntityID, Type = inst.EntityType } into instGroup
                from inst in instGroup.DefaultIfEmpty()
                where
                    status.Step_1 &&
                    status.Step_2 &&
                    status.Step_3 &&
                    status.Step_4 &&
                    status.Step_5 &&
                    status.Step_6 &&
                    status.Step_7
                select new
                {
                    SupId = status.SupId,
                    WorkflowStatus = inst != null ? inst.Status : null,
                    CurrentStepOrder = inst != null ? inst.CurrentStepOrder : 0,
                    Screening1 = (inst != null && (inst.CurrentStepOrder > 1 || inst.Status == "Approved")) ? 1 : (screening != null ? (screening.Screening1Status ?? 0) : 0),
                    Screening2 = (inst != null && (inst.CurrentStepOrder > 2 || inst.Status == "Approved")) ? 1 : (screening != null ? (screening.Screening2Status ?? 0) : 0),
                    Screening3 = (inst != null && (inst.CurrentStepOrder > 3 || inst.Status == "Approved")) ? 1 : (screening != null ? (screening.Screening3Status ?? 0) : 0),
                    Screening4 = (inst != null && (inst.CurrentStepOrder > 4 || inst.Status == "Approved")) ? 1 : (screening != null ? (screening.Screening4Status ?? 0) : 0),
                    Screening5 = (inst != null && (inst.CurrentStepOrder > 5 || inst.Status == "Approved")) ? 1 : (screening != null ? (screening.Screening5Status ?? 0) : 0),
                    Screening6 = (inst != null && inst.Status == "Approved") ? 1 : (screening != null ? (screening.Screening6Status ?? 0) : 0),
                }
            ).ToListAsync();

            var total = applications.Count;

            // ---------------- LEVEL 1 ----------------
            var l1_pending = applications.Count(a => a.Screening1 == 0);
            var l1_approved = applications.Count(a => a.Screening1 == 1);
            var l1_rejected = applications.Count(a => a.Screening1 == 2);

            // ---------------- LEVEL 2 ----------------
            var l2_pending = applications.Count(a =>
                a.Screening1 == 1 &&
                a.Screening2 == 0);

            var l2_approved = applications.Count(a => a.Screening2 == 1);
            var l2_rejected = applications.Count(a => a.Screening2 == 2);

            // ---------------- LEVEL 3 ----------------
            var l3_pending = applications.Count(a =>
                a.Screening2 == 1 &&
                a.Screening3 == 0);

            var l3_approved = applications.Count(a => a.Screening3 == 1);
            var l3_rejected = applications.Count(a => a.Screening3 == 2);

            // ---------------- LEVEL 4 ----------------
            var l4_pending = applications.Count(a =>
                a.Screening3 == 1 &&
                a.Screening4 == 0);

            var l4_approved = applications.Count(a => a.Screening4 == 1);
            var l4_rejected = applications.Count(a => a.Screening4 == 2);

            // ---------------- LEVEL 5 ----------------
            var l5_pending = applications.Count(a =>
                a.Screening4 == 1 &&
                a.Screening5 == 0);

            var l5_approved = applications.Count(a => a.Screening5 == 1);
            var l5_rejected = applications.Count(a => a.Screening5 == 2);

            // ---------------- LEVEL 6 (FINAL) ----------------
            var final_pending = applications.Count(a =>
                a.Screening5 == 1 &&
                a.Screening6 == 0);

            var final_accepted = applications.Count(a => a.Screening6 == 1);
            var final_rejected = applications.Count(a => a.Screening6 == 2);

            // ---------------- RESPONSE ----------------
            return Ok(new
            {
                total,

                level1 = new
                {
                    pending = l1_pending,
                    approved = l1_approved,
                    rejected = l1_rejected
                },

                level2 = new
                {
                    pending = l2_pending,
                    approved = l2_approved,
                    rejected = l2_rejected
                },

                level3 = new
                {
                    pending = l3_pending,
                    approved = l3_approved,
                    rejected = l3_rejected
                },

                level4 = new
                {
                    pending = l4_pending,
                    approved = l4_approved,
                    rejected = l4_rejected
                },

                level5 = new
                {
                    pending = l5_pending,
                    approved = l5_approved,
                    rejected = l5_rejected
                },

                final = new
                {
                    pending = final_pending,
                    accepted = final_accepted,
                    rejected = final_rejected
                }
            });
        }

        [HttpGet("CompletedSupervisorsWithDetails")]
        public async Task<ActionResult<object>> GetCompletedSupervisorsWithDetails(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string search = "",
            [FromQuery] string status = "",
            [FromQuery] string sortField = "applicationDate",
            [FromQuery] string sortOrder = "descend")
        {
            var query = (
                from statusRecord in _context.SupervisorApplicationStatuses
                join reg in _context.SupervisorRegistrations
                    on statusRecord.SupId equals reg.SupId
                join personal in _context.SupervisorPersonal
                    on statusRecord.SupId equals personal.SupId
                join edu in _context.SupervisorEducations
                    on statusRecord.SupId equals edu.SupId
                join desig in _context.Designations
                    on personal.Designation equals desig.DesignationID
                join sub in _context.Departments
                    on personal.PrimarySuperviseSubject equals sub.DepartmentID
                // Left join with screening data to get screening status
                join screening in _context.SupervisorScreenings
                    on statusRecord.SupId equals screening.SupId into screeningGroup
                from screening in screeningGroup.DefaultIfEmpty()
                where
                    statusRecord.Step_1 &&
                    statusRecord.Step_2 &&
                    statusRecord.Step_3 &&
                    statusRecord.Step_4 &&
                    statusRecord.Step_5 &&
                    statusRecord.Step_6 &&
                    statusRecord.Step_7 
                    
                select new CompletedSupervisorDto
                {
                    SupId = statusRecord.SupId,
                    Name = reg.Title + " " + reg.FullName,
                    ApplicationNumber = reg.ApplicationNumber,
                    MobileNo = reg.MobileNo,
                    // Use screening status instead of isAccepted
                    Screening1Status = screening != null ? (screening.Screening1Status ?? 0) : 0,
                    Screening1Count = screening != null ? (screening.Screening1Count ?? 0) : 0,
                    Screening2Status = screening != null ? (screening.Screening2Status ?? 0) : 0,
                    Screening2Count = screening != null ? (screening.Screening2Count ?? 0) : 0,
                    // Determine overall status based on screening data
                    IsAccepted = screening != null ? 
                        (screening.Screening2Status == 1 ? 3 : // Final Accepted
                         screening.Screening2Status == 2 ? 4 : // Final Rejected
                         screening.Screening1Status == 1 ? 1 : // Provisional Accepted
                         screening.Screening1Status == 2 ? 2 : // Rejected in Screening 1
                         0) : 0, // Unscreened
                    Designation = desig.DesignationName,
                    DeptEst = edu.DeptEst,
                    Subject = sub.Subject
                }
            );

            // Apply search filter
            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(x =>
                    x.ApplicationNumber.ToLower().Contains(searchLower) ||
                    x.Name.ToLower().Contains(searchLower) ||
                    x.Designation.ToLower().Contains(searchLower) ||
                    x.Subject.ToLower().Contains(searchLower) ||
                    x.MobileNo.Contains(search)
                );
            }

            // Apply status filter
            if (!string.IsNullOrEmpty(status))
            {
                var statusValues = status.Split(',').Select(s => int.TryParse(s.Trim(), out var val) ? val : -1).Where(v => v >= 0).ToList();
                if (statusValues.Any())
                {
                    query = query.Where(x => statusValues.Contains(x.Screening1Status));
                }
            }

            // Apply sorting
            query = (sortField?.ToLower(), sortOrder?.ToLower()) switch
            {
                ("applicationnumber", "ascend") => query.OrderBy(x => x.ApplicationNumber),
                ("applicationnumber", _) => query.OrderByDescending(x => x.ApplicationNumber),
                ("name", "ascend") => query.OrderBy(x => x.Name),
                ("name", _) => query.OrderByDescending(x => x.Name),
                ("designation", "ascend") => query.OrderBy(x => x.Designation),
                ("designation", _) => query.OrderByDescending(x => x.Designation),
                ("subject", "ascend") => query.OrderBy(x => x.Subject),
                ("subject", _) => query.OrderByDescending(x => x.Subject),
                ("screening1status", "ascend") => query.OrderBy(x => x.Screening1Status),
                ("screening1status", _) => query.OrderByDescending(x => x.Screening1Status),
                (_, "ascend") => query.OrderBy(x => x.ApplicationNumber),
                _ => query.OrderByDescending(x => x.ApplicationNumber)
            };

            var totalCount = await query.CountAsync();

            // Apply pagination
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                data = data,
                total = totalCount,
                page = page,
                pageSize = pageSize
            });
        }

        [HttpGet("ProvisionalAcceptedSupervisors")]
        public async Task<ActionResult<IEnumerable<CompletedSupervisorDto>>> GetProvisionalAcceptedSupervisors()
        {
            var result = await (
                from status in _context.SupervisorApplicationStatuses
                join reg in _context.SupervisorRegistrations
                    on status.SupId equals reg.SupId
                join personal in _context.SupervisorPersonal
                    on status.SupId equals personal.SupId
                join edu in _context.SupervisorEducations
                    on status.SupId equals edu.SupId
                join desig in _context.Designations
                    on personal.Designation equals desig.DesignationID
                join sub in _context.Departments
                    on personal.PrimarySuperviseSubject equals sub.DepartmentID
                // Inner join with screening data - only those with screening1Status = 1
                join screening in _context.SupervisorScreenings
                    on status.SupId equals screening.SupId
                where
                    status.Step_1 &&
                    status.Step_2 &&
                    status.Step_3 &&
                    status.Step_4 &&
                    status.Step_5 &&
                    status.Step_6 &&
                    (screening.Screening1Status ?? 0) == 1 // Only provisional accepted
                select new CompletedSupervisorDto
                {
                    SupId = status.SupId,
                    Name = reg.Title + " " + reg.FullName,
                    ApplicationNumber = reg.ApplicationNumber,
                    MobileNo = reg.MobileNo,
                    Screening1Status = screening.Screening1Status ?? 0,
                    Screening1Count = screening.Screening1Count ?? 0,
                    Screening2Status = screening.Screening2Status ?? 0,
                    Screening2Count = screening.Screening2Count ?? 0,
                    IsAccepted = 1, // All are provisional accepted
                    Designation = desig.DesignationName,
                    DeptEst = edu.DeptEst,
                    Subject = sub.Subject
                }
            ).ToListAsync();

            return Ok(result);
        }

        public class CompletedSupervisorDto
        {
            public int SupId { get; set; }
            public string Name { get; set; }
            public string ApplicationNumber { get; set; }
            public string MobileNo { get; set; }
            public int IsAccepted { get; set; } // Overall status based on screening
            public int Screening1Status { get; set; } // Screening 1 status
            public int Screening1Count { get; set; } // Screening 1 count
            public int Screening2Status { get; set; } // Screening 2 status
            public int Screening2Count { get; set; } // Screening 2 count
            public string Designation { get; set; }
            public string DeptEst { get; set; }
            public string Subject { get; set; }
        }

        private bool SupAppStatusExists(int id)
        {
            return _context.SupervisorApplicationStatuses.Any(e => e.Id == id);
        }
    }
}
