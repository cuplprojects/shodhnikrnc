using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarSupervisorController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IFileService _fileService;
        private readonly IFileStorageService _fileStorageService;

        public ScholarSupervisorController(RMSDbContext context, IConfiguration configuration, IFileService fileService, IFileStorageService fileStorageService)
        {
            _context = context;
            _configuration = configuration;
            _fileService = fileService;
            _fileStorageService = fileStorageService;
        }

        // GET: api/ScholarSupervisor
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarSupervisor>>> GetScholarSupervisors()
        {
            return await _context.ScholarSupervisors.ToListAsync();
        }

        // GET: api/ScholarSupervisor/5
        [HttpGet("BySid/{sid}")]
        public async Task<ActionResult> GetScholarSupervisorBySid(int sid)
        {
            if (sid <= 0)
                return BadRequest("SID is required.");

            var scholarSupervisor = await _context.ScholarSupervisors
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.SID == sid);

            if (scholarSupervisor == null)
                return NotFound($"No ScholarSupervisor found for SID {sid}");

            string? approvedByName = null;
            string? approvedByRole = null;

            if (scholarSupervisor.ApprovedBy.HasValue)
            {
                var adminInfo = await (
                    from a in _context.Admins
                    where a.AID == scholarSupervisor.ApprovedBy.Value
                    join r in _context.Roles on a.RoleId equals r.RoleID into rJoin
                    from r in rJoin.DefaultIfEmpty()
                    select new
                    {
                        AdminName = a.Name,
                        RoleName = r != null ? r.RoleName : null
                    }
                ).FirstOrDefaultAsync();

                if (adminInfo != null)
                {
                    approvedByName = adminInfo.AdminName;
                    approvedByRole = adminInfo.RoleName;
                }
            }

            return Ok(new
            {
                scholarSupervisor.SCSUID,
                scholarSupervisor.SID,
                scholarSupervisor.SUPID1,
                scholarSupervisor.SUPID2,
                scholarSupervisor.COSUPID,
                scholarSupervisor.SUP1ConsentFilePath,
                scholarSupervisor.SUP2ConsentFilePath,
                scholarSupervisor.COSUPConsentFilePath,
                scholarSupervisor.NOCFilePath,
                scholarSupervisor.Decision1,
                scholarSupervisor.Decision2,
                scholarSupervisor.Decision1Remark,
                scholarSupervisor.Decision2Remark,
                scholarSupervisor.RequestedAt,
                scholarSupervisor.SecondRequestAt,
                scholarSupervisor.ApprovedAt,
                scholarSupervisor.SecondApprovedAt,
                scholarSupervisor.ApprovedBy,
                ApprovedByName = approvedByName,
                ApprovedByRole = approvedByRole
            });
        }


        //[Authorize]
        [HttpPatch("UpdateScholarSupervisor/{id}")]
        public async Task<IActionResult> PatchScholarSupervisor(
    int id,
    [FromForm] ScholarSupervisorPatchRequest request)
        {
            var supervisor = await _context.ScholarSupervisors.FindAsync(id);

            if (supervisor == null)
                return NotFound($"ScholarSupervisor with ID {id} not found.");

            // =========================
            // Scalar field updates
            // =========================
            var oldSUPID1 = supervisor.SUPID1;
            var oldSUPID2 = supervisor.SUPID2;
            var oldCOSUPID = supervisor.COSUPID;

            var oldSUP1File = supervisor.SUP1ConsentFilePath;
            var oldSUP2File = supervisor.SUP2ConsentFilePath;
            var oldCOSUPFile = supervisor.COSUPConsentFilePath;
            if (request.SID.HasValue)
                supervisor.SID = request.SID.Value;

            if (request.SUPID1.HasValue)
                supervisor.SUPID1 = request.SUPID1.Value;

            if (request.SUPID2.HasValue)
                supervisor.SUPID2 = request.SUPID2;

            if (request.COSUPID.HasValue)
                supervisor.COSUPID = request.COSUPID;

            if (request.RequestedAt.HasValue)
                supervisor.RequestedAt = request.RequestedAt;

            if (request.SecondRequestAt.HasValue)
                supervisor.SecondRequestAt = request.SecondRequestAt;

            if (request.SecondApprovedAt.HasValue)
                supervisor.SecondApprovedAt = request.SecondApprovedAt;

            if (request.Decision1.HasValue)
            {
                supervisor.Decision1 = request.Decision1.Value;
            }

            if (request.Decision2.HasValue)
            {
                supervisor.Decision2 = request.Decision2.Value;
            }
          

            // =========================
            // Decision & Approval Logic
            // =========================
            // =========================
            // Remove consent files if supervisor changed & approved
            // =========================
            if (request.Decision1 == ScholarSupervisorDecision.Approved)
            {
                var userIdClaim = HttpContext.User.Claims
                    .FirstOrDefault(c => c.Type == ClaimTypes.Name);

                int? userId = null;
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int parsedUserId))
                {
                    userId = parsedUserId;
                }

                // If SUP1 changed → remove consent file
                if (request.SUPID1.HasValue && oldSUPID1 != request.SUPID1.Value)
                {
                    supervisor.SUP1ConsentFilePath = null;

                    if (!string.IsNullOrEmpty(oldSUP1File))
                        await _fileStorageService.DeleteAsync(oldSUP1File);
                }

                // If SUP2 changed → remove consent file
                if (request.SUPID2.HasValue && oldSUPID2 != request.SUPID2)
                {
                    supervisor.SUP2ConsentFilePath = null;

                    if (!string.IsNullOrEmpty(oldSUP2File))
                        await _fileStorageService.DeleteAsync(oldSUP2File);
                }

                // Set approval metadata ONCE
                if (userId.HasValue)
                {
                    supervisor.ApprovedBy = userId.Value;

                    var istTimeZone =
                        TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");

                    supervisor.ApprovedAt =
                        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTimeZone);
                }
            }


            if (request.Decision2 == ScholarSupervisorDecision.Approved)
            {
                if (request.COSUPID.HasValue && oldCOSUPID != request.COSUPID)
                {
                    supervisor.COSUPConsentFilePath = null;

                    if (!string.IsNullOrEmpty(oldCOSUPFile))
                        await _fileStorageService.DeleteAsync(oldCOSUPFile);
                }
            }


            /*   if (request.Decision2.HasValue)
               {
                   supervisor.Decision2 = request.Decision2.Value;

                   if (request.Decision2.Value == ScholarSupervisorDecision.Approved)
                   {
                       var userIdClaim = HttpContext.User.Claims
                           .FirstOrDefault(c => c.Type == ClaimTypes.Name);

                       if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
                       {
                           supervisor.ApprovedBy = userId;

                           var istTimeZone =
                               TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");

                           supervisor.SecondApprovedAt =
                               TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTimeZone);
                       }
                   }
               }
   */
            if (!string.IsNullOrWhiteSpace(request.Decision1Remark))
                supervisor.Decision1Remark = request.Decision1Remark;

            if (!string.IsNullOrWhiteSpace(request.Decision2Remark))
                supervisor.Decision2Remark = request.Decision2Remark;

            // =========================
            // File Uploads (MATCHES POST)
            // =========================
            if (request.SUP1ConsentFile != null)
            {
                supervisor.SUP1ConsentFilePath =
                    await _fileStorageService.SaveAsync(
                        request.SUP1ConsentFile,
                        "scholar-supervisor",
                        "SUP1"
                    );
            }

            if (request.SUP2ConsentFile != null)
            {
                supervisor.SUP2ConsentFilePath =
                    await _fileStorageService.SaveAsync(
                        request.SUP2ConsentFile,
                        "scholar-supervisor",
                        "SUP2"
                    );
            }

            if (request.NOCFile != null)
            {
                supervisor.NOCFilePath =
                    await _fileStorageService.SaveAsync(
                        request.NOCFile,
                        "scholar-supervisor",
                        "NOC"
                    );
            }

            if (request.COSUPConsentFile != null)
            {
                supervisor.COSUPConsentFilePath =
                    await _fileStorageService.SaveAsync(
                        request.COSUPConsentFile,
                        "scholar-supervisor",
                        "COSUP"
                    );
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "ScholarSupervisor updated successfully",
                data = supervisor
            });
        }




        // PUT: api/ScholarSupervisor/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarSupervisor(int id, ScholarSupervisor scholarSupervisor)
        {
            if (id != scholarSupervisor.SCSUID)
            {
                return BadRequest();
            }

            _context.Entry(scholarSupervisor).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarSupervisorExists(id))
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

        // POST: api/ScholarSupervisor
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754

        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarSupervisor>> GetScholarSupervisor(int id)
        {
            var supervisor = await _context.ScholarSupervisors
                .FirstOrDefaultAsync(x => x.SCSUID == id);

            if (supervisor == null)
                return NotFound();

            return Ok(supervisor);
        }

        [HttpGet("Pending")]
        public async Task<ActionResult> GetPendingScholarSupervisors()
        {
            var result = await (
                from ss in _context.ScholarSupervisors
                join sch in _context.Scholars
                    on ss.SID equals sch.SID

                join sup1 in _context.SupervisorRegistrations
                    on ss.SUPID1 equals sup1.SupId

                // LEFT JOIN Supervisor 2
                join sup2 in _context.SupervisorRegistrations
                    on ss.SUPID2 equals sup2.SupId into sup2Join
                from sup2 in sup2Join.DefaultIfEmpty()

                    // LEFT JOIN Co-Supervisor
                join cosup in _context.SupervisorRegistrations
                    on ss.COSUPID equals cosup.SupId into cosupJoin
                from cosup in cosupJoin.DefaultIfEmpty()

                where ss.Decision1 == ScholarSupervisorDecision.Pending

                select new
                {
                    // Scholar
                    ss.SID,
                    ss.SCSUID,
                    ScholarName = sch.Name,

                    // Supervisor 1
                    Supervisor1Id = ss.SUPID1,
                    Supervisor1Name = sup1.FullName,

                    // Supervisor 2 (optional)
                    Supervisor2Id = ss.SUPID2,
                    Supervisor2Name = sup2 != null ? sup2.FullName : null,

                    // Co-Supervisor (optional)
                    CoSupervisorId = ss.COSUPID,
                    CoSupervisorName = cosup != null ? cosup.FullName : null,

                    // Dates
                    ss.RequestedAt,
                    ss.SecondRequestAt
                }
            ).ToListAsync();

            return Ok(result);
        }

        [HttpGet("SupervisorforScholarSelect/{id}/{type}")]
        public async Task<ActionResult> GetSupervisorForScholarSelect(int id, string type)
        {
            // 1. Get scholar
            var scholar = await _context.Scholars.FindAsync(id);
            if (scholar == null)
                return NotFound("Scholar not found");

            int subjectId = scholar.Subject_ID;

            // Normalize type
            bool isInternal = type?.ToLower() == "internal";

            // 2. Base Query
            var query =
                from sp in _context.SupervisorPersonal
                join sr in _context.SupervisorRegistrations
                    on sp.SupId equals sr.SupId
                join se in _context.SupervisorEducations
                    on sp.SupId equals se.SupId
               
                where sr.IsAccepted == 1
                      // 🔑 Subject ANY match
                      && (
                            sp.PrimarySuperviseSubject == subjectId
                         || sp.SecSuperviseSubject1 == subjectId
                         || sp.SecSuperviseSubject2 == subjectId
                      )
                      // 🔑 Internal filter only when needed
                      && (!isInternal || se.UniversityId == 1)
                select new
                {
                    sp.SupId,
                    sr.FullName
                };

            var supervisors = await query
                .Distinct()
                .ToListAsync();

            return Ok(supervisors);
        }





        [HttpPost]
        public async Task<ActionResult<ScholarSupervisor>> PostScholarSupervisor(
    [FromForm] ScholarSupervisorCreateRequest request)
        {
            if (request == null)
                return BadRequest("Invalid request.");

            var supervisor = new ScholarSupervisor
            {
                SID = request.SID,
                SUPID1 = request.SUPID1,
                SUPID2 = request.SUPID2,
                COSUPID = request.COSUPID,
                RequestedAt = request.RequestedAt,
                SecondRequestAt = request.SecondRequestAt,
                ApprovedAt = request.ApprovedAt,
                SecondApprovedAt = request.SecondApprovedAt,
                Decision1 = 0,
                Decision1Remark = request.Decision1Remark
            };

            // ============================
            // File Upload Handling
            // ============================
            var rootfolder = _fileService.GetUploadPath("ScholarFiles");

            var basePath = Path.Combine(
                Directory.GetCurrentDirectory(),
                rootfolder,
                "uploads",
                "scholar-supervisor"
            );

            if (!Directory.Exists(basePath))
                Directory.CreateDirectory(basePath);

            if (request.SUP1ConsentFile != null)
            {
                supervisor.SUP1ConsentFilePath =
                    await _fileStorageService.SaveAsync(request.SUP1ConsentFile, "scholar-supervisor", "SUP1");
            }

            if (request.SUP2ConsentFile != null)
            {
                supervisor.SUP2ConsentFilePath =
                    await _fileStorageService.SaveAsync(request.SUP2ConsentFile, "scholar-supervisor", "SUP2");
            }

            if (request.NOCFile != null)
            {
                supervisor.NOCFilePath =
                    await _fileStorageService.SaveAsync(request.NOCFile, "scholar-supervisor", "NOC");
            }

            if (request.COSUPConsentFile != null)
            {
                supervisor.COSUPConsentFilePath =
                    await _fileStorageService.SaveAsync(request.COSUPConsentFile, "scholar-supervisor", "COSUP");
            }

            _context.ScholarSupervisors.Add(supervisor);
            await _context.SaveChangesAsync();

            // ✅ Correct CreatedAtAction
            return CreatedAtAction(
                nameof(GetScholarSupervisor),
                new { id = supervisor.SCSUID },
                supervisor
            );
        }

        [HttpGet("BySupId/{supId}")]
        public async Task<ActionResult<ScholarSupervisor>> GetScholarSupervisorBySupid(int supid)
        {
            if (supid <= 0)
                return BadRequest("SID is required.");

            var scholarSupervisor = await _context.ScholarSupervisors
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.SID == supid);

            if (scholarSupervisor == null)
                return NotFound($"No ScholarSupervisor found for SID {supid}");

            return Ok(scholarSupervisor);
        }

        [HttpGet("Counts")]
        public async Task<ActionResult<ScholarSupervisor>> GetScholarCountBySupid(int supid)
        {
            if (supid <= 0)
                return BadRequest("SupID is required.");

            var scholarSupervisor = await _context.ScholarSupervisors
                .Where(x => x.SUPID1 == supid || x.SUPID2 == supid).ToListAsync();

            if (scholarSupervisor == null)
                return NotFound($"No Scholar found for SupID {supid}");

            return Ok(scholarSupervisor);
        }


        // DELETE: api/ScholarSupervisor/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarSupervisor(int id)
        {
            var scholarSupervisor = await _context.ScholarSupervisors.FindAsync(id);
            if (scholarSupervisor == null)
            {
                return NotFound();
            }

            _context.ScholarSupervisors.Remove(scholarSupervisor);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ScholarSupervisorExists(int id)
        {
            return _context.ScholarSupervisors.Any(e => e.SCSUID == id);
        }
    }

    public class ScholarSupervisorPatchRequest
    {
        // Scalars (all optional)
        public int? SID { get; set; }
        public int? SUPID1 { get; set; }
        public int? SUPID2 { get; set; }
        public int? COSUPID { get; set; }

        public DateTime? RequestedAt { get; set; }
        public DateTime? SecondRequestAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? SecondApprovedAt { get; set; }

        // Files
        public IFormFile? SUP1ConsentFile { get; set; }
        public IFormFile? SUP2ConsentFile { get; set; }
        public IFormFile? NOCFile { get; set; }
        public IFormFile? COSUPConsentFile { get; set; }

        public ScholarSupervisorDecision? Decision1 { get; set; }
        public ScholarSupervisorDecision? Decision2 { get; set; }


        public string? Decision1Remark { get; set; }
        public string? Decision2Remark { get; set; }
    }

    public class ScholarSupervisorCreateRequest
    {
        // Required fields
        public int SID { get; set; }
        public int SUPID1 { get; set; }

        // Optional fields
        public int? SUPID2 { get; set; }
        public int? COSUPID { get; set; }

        public DateTime? RequestedAt { get; set; }
        public DateTime? SecondRequestAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? SecondApprovedAt { get; set; }

        // Files
        public IFormFile? SUP1ConsentFile { get; set; }
        public IFormFile? SUP2ConsentFile { get; set; }
        public IFormFile? NOCFile { get; set; }

        public IFormFile? COSUPConsentFile { get; set; }

        public ScholarSupervisorDecision? Decision1 { get; set; }
        public ScholarSupervisorDecision? Decision2 { get; set; }

        public string? Decision1Remark { get; set; }
        public string? Decision2Remark { get; set; }
    }

}
