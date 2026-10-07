using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;
using static RMS.Controllers.ProgressReportsController;
using static RMS.Controllers.ScholarConferencesController;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarResearchController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorageService;
        public ScholarResearchController(RMSDbContext context, IFileStorageService filestorageService)
        {
            _context = context;
            _fileStorageService = filestorageService;
        }

        // ===============================
        // GET: api/ScholarResearchPaper
        // ===============================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarResearchPaper>>> GetScholarResearchs()
        {
            return await _context.ScholarResearchPaper.ToListAsync();
        }

        // ===============================
        // GET: api/ScholarResearch/5
        // ===============================
        //[HttpGet("{id}")]
        //public async Task<IActionResult> GetScholarResearchPaper(int id)
        //{
        //    // 1️⃣ Get papers
        //    var papers = await _context.ScholarResearchPaper
        //        .Where(p => p.SID == id)
        //        .ToListAsync();

        //    if (!papers.Any())
        //        return NotFound();

        //    // 2️⃣ Collect all author IDs
        //    var authorIds = papers
        //        .SelectMany(p => p.AuthorName)
        //        .Distinct()
        //        .ToList();

        //    // 3️⃣ Load scholars
        //    var scholars = await _context.Scholars
        //        .Where(s => authorIds.Contains(s.SID))
        //        .ToDictionaryAsync(s => s.SID, s => $"{s.Name} {s.FName}");

        //    // 4️⃣ Map result
        //    var result = papers.Select(p => new
        //    {
        //        p.Id,
        //        p.TitleOfPaper,
        //        AuthorNames = p.AuthorName
        //            .Where(id => scholars.ContainsKey(id))
        //            .Select(id => scholars[id])
        //            .ToList(),
        //        p.NameOfJournal,
        //        p.YearOfPb,
        //        p.WebUrl,
        //        p.Citations,
        //        p.ImpactFactor,
        //        p.IssNo,
        //        p.ListedIn,
        //        p.Page,
        //        p.Volume,
        //        p.AuthorName,
        //        p.UploadPaper,

        //    });

        //    return Ok(result);
        //}

        [HttpGet("{sid}")]
        public async Task<IActionResult> GetScholarResearchPaper(int sid)
        {
            var papers = await _context.ScholarResearchPaper
                .Where(p => p.SID == sid)
                .Select(p => new
                {
                    p.Id,
                    p.TitleOfPaper,
                    p.AuthorName,          // already text
                    p.NameOfJournal,
                    p.YearOfPb,
                    p.WebUrl,
                    p.Citations,
                    p.ImpactFactor,
                    p.IssNo,
                    p.ListedIn,
                    p.Page,
                    p.Volume,
                    p.UploadPaper,
                    p.Status,
                    p.Remarks,
                    p.CreatedAt
                })
                .ToListAsync();

            return Ok(papers);
        }


        public class ResearchStatusCountDto
        {
            public int Approved { get; set; }
            public int Rejected { get; set; }
            public int NotViewed { get; set; }
        }

        [HttpGet("ResearchReportCount/{supervisorId}")]
        public async Task<IActionResult> GetResearchReportCount(int supervisorId)
        {
            var result = await (
                from pr in _context.ScholarResearchPaper
                join ss in _context.ScholarSupervisors
                    on pr.SID equals ss.SID
                where ss.SUPID1 == supervisorId
                group pr by pr.Status ?? ScholarResearchPaperDecision.Pending into g
                select new
                {
                    Status = g.Key,
                    Count = g.Count()
                }
            ).ToListAsync();

            var response = new ResearchStatusCountDto
            {
                Approved = result
                    .FirstOrDefault(x => x.Status == ScholarResearchPaperDecision.Approved)
                    ?.Count ?? 0,

                Rejected = result
                    .FirstOrDefault(x => x.Status == ScholarResearchPaperDecision.Rejected)
                    ?.Count ?? 0,

                NotViewed = result
                    .FirstOrDefault(x => x.Status == ScholarResearchPaperDecision.Pending)
                    ?.Count ?? 0
            };

            return Ok(response);
        }


        //       [HttpGet("ResearchReport/{supervisorId}")]
        //       public async Task<IActionResult> GetResearchReportByStatus(
        //  int supervisorId,
        //  [FromQuery] ScholarResearchPaperDecision status)
        //       {
        //           // 1️⃣ Supervisor
        //           var sup = await _context.SupervisorRegistrations
        //               .FirstOrDefaultAsync(s => s.SupId == supervisorId);

        //           if (sup == null)
        //               return NotFound("Supervisor not found");

        //           // 2️⃣ Load conferences (DB-safe query)
        //           var conferences = await (
        //    from pr in _context.ScholarResearchPaper
        //    join ss in _context.ScholarSupervisors
        //        on pr.SID equals ss.SID
        //    join sr in _context.Scholars
        //        on pr.SID equals sr.SID
        //    join d in _context.Departments
        //        on sr.Subject_ID equals d.DepartmentID
        //    join sa in _context.ScholarAuths
        //        on pr.SID equals sa.SID
        //    join sp in _context.ScholarUploads
        //        on pr.SID equals sp.SID
        //    where ss.SUPID1 == supervisorId
        //    where pr.Status == status
        //    where sp.DocumentMasterID == 1
        //    select new
        //    {
        //        pr.Id,
        //        pr.SID,
        //        sr.Email,
        //        sr.Subject_ID,
        //        DepartmentName = d.Subject, // ✅ HERE
        //        sr.Year,
        //        sr.Name,
        //        sr.PhoneNumber,
        //        sa.PermUserName,
        //        pr.TitleOfPaper,
        //        pr.UGCListNo,
        //        pr.ListedIn,
        //        pr.UploadPaper,
        //        pr.NameOfJournal,
        //        pr.YearOfPb,
        //        pr.Volume,
        //        pr.Status,
        //        pr.Page,
        //        pr.IssNo,
        //        pr.WebUrl,
        //        pr.Citations,
        //        pr.AuthorName,
        //        pr.Remarks,
        //        pr.ImpactFactor,
        //        pr.CreatedAt,
        //        SupervisorName = sup.FullName,
        //        sp.Path
        //    }
        //).ToListAsync();


        //           // 3️⃣ Collect unique author IDs
        //           var authorIds = conferences
        //               .SelectMany(c => c.AuthorName)
        //               .Distinct()
        //               .ToList();

        //           // 4️⃣ Load scholars
        //           var scholars = await _context.Scholars
        //               .Where(s => authorIds.Contains(s.SID))
        //               .ToDictionaryAsync(
        //                   s => s.SID,
        //                   s => $"{s.Name}"
        //               );

        //           // 5️⃣ Final response mapping
        //           var result = conferences.Select(c => new
        //           {
        //               c.Id,
        //               c.SID,
        //               c.Email,
        //               c.Subject_ID,
        //               c.Year,
        //               c.Name,
        //               c.WebUrl,
        //               c.PhoneNumber,
        //               c.PermUserName,
        //               c.DepartmentName,
        //               c.TitleOfPaper,
        //               c.UGCListNo,
        //               c.UploadPaper,
        //               c.IssNo,
        //               c.ListedIn,
        //               c.NameOfJournal,
        //               c.Volume,
        //               c.Page,
        //               c.Path,
        //               c.Citations,
        //               c.CreatedAt,
        //               c.ImpactFactor,
        //               c.Remarks,
        //               c.SupervisorName,
        //             c.Status,
        //               AuthorNames = c.AuthorName
        //                   .Where(id => scholars.ContainsKey(id))
        //                   .Select(id => scholars[id])
        //                   .ToList()
        //           });

        //           return Ok(result);
        //       }

        [HttpGet("ResearchReport/{supervisorId}")]
        public async Task<IActionResult> GetResearchReportByStatus(
    int supervisorId,
    [FromQuery] ScholarResearchPaperDecision status)
        {
            // =========================
            // 1️⃣ Validate supervisor
            // =========================
            var sup = await _context.SupervisorRegistrations
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SupId == supervisorId);

            if (sup == null)
                return NotFound("Supervisor not found");

            // =========================
            // 2️⃣ Main query
            // =========================
            var result = await (
                from pr in _context.ScholarResearchPaper
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
                      && pr.Status == status
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
                    pr.UGCListNo,
                    pr.ListedIn,
                    pr.UploadPaper,
                    pr.NameOfJournal,
                    pr.YearOfPb,
                    pr.Volume,
                    pr.Page,
                    pr.IssNo,
                    pr.WebUrl,
                    pr.Citations,
                    pr.AuthorName,     
                    pr.Remarks,
                    pr.ImpactFactor,
                    pr.CreatedAt,
                    pr.Status,

                    SupervisorName = sup.FullName,
                    sp.Path
                }
            ).AsNoTracking().ToListAsync();

            if (!result.Any())
                return NotFound("No research papers found");

            return Ok(result);
        }




        // ===============================
        // PUT: api/ScholarResearchPaper/5
        // ===============================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarResearchPaper(int id, ScholarResearchPaper ScholarResearchPaper)
        {
            if (id != ScholarResearchPaper.Id)
                return BadRequest("ScholarResearchPaperID mismatch.");

            _context.Entry(ScholarResearchPaper).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarResearchPaperExists(id))
                    return NotFound();

                throw;
            }

            return NoContent();
        }

        // ===============================
        // POST: api/ScholarResearchPaper
        // ===============================
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create(
    [FromForm] ScholarResearchPaper paper,
    IFormFile? uploadPaper)
        {
            if (uploadPaper != null)
            {
                paper.UploadPaper = await _fileStorageService.SaveAsync(
                    uploadPaper,
                    "scholarPapers",
                    $"paper_{paper.SID}"
                );
            }

            paper.CreatedAt = DateTime.UtcNow;

            _context.ScholarResearchPaper.Add(paper);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                paper.Id,
                paper.SID,
                paper.TitleOfPaper,
                paper.UploadPaper
            });
        }


        // PATCH: api/ScholarResearchPaper/5
        //[HttpPatch("{id}")]
        //public async Task<IActionResult> Update(int id, [FromForm] ScholarResearchPaper updatedPaper, IFormFile? uploadPaper)
        //{
        //    var paper = await _context.ScholarResearchPaper.FindAsync(id);
        //    if (paper == null) return NotFound();

        //    // Update fields if not null or default
        //    paper.TitleOfPaper = updatedPaper.TitleOfPaper ?? paper.TitleOfPaper;
        //    paper.AuthorName =  updatedPaper.AuthorName : paper.AuthorName;
        //    paper.NameOfJournal = updatedPaper.NameOfJournal ?? paper.NameOfJournal;
        //    paper.YearOfPb = updatedPaper.YearOfPb != 0 ? updatedPaper.YearOfPb : paper.YearOfPb;
        //    paper.Volume = updatedPaper.Volume ?? paper.Volume;
        //    paper.IssNo = updatedPaper.IssNo ?? paper.IssNo;
        //    paper.Page = updatedPaper.Page != 0 ? updatedPaper.Page : paper.Page;
        //    paper.Citations = updatedPaper.Citations ?? paper.Citations;
        //    paper.ImpactFactor = updatedPaper.ImpactFactor ?? paper.ImpactFactor;
        //    paper.WebUrl = updatedPaper.WebUrl ?? paper.WebUrl;
        //    paper.ListedIn = updatedPaper.ListedIn ?? paper.ListedIn;
        //    paper.UGCListNo = updatedPaper.UGCListNo ?? paper.UGCListNo;
        //    paper.Status = updatedPaper.Status ?? paper.Status;
        //    paper.Remarks = updatedPaper.Remarks ?? paper.Remarks;
        //    // Handle file upload
        //    if (uploadPaper != null)
        //    {
        //        if (!string.IsNullOrEmpty(paper.UploadPaper))
        //        {
        //            await _fileStorageService.OverwriteAsync(uploadPaper, paper.UploadPaper);
        //        }
        //        else
        //        {
        //            paper.UploadPaper = await _fileStorageService.SaveAsync(uploadPaper, "scholarPapers", $"paper_{paper.SID}");
        //        }
        //    }

        //    await _context.SaveChangesAsync();
        //    return Ok(paper);
        //}

        [HttpPatch("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(
    int id,
    [FromForm] ScholarResearchPaper updatedPaper,
    IFormFile? uploadPaper)
        {
            var paper = await _context.ScholarResearchPaper.FindAsync(id);
            if (paper == null)
                return NotFound($"ScholarResearchPaper with ID {id} not found.");

            // =========================
            // Scalar field updates
            // =========================

            if (!string.IsNullOrWhiteSpace(updatedPaper.TitleOfPaper))
                paper.TitleOfPaper = updatedPaper.TitleOfPaper;

            if (!string.IsNullOrWhiteSpace(updatedPaper.AuthorName))
                paper.AuthorName = updatedPaper.AuthorName;

            if (!string.IsNullOrWhiteSpace(updatedPaper.NameOfJournal))
                paper.NameOfJournal = updatedPaper.NameOfJournal;

            if (updatedPaper.YearOfPb.HasValue)
                paper.YearOfPb = updatedPaper.YearOfPb;

            if (!string.IsNullOrWhiteSpace(updatedPaper.Volume))
                paper.Volume = updatedPaper.Volume;

            if (!string.IsNullOrWhiteSpace(updatedPaper.IssNo))
                paper.IssNo = updatedPaper.IssNo;

            if (updatedPaper.Page.HasValue)
                paper.Page = updatedPaper.Page;

            if (!string.IsNullOrWhiteSpace(updatedPaper.Citations))
                paper.Citations = updatedPaper.Citations;

            if (!string.IsNullOrWhiteSpace(updatedPaper.ImpactFactor))
                paper.ImpactFactor = updatedPaper.ImpactFactor;

            if (!string.IsNullOrWhiteSpace(updatedPaper.WebUrl))
                paper.WebUrl = updatedPaper.WebUrl;

            if (!string.IsNullOrWhiteSpace(updatedPaper.ListedIn))
                paper.ListedIn = updatedPaper.ListedIn;

            if (!string.IsNullOrWhiteSpace(updatedPaper.UGCListNo))
                paper.UGCListNo = updatedPaper.UGCListNo;

            if (updatedPaper.Status.HasValue)
                paper.Status = updatedPaper.Status;

            if (!string.IsNullOrWhiteSpace(updatedPaper.Remarks))
                paper.Remarks = updatedPaper.Remarks;

            // =========================
            // File upload handling
            // =========================
            if (uploadPaper != null)
            {
                if (!string.IsNullOrWhiteSpace(paper.UploadPaper))
                {
                    await _fileStorageService.OverwriteAsync(uploadPaper, paper.UploadPaper);
                }
                else
                {
                    paper.UploadPaper = await _fileStorageService.SaveAsync(
                        uploadPaper,
                        "scholarPapers",
                        $"paper_{paper.SID}"
                    );
                }
            }

            await _context.SaveChangesAsync();
            return Ok(paper);
        }



        public class ResearchStatusPatchDto
        {
            public ScholarResearchPaperDecision? ResearchStatus { get; set; }
            public string? Remarks { get; set; }
        }

        [HttpPatch("UpdateResearchStatus/{id}")]
        public async Task<IActionResult> UpdateResearchStatus(
    int id,
    [FromBody] ResearchStatusPatchDto dto)
        {
            var paper = await _context.ScholarResearchPaper.FindAsync(id);
            if (paper == null)
                return NotFound("Conference record not found");

            // Update only provided fields
            if (dto.ResearchStatus.HasValue)
                paper.Status = dto.ResearchStatus;

            if (!string.IsNullOrWhiteSpace(dto.Remarks))
                paper.Remarks = dto.Remarks;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                paper.Id,
                paper.Status,
                paper.Remarks,
                Message = "Research status updated successfully"
            });
        }

        // ===============================
        // DELETE: api/ScholarResearchPaper/5
        // ===============================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarResearchPaper(int id)
        {
            var ScholarResearchPaper = await _context.ScholarResearchPaper.FindAsync(id);

            if (ScholarResearchPaper == null)
                return NotFound();

            _context.ScholarResearchPaper.Remove(ScholarResearchPaper);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ===============================
        // HELPERS
        // ===============================
        private bool ScholarResearchPaperExists(int id)
        {
            return _context.ScholarResearchPaper.Any(e => e.Id == id);
        }
    }
}

