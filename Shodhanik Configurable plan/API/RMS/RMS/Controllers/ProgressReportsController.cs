using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NPOI.SS.Formula.Functions;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProgressReportsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public ProgressReportsController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        // GET: api/ProgressReports
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProgressReport>>> GetProgressReports()
        {
            return await _context.ProgressReports.ToListAsync();
        }

      
        // GET: api/ProgressReports/by-sid/5  - added by ROY the GREAT 
        [HttpGet("by-sid/{sid}")]
        public async Task<ActionResult<IEnumerable<ProgressReport>>> GetProgressReportsBySID(int sid)
        {
            var reports = await _context.ProgressReports
                .AsNoTracking()
                .Where(p => p.SID == sid)
                .OrderByDescending(p => p.UploadDate)
                .ToListAsync();

            if (reports == null || reports.Count == 0)
            {
                return NotFound(new { Message = $"No record found for SID {sid}." });
            }

            return Ok(reports);
        }


        [HttpGet("ByScholarID/{sid}")]
        public async Task<ActionResult<IEnumerable<ProgressReport>>> GetProgressReportbySID(int sid)
        {
            var progressReport = await _context.ProgressReports.Where(pr => pr.SID == sid).ToListAsync();

            if (progressReport == null)
            {
                return NotFound();
            }

            return progressReport;
        }
        public class ProgressReportStatusCountDto
        {
            public int Approved { get; set; }
            public int Rejected { get; set; }
            public int NotViewed { get; set; }
        }

        //[HttpGet("ProgressReportCount/{supervisorId}")]
        //public async Task<IActionResult> GetProgressReportCount(int supervisorId)
        //{
        //    var query =
        //        from pr in _context.ProgressReports
        //        join ss in _context.ScholarSupervisors
        //            on pr.SID equals ss.SID
        //        where ss.SUPID1 == supervisorId
        //        select pr;

        //    var result = await query
        //        .GroupBy(x => x.isApprovedbySupervisor ?? 0)
        //        .Select(g => new
        //        {
        //            Status = g.Key,
        //            Count = g.Count()
        //        })
        //        .ToListAsync();

        //    var response = new ProgressReportStatusCountDto
        //    {
        //        Approved = result.FirstOrDefault(x => x.Status == 1)?.Count ?? 0,
        //        Rejected = result.FirstOrDefault(x => x.Status == 2)?.Count ?? 0,
        //        NotViewed = result.FirstOrDefault(x => x.Status == 0)?.Count ?? 0
        //    };

        //    return Ok(response);
        //}

        [HttpGet("ProgressReportCount/{supervisorId}")]
        public async Task<IActionResult> GetProgressReportCount(int supervisorId)
        {
            var query =
                from pr in _context.ProgressReports
                join ss in _context.ScholarSupervisors
                    on pr.SID equals ss.SID
                where ss.SUPID1 == supervisorId
                   || ss.SUPID2 == supervisorId
                select pr.isApprovedbySupervisor;

            var data = await query.ToListAsync();

            var response = new ProgressReportStatusCountDto
            {
                Approved = data.Count(x => x == 1),
                Rejected = data.Count(x => x == 2),
                NotViewed = data.Count(x => x == 0)
            };

            return Ok(response);
        }

        /* [HttpGet("ProgressReportCountforDOR")]
         public async Task<IActionResult> ProgressReportCountforDOR()
         {
             var query =
                 from pr in _context.ProgressReports
                 join ss in _context.ScholarSupervisors
                     on pr.SID equals ss.SID
                 where pr.isApprovedbyDOR != null && pr.isApprovedbySupervisor == 1
                 select pr.isApprovedbyDOR;

             var data = await query.ToListAsync();

             var response = new ProgressReportStatusCountDto
             {
                 Approved = data.Count(x => x == 1),
                 Rejected = data.Count(x => x == 2),
                 NotViewed = data.Count(x => x == 0)
             };

             return Ok(response);
         }*/


        //[HttpGet("ProgressReport/{supervisorId}")]
        //public async Task<IActionResult> GetProgressReportByStatus(int supervisorId, int status)
        //{
        //    var sup = await _context.SupervisorRegistrations
        //                .FirstOrDefaultAsync(s => s.SupId == supervisorId);

        //    var query =
        //        from pr in _context.ProgressReports
        //        join ss in _context.ScholarSupervisors
        //            on pr.SID equals ss.SID
        //        join sr in _context.Scholars
        //            on pr.SID equals sr.SID
        //        join sa in _context.ScholarAuths
        //            on pr.SID equals sa.SID
        //            join sp in _context.ScholarUploads
        //            on pr.SID equals sp.SID where sp.DocumentMasterID == 1
        //        where ss.SUPID1 == supervisorId && pr.isApprovedbySupervisor == status
        //        select new
        //        {
        //            pr.PRID,
        //            pr.SID,
        //            sr.Email,
        //            sa.PermUserName,
        //            sr.Name,
        //            sr.Subject_ID,
        //            DepartmentName = _context.Departments.Where(s=>s.DepartmentID == sr.Subject_ID).Select(s=>s.Subject).FirstOrDefault(),
        //            sr.Year,
        //            sr.PhoneNumber,
        //            sa.PermPassword,
        //            pr.UploadDate,
        //            pr.isApprovedbySupervisor,
        //            pr.ReportFilePath,
        //            pr.SupervisorComments,
        //            sup.FullName,
        //            sp.Path,
        //        };

        //    var result = await query.ToListAsync();

        //    return Ok(result);
        //}

        [HttpGet("ProgressReport")]
        public async Task<IActionResult> GetPendingProgressReports([FromQuery] int? status, [FromQuery] int? supervisorId)
        {
            int targetStatus = status ?? 0;

            var query =
                from pr in _context.ProgressReports
                join ss in _context.ScholarSupervisors
                    on pr.SID equals ss.SID
                join sr in _context.Scholars
                    on pr.SID equals sr.SID
                join sa in _context.ScholarAuths
                    on pr.SID equals sa.SID
                join sp in _context.ScholarUploads
                    on pr.SID equals sp.SID

                // 🔹 Join supervisor using SUPID1 or SUPID2
                join sup in _context.SupervisorRegistrations
                    on (ss.SUPID2 ?? ss.SUPID1) equals sup.SupId

                where
                    sp.DocumentMasterID == 1
                    && (pr.isApprovedbySupervisor ?? 0) == targetStatus
                    && pr.ReportFilePath != null

                select new
                {
                    pr.PRID,
                    pr.SID,
                    pr.PRTitle,
                    pr.LastDate,

                    sr.Name,
                    sr.Email,
                    sr.PhoneNumber,
                    sr.Year,
                    sa.PermUserName,
                    sr.Subject_ID,

                    DepartmentName = _context.Departments
                        .Where(d => d.DepartmentID == sr.Subject_ID)
                        .Select(d => d.Subject)
                        .FirstOrDefault(),

                    pr.UploadDate,
                    pr.ReportFilePath,
                    pr.SupervisorComments,
                    pr.SupervisorApprovalDate,
                    isApprovedbySupervisor = pr.isApprovedbySupervisor ?? 0,

                    SupervisorId = sup.SupId,
                    SupervisorName = sup.FullName,
                    SupervisorEmail = sup.Email,

                    sp.Path
                };

            if (supervisorId.HasValue && supervisorId.Value > 0)
            {
                query = query.Where(q => q.SupervisorId == supervisorId.Value);
            }

            var result = await query.OrderByDescending(q => q.UploadDate).AsNoTracking().ToListAsync();

            return Ok(result);
        }

        [HttpGet("ProgressReport/{supervisorId}")]
        public async Task<IActionResult> GetProgressReportBySupervisor(int supervisorId, [FromQuery] int? status)
        {
            return await GetPendingProgressReports(status, supervisorId);
        }


        /*  [HttpGet("ProgressReportForDOR")]
          public async Task<IActionResult> ProgressReportForDOR()
          {
              // Supervisor details

              var result = await (
                  from pr in _context.ProgressReports
                  join sr in _context.Scholars
                      on pr.SID equals sr.SID
                  join sa in _context.ScholarAuths
                      on pr.SID equals sa.SID
                  where
                      pr.isApprovedbySupervisor == 1 && pr.isApprovedbyDOR == 0
                  select new
                  {
                      pr.PRID,
                      pr.SID,
                      pr.ReportFilePath,
                      sr.Name,
                      sr.Email,
                      sr.PhoneNumber,
                      sr.Year,
                      sa.PermUserName,

                      sr.Subject_ID,
                      DepartmentName = _context.Departments
                          .Where(d => d.DepartmentID == sr.Subject_ID)
                          .Select(d => d.Subject)
                          .FirstOrDefault(),

                      pr.UploadDate,
                      pr.SupervisorComments,
                      pr.isApprovedbySupervisor,
                      pr.isApprovedbyDOR,
                      pr.DORApprovalDate,
                      pr.DORComments
                  }
              ).AsNoTracking().ToListAsync();

              return Ok(result);
          }
  */

        [HttpGet("ProgressReportFormatDetails/{sid}")]
        public async Task<ActionResult<object>> GetProgressReportFormatDetails(int sid)
        {
            var scholar = await _context.Scholars
                .FirstOrDefaultAsync(s => s.SID == sid);

            if (scholar == null)
                return NotFound("Scholar not found.");

            var scholarusername = await _context.ScholarAuths
                .FirstOrDefaultAsync(sa => sa.SID == sid);

            var department = await _context.Departments
                .FirstOrDefaultAsync(d => d.DepartmentID == scholar.Subject_ID);

            var synopsis = await _context.SynopsisRDCs
                .FirstOrDefaultAsync(s => s.SID == sid);

            // =========================
            // Supervisor (SUP2 priority)
            // =========================
            var supervisor = await (
    from ss in _context.ScholarSupervisors

        // Pick SUPID2 if present, else SUPID1
    join sup in _context.SupervisorRegistrations
        on (ss.SUPID2 ?? ss.SUPID1) equals sup.SupId

    // Join supervisor auth table
    join sa in _context.SupervisorAuths
        on sup.SupId equals sa.SupId

    where ss.SID == sid

    select new
    {
        sup.FullName,
        sup.MobileNo,
        sup.Email,
        SupervisorUsername = sa.PermUserName
    }
).FirstOrDefaultAsync();

            // =========================
            // Co-Supervisor
            // =========================
            var coSupervisor = await (
     from ss in _context.ScholarSupervisors

     join sup in _context.SupervisorRegistrations
         on ss.COSUPID equals sup.SupId

     // LEFT JOIN to SupervisorAuths
     join sa in _context.SupervisorAuths
         on sup.SupId equals sa.SupId into auths
     from sa in auths.DefaultIfEmpty()

     where ss.SID == sid && ss.COSUPID != null

     select new
     {
         sup.FullName,
         sup.MobileNo,
         sup.Email,
         CoSupervisorUsername = sa != null ? sa.PermUserName : null
     }
 ).FirstOrDefaultAsync();

            var formatDetails = new
            {
                RMSID_Username = scholarusername?.PermUserName,
                ApplicationNumber = scholar.ApplicationNo,
                Name = scholar.Name,
                MobileNumber = scholar.PhoneNumber,
                Email = scholar.Email,
                Date = DateTime.UtcNow,

                DepartmentOrSubject = department?.Subject,

                TitleOfSynopsis = synopsis?.Synopsis1Title,
                DateOfRDC = synopsis?.Synopsis1RDCDate,

                Supervisor = supervisor?.FullName,
                SupervisorMobileNumber = supervisor?.MobileNo,
                SupervisorEmail = supervisor?.Email,
                SupervisorUserName = supervisor?.SupervisorUsername,

                CoSupervisor = coSupervisor?.FullName,
                CoSupervisorMobileNumber = coSupervisor?.MobileNo,
                CoSupervisorEmail = coSupervisor?.Email,
                CoSupervisorUserName = coSupervisor?.CoSupervisorUsername  
            };

            return Ok(formatDetails);
        }



        // PUT: api/ProgressReports/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutProgressReport(int id, ProgressReport progressReport)
        {
            if (id != progressReport.PRID)
            {
                return BadRequest();
            }

            _context.Entry(progressReport).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ProgressReportExists(id))
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

        // POST: api/ProgressReports
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ProgressReport>> PostProgressReport(
    [FromForm] ProgressReportCreateRequest request)
        {

            var existingCount = await _context.ProgressReports
    .CountAsync(p => p.SID == request.SID);

            if (existingCount >= 10)
            {
                return BadRequest("Maximum 10 progress reports allowed per scholar.");
            }

            var nextNumber = existingCount + 1;
            var progressReport = new ProgressReport
            {
                SID = request.SID,
                UploadDate = DateTime.UtcNow,
                isApprovedbySupervisor = request.isApprovedbySupervisor,
                SupervisorComments = request.SupervisorComments,
                SupervisorApprovalDate = request.SupervisorApprovalDate,
             
            };

            // ============================
            // File Upload via DI Service
            // ============================

            

            if (request.ReportFile != null)
            {
                progressReport.ReportFilePath = await _fileStorage.SaveAsync(
                    request.ReportFile,
                    "progress-reports",
                    $"PR_{nextNumber}_{request.SID}"
                );
            }

            _context.ProgressReports.Add(progressReport);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                "GetProgressReport",
                new { id = progressReport.PRID },
                progressReport
            );
        }

        [HttpPatch("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> PatchProgressReport(
    int id,
    [FromForm] ProgressReportPatchRequest request)
        {
            var progressReport = await _context.ProgressReports.FindAsync(id);
            if (progressReport == null)
                return NotFound($"ProgressReport with ID {id} not found.");

            // ============================
            // Partial scalar updates
            // ============================

            if (request.isApprovedbySupervisor.HasValue)
                progressReport.isApprovedbySupervisor = request.isApprovedbySupervisor;

            if (!string.IsNullOrWhiteSpace(request.SupervisorComments))
                progressReport.SupervisorComments = request.SupervisorComments;

            if (request.SupervisorApprovalDate.HasValue)
                progressReport.SupervisorApprovalDate = request.SupervisorApprovalDate;

            // ============================
            // File overwrite (same name)
            // ============================
            if (request.ReportFile != null)
            {
                if (string.IsNullOrEmpty(progressReport.ReportFilePath))
                {
                    // Fallback: first-time upload
                    progressReport.ReportFilePath = await _fileStorage.SaveAsync(
                        request.ReportFile,
                        "progress-reports",
                        $"PR_{progressReport.SID}"
                    );
                    progressReport.UploadDate = DateTime.Now;
                    progressReport.isApprovedbySupervisor = 0;
                }
                else
                {
                    // Overwrite existing file
                    await _fileStorage.OverwriteAsync(
                        request.ReportFile,
                        progressReport.ReportFilePath
                    );
                    progressReport.UploadDate = DateTime.Now;
                    progressReport.isApprovedbySupervisor = request.isApprovedbySupervisor ?? 0;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "ProgressReport updated successfully",
                data = progressReport
            });
        }




        // DELETE: api/ProgressReports/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProgressReport(int id)
        {
            var progressReport = await _context.ProgressReports.FindAsync(id);
            if (progressReport == null)
            {
                return NotFound();
            }

            _context.ProgressReports.Remove(progressReport);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ProgressReportExists(int id)
        {
            return _context.ProgressReports.Any(e => e.PRID == id);
        }
    }

    public class ProgressReportCreateRequest
    {
        public int SID { get; set; }

        // File
        public IFormFile? ReportFile { get; set; }

        // Optional approval fields
        public int? isApprovedbySupervisor { get; set; }
        public string? SupervisorComments { get; set; }
        public DateTime? SupervisorApprovalDate { get; set; }

        public int? isApprovedbyDOR { get; set; }
        public string? DORComments { get; set; }
        public DateTime? DORApprovalDate { get; set; }

        public int? ReadandVerifiedByDOR { get; set; }
    }

    public class ProgressReportPatchRequest
    {
        // File
        public IFormFile? ReportFile { get; set; }

        // Supervisor approval
        public int? isApprovedbySupervisor { get; set; }
        public string? SupervisorComments { get; set; }
        public DateTime? SupervisorApprovalDate { get; set; }

        // DOR approval
        public int? isApprovedbyDOR { get; set; }
        public string? DORComments { get; set; }
        public DateTime? DORApprovalDate { get; set; }

        public int? ReadandVerifiedByDOR { get; set; }
    }
}
