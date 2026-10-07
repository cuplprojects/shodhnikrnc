using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;
using static RMS.Controllers.ScholarResearchController;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarConferencesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorageService;
        public ScholarConferencesController(RMSDbContext context, IFileStorageService fileStorageService)
        {
            _fileStorageService = fileStorageService;
            _context = context;
        }

        // ===============================
        // GET: api/Department
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarConferences>>> GetScholarConferencess()
        {
            return await _context.ScholarConferences.ToListAsync();
        }

        // ===============================
        // GET: api/ScholarConferences/5
        // ===============================
        [HttpGet("{sid}")]
        public async Task<IActionResult> GetScholarConferences(int sid)
        {
            var conferences = await _context.ScholarConferences
                .AsNoTracking()
                .Where(c => c.SID == sid)
                .Select(c => new
                {
                    c.Id,
                    c.SID,
                    c.TitleOfPaper,
                    c.AuthorName,
                    c.NameOfConference,
                    c.LevelOfConference,
                    c.SponsoringAgency,
                    c.StartingDate,
                    c.EndingDate,
                    c.OrganizedBy,
                    c.Place,
                    c.PresentationCertificate,
                    c.ConferenceStatus,
                    c.Remarks
                })
                .ToListAsync();

            if (!conferences.Any())
                return NotFound($"No conferences found for Scholar ID {sid}");

            return Ok(conferences);
        }



        // ===============================
        // PUT: api/ScholarConferences/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarConferences(int id, ScholarConferences ScholarConferences)
        {
            if (id != ScholarConferences.Id)
                return BadRequest("ScholarConferencesID mismatch.");

            _context.Entry(ScholarConferences).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarConferencesExists(id))
                    return NotFound();

                throw;
            }

            return NoContent();
        }

        [HttpGet("ConferenceReportCount/{supervisorId}")]
        public async Task<IActionResult> GetConferenceReportCount(int supervisorId)
        {
            var result = await (
                from pr in _context.ScholarConferences
                join ss in _context.ScholarSupervisors
                    on pr.SID equals ss.SID
                where ss.SUPID1 == supervisorId
                group pr by pr.ConferenceStatus ?? ScholarConferenceDecisions.Pending into g
                select new
                {
                    Status = g.Key,
                    Count = g.Count()
                }
            ).ToListAsync();

            var response = new ResearchStatusCountDto
            {
                Approved = result
                    .FirstOrDefault(x => x.Status == ScholarConferenceDecisions.Approved)
                    ?.Count ?? 0,

                Rejected = result
                    .FirstOrDefault(x => x.Status == ScholarConferenceDecisions.Rejected)
                    ?.Count ?? 0,

                NotViewed = result
                    .FirstOrDefault(x => x.Status == ScholarConferenceDecisions.Pending)
                    ?.Count ?? 0
            };

            return Ok(response);
        }



        [HttpGet("ConferenceReport/{supervisorId}")]
        public async Task<IActionResult> GetConferenceReportByStatus(
    int supervisorId,
    [FromQuery] ScholarConferenceDecisions status)
        {
            // =========================
            // 1️⃣ Validate Supervisor
            // =========================
            var sup = await _context.SupervisorRegistrations
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SupId == supervisorId);

            if (sup == null)
                return NotFound("Supervisor not found");

            // =========================
            // 2️⃣ Load Conferences
            // =========================
            var conferences = await (
                from pr in _context.ScholarConferences
                join ss in _context.ScholarSupervisors
                    on pr.SID equals ss.SID
                join sr in _context.Scholars
                    on pr.SID equals sr.SID
                join d in _context.Departments
                    on sr.Subject_ID equals d.DepartmentID
                join sa in _context.ScholarAuths
                    on pr.SID equals sa.SID
                join sp in _context.ScholarUploads
                    on pr.SID equals sp.SID
                where ss.SUPID1 == supervisorId
                      && pr.ConferenceStatus == status
                      && sp.DocumentMasterID == 1
                select new
                {
                    pr.Id,
                    pr.SID,
                    sr.Email,
                    sr.Subject_ID,
                    DepartmentName = d.Subject,
                    sr.Year,
                    sr.Name,
                    sr.PhoneNumber,
                    sa.PermUserName,

                    pr.TitleOfPaper,
                    pr.ConferenceStatus,
                    pr.NameOfConference,
                    pr.LevelOfConference,
                    pr.PresentationCertificate,
                    pr.OrganizedBy,
                    pr.SponsoringAgency,
                    pr.Place,
                    pr.StartingDate,
                    pr.EndingDate,
                    pr.AuthorName,     // ✅ USE DIRECTLY
                    pr.Remarks,

                    SupervisorName = sup.FullName,
                    sp.Path
                }
            ).AsNoTracking().ToListAsync();

            if (!conferences.Any())
                return NotFound("No conference records found");

            // =========================
            // 3️⃣ Final Response
            // =========================
            var result = conferences.Select(c => new
            {
                c.Id,
                c.SID,
                c.Email,
                c.Subject_ID,
                c.Year,
                c.Name,
                c.PhoneNumber,
                c.PermUserName,
                c.DepartmentName,

                c.TitleOfPaper,
                c.ConferenceStatus,
                c.NameOfConference,
                c.LevelOfConference,
                c.PresentationCertificate,
                c.SponsoringAgency,
                c.OrganizedBy,
                c.Place,
                c.StartingDate,
                c.EndingDate,
                c.AuthorName,      // ✅ returned as-is
                c.Remarks,
                c.SupervisorName,
                c.Path
            });

            return Ok(result);
        }




        // ===============================
        // POST: api/ScholarConferences
        // ===============================
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create(
    [FromForm] ScholarConferences conference,
    IFormFile? uploadPaper)
        {
            if (uploadPaper != null)
            {
                conference.PresentationCertificate =
                    await _fileStorageService.SaveAsync(
                        uploadPaper,
                        "scholarConferences",
                        $"conference_{conference.SID}"
                    );
            }

            _context.ScholarConferences.Add(conference);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                conference.Id,
                conference.SID,
                conference.TitleOfPaper,
                conference.PresentationCertificate
            });
        }


        // PATCH: api/ScholarResearchPaper/5
        [HttpPatch("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(
    int id,
    [FromForm] ScholarConferences updatedConference,
    IFormFile? uploadPaper)
        {
            var conference = await _context.ScholarConferences.FindAsync(id);
            if (conference == null)
                return NotFound($"Conference with ID {id} not found.");

            // =========================
            // Scalar updates
            // =========================

            if (!string.IsNullOrWhiteSpace(updatedConference.TitleOfPaper))
                conference.TitleOfPaper = updatedConference.TitleOfPaper;

            if (!string.IsNullOrWhiteSpace(updatedConference.AuthorName))
                conference.AuthorName = updatedConference.AuthorName;

            if (!string.IsNullOrWhiteSpace(updatedConference.NameOfConference))
                conference.NameOfConference = updatedConference.NameOfConference;

            if (!string.IsNullOrWhiteSpace(updatedConference.LevelOfConference))
                conference.LevelOfConference = updatedConference.LevelOfConference;

            if (!string.IsNullOrWhiteSpace(updatedConference.SponsoringAgency))
                conference.SponsoringAgency = updatedConference.SponsoringAgency;

            if (updatedConference.StartingDate.HasValue)
                conference.StartingDate = updatedConference.StartingDate;

            if (updatedConference.EndingDate.HasValue)
                conference.EndingDate = updatedConference.EndingDate;

            if (!string.IsNullOrWhiteSpace(updatedConference.OrganizedBy))
                conference.OrganizedBy = updatedConference.OrganizedBy;

            if (!string.IsNullOrWhiteSpace(updatedConference.Place))
                conference.Place = updatedConference.Place;

            if (updatedConference.ConferenceStatus.HasValue)
                conference.ConferenceStatus = updatedConference.ConferenceStatus;

            if (!string.IsNullOrWhiteSpace(updatedConference.Remarks))
                conference.Remarks = updatedConference.Remarks;

            // =========================
            // File handling
            // =========================
            if (uploadPaper != null)
            {
                if (!string.IsNullOrWhiteSpace(conference.PresentationCertificate))
                {
                    await _fileStorageService.OverwriteAsync(
                        uploadPaper,
                        conference.PresentationCertificate
                    );
                }
                else
                {
                    conference.PresentationCertificate =
                        await _fileStorageService.SaveAsync(
                            uploadPaper,
                            "scholarConferences",
                            $"conference_{conference.SID}"
                        );
                }
            }

            await _context.SaveChangesAsync();
            return Ok(conference);
        }


        // ===============================
        // DELETE: api/ScholarConferences/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarConferences(int id)
        {
            var ScholarConferences = await _context.ScholarConferences.FindAsync(id);

            if (ScholarConferences == null)
                return NotFound();

            _context.ScholarConferences.Remove(ScholarConferences);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        public class ConferenceStatusPatchDto
        {
            public ScholarConferenceDecisions? ConferenceStatus { get; set; }
            public string? Remarks { get; set; }
        }

        [HttpPatch("UpdateStatus/{id}")]
        public async Task<IActionResult> UpdateConferenceStatus(
    int id,
    [FromBody] ConferenceStatusPatchDto dto)
        {
            var paper = await _context.ScholarConferences.FindAsync(id);
            if (paper == null)
                return NotFound("Conference record not found");

            // Update only provided fields
            if (dto.ConferenceStatus.HasValue)
                paper.ConferenceStatus = dto.ConferenceStatus;

            if (!string.IsNullOrWhiteSpace(dto.Remarks))
                paper.Remarks = dto.Remarks;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                paper.Id,
                paper.ConferenceStatus,
                paper.Remarks,
                Message = "Conference status updated successfully"
            });
        }


        // ===============================
        // HELPERS
        // ===============================
        private bool ScholarConferencesExists(int id)
        {
            return _context.ScholarConferences.Any(e => e.Id == id);
        }
    }
}

