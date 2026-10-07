using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ThesisController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;
        private readonly IFileStorageService _fileStorageService;

        public ThesisController(
            RMSDbContext context,
            IFileService fileService,
            IFileStorageService fileStorageService)
        {
            _context = context;
            _fileService = fileService;
            _fileStorageService = fileStorageService;
        }



        [HttpGet("Thesis-Evaluation-Dcument")]
        public async Task<IActionResult> GetAllScholarFiles([FromQuery] int sid)
        {
            if (sid <= 0)
                return BadRequest("Valid SID is required.");

            // =========================
            // Synopsis
            // =========================
            var synopsis = await _context.SynopsisRDCs
                .Where(x => x.SID == sid)
                .Select(x => new
                {
                    x.Synopsis1FilePath,
                    x.Synopsis2FilePath
                })
                .FirstOrDefaultAsync();

            string? synopsisFilePath =
                !string.IsNullOrWhiteSpace(synopsis?.Synopsis2FilePath)
                    ? synopsis.Synopsis2FilePath
                    : synopsis?.Synopsis1FilePath;

            // =========================
            // Thesis
            // =========================
            var thesis = await _context.Thesis
                .Where(t => t.SID == sid)
                .Select(t => new
                {
                    t.Thesis_File,
                    t.Thesis_Summary_File
                })
                .FirstOrDefaultAsync();

            // =========================
            // Research Papers (First 2)
            // =========================
            var researchPapers = await _context.ScholarResearchPaper
                .Where(rp => rp.SID == sid)
                .OrderBy(rp => rp.CreatedAt)
                .Select(rp => rp.UploadPaper)
                .Take(2)
                .ToListAsync();

            string? researchPaper1 = researchPapers.Count > 0 ? researchPapers[0] : null;
            string? researchPaper2 = researchPapers.Count > 1 ? researchPapers[1] : null;

            // =========================
            // Conferences (Dynamic Naming)
            // =========================
            var conferenceFiles = await _context.ScholarConferences
                .Where(c => c.SID == sid && !string.IsNullOrEmpty(c.PresentationCertificate))
                .OrderBy(c => c.StartingDate)
                .Select(c => c.PresentationCertificate)
                .ToListAsync();

            var conferenceResult = new Dictionary<string, string?>();

            for (int i = 0; i < conferenceFiles.Count; i++)
            {
                conferenceResult[$"Conference{i + 1}"] = conferenceFiles[i];
            }

            if (
                synopsis == null &&
                thesis == null &&
                researchPapers.Count == 0 &&
                conferenceFiles.Count == 0
            )
            {
                return NotFound("No records found for this SID.");
            }

            // =========================
            // Final Response
            // =========================
            var response = new Dictionary<string, object?>
    {
        { "SID", sid },
        { "SynopsisFilePath", synopsisFilePath },
        { "ThesisFile", thesis?.Thesis_File },
        { "ThesisSummaryFile", thesis?.Thesis_Summary_File },
        { "ResearchPaper1", researchPaper1 },
        { "ResearchPaper2", researchPaper2 }
    };

            // Merge conference keys
            foreach (var conf in conferenceResult)
            {
                response.Add(conf.Key, conf.Value);
            }

            return Ok(response);
        }




        [HttpGet("completed")]
        public async Task<IActionResult> GetCompletedThesis([FromQuery] int? sid)
        {
            var query = _context.Thesis
                .Where(t => t.Status == ThesisStatus.ThesisCompleted);

            if (sid.HasValue && sid.Value > 0)
            {
                query = query.Where(t => t.SID == sid.Value);
            }

            var result = await query.ToListAsync();

            if (!result.Any())
                return NotFound("No completed thesis found.");

            return Ok(result);
        }

        [HttpGet("plagiarism")]
        public async Task<IActionResult> GetThesisByPlagCheck(
     [FromQuery] int? plagCheck)
        {
            var query =
                from t in _context.Thesis
                join s in _context.Scholars
                    on t.SID equals s.SID
                join ss in _context.ScholarSupervisors
                    on t.SID equals ss.SID into ssJoin
                from ss in ssJoin.DefaultIfEmpty()
                select new { t, s, ss };

            // 🔹 Optional filter
            if (plagCheck.HasValue)
            {
                query = query.Where(x =>
                    x.t.PlagCheck.HasValue &&
                    (int)x.t.PlagCheck == plagCheck.Value);
            }

            var result = await query
                .Select(x => new
                {
                    SID = x.s.SID,
                    ScholarName = x.s.Name,

                    FirstSupervisor =
                        x.ss != null
                        ? _context.SupervisorRegistrations
                            .Where(sr => sr.SupId == x.ss.SUPID1)
                            .Select(sr => sr.FullName)
                            .FirstOrDefault()
                        : null,

                    SecondSupervisor =
                        x.ss != null && x.ss.SUPID2.HasValue
                        ? _context.SupervisorRegistrations
                            .Where(sr => sr.SupId == x.ss.SUPID2.Value)
                            .Select(sr => sr.FullName)
                            .FirstOrDefault()
                        : null,

                    CoSupervisor =
                        x.ss != null && x.ss.COSUPID.HasValue
                        ? _context.SupervisorRegistrations
                            .Where(sr => sr.SupId == x.ss.COSUPID.Value)
                            .Select(sr => sr.FullName)
                            .FirstOrDefault()
                        : null
                })
                .ToListAsync();

            if (!result.Any())
                return NotFound("No records found.");

            return Ok(result);
        }


        [HttpGet("Thesis-component-report/{sid}")]
        public async Task<IActionResult> GetScholarAcademicFlags(int sid)
        {
            var prePhDMarksheet = await _context.CourseWorks
                .AnyAsync(c => c.SID == sid && c.CourseWorkStatus == "1");

            var synopsis = await _context.SynopsisRDCs
                .AnyAsync(s =>
                    s.SID == sid &&
                    (s.Synopsis1Decision == SynopsisDecisions.SynopsisApproved || s.Synopsis2Decision == SynopsisDecisions.SynopsisApproved));

            var rdcLetter = await _context.SynopsisRDCs
                .AnyAsync(s =>
                    s.SID == sid &&
                    (s.Syn1RDC1ProceedingStatus == RDCProceedingDecisions.RDCProceedingApproved ||
                     s.Syn2RDC1ProceedingStatus == RDCProceedingDecisions.RDCProceedingApproved ||
                     s.Synopsis1Decision == SynopsisDecisions.SynopsisApproved ||
                     s.Synopsis2Decision == SynopsisDecisions.SynopsisApproved ||
                     !string.IsNullOrEmpty(s.DecisionFilePath) ||
                     !string.IsNullOrEmpty(s.ProceedingFilePath) ||
                     !string.IsNullOrEmpty(s.Syn1RDC1DecisionFilePath)))
                || await _context.WorkflowInstances.AnyAsync(i =>
                    (i.WorkflowID == 6 || (i.Workflow != null && i.Workflow.Name.ToLower().Contains("synopsis"))) &&
                    i.EntityType == "SynopsisRDC" &&
                    i.EntityID == sid &&
                    i.Status == "Approved")
                || await _context.Scholars.AnyAsync(sch => sch.SID == sid && sch.DecisionStatus >= DecisionStatus.SysnopsisApproved);

            // ✅ FIXED Progress Report
            var verifiedProgressReportCount = await _context.ProgressReports
                .CountAsync(p => p.SID == sid && p.isApprovedbySupervisor == 1);

            var progressReport = verifiedProgressReportCount >= 5;

            var scholarResearchPaper = await _context.ScholarResearchPaper
                .CountAsync(r => r.SID == sid) >= 2;

            var conferences = await _context.ScholarConferences
                .CountAsync(c => c.SID == sid) >= 2;

            return Ok(new
            {
                SID = sid,
                PrePhDMarksheet = prePhDMarksheet,
                Synopsis = synopsis,
                RDCLetter = rdcLetter,
                ProgressReport = progressReport,
                Conferences = conferences,
                ResearchPaper = scholarResearchPaper
            });
        }



        [HttpGet("check-all-upload/{sid}")]
        public async Task<IActionResult> CheckAllUploads(int sid)
        {
            var thesis = await _context.Thesis
                .Where(t => t.SID == sid)
                .OrderByDescending(t => t.UploadDate)
                .FirstOrDefaultAsync();

            if (thesis == null)
                return NotFound("Thesis record not found.");

            bool allUploaded =
                !string.IsNullOrEmpty(thesis.Thesis_File) &&
                !string.IsNullOrEmpty(thesis.Thesis_Summary_File) &&
                !string.IsNullOrEmpty(thesis.No_Dues_Cretificate_File) &&
                !string.IsNullOrEmpty(thesis.Pre_PhD_Notice_File) &&
                !string.IsNullOrEmpty(thesis.Pre_PhD_Certificate_File)
                && (thesis.PlagCheck == ThesisStatus.PlagApprove || thesis.PlagCheck == ThesisStatus.PlagPending);



                ;

            
                /*&&
                !string.IsNullOrEmpty(thesis.Time_Extension_Letter_File);*/

            return Ok(new
            {
                SID = sid,
                IsAllUploaded = allUploaded
            });
        }


        [HttpGet("plagiarism-status/{sid:int}")]
        public async Task<IActionResult> GetPlagiarismStatus(int sid)
        {
            var thesis = await _context.Thesis
                .Where(t => t.SID == sid)
                .OrderByDescending(t => t.UploadDate) // latest record
                .Select(t => new
                {
                    t.SID,
                    PlagCheck = t.PlagCheck,                 // enum value
                    PlagCheckName = t.PlagCheck.HasValue
                        ? t.PlagCheck.Value.ToString()
                        : null,
                    t.PlagRemarks,
                    t.PlagReportFile,
                    t.PlagVerifiedBy,
                    t.PlagVerifiedAt
                })
                .FirstOrDefaultAsync();

            if (thesis == null)
                return NotFound("Thesis record not found.");

            return Ok(thesis);
        }




        [HttpGet]
        public async Task<IActionResult> Get()
          => Ok(await _context.Thesis.ToListAsync());

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var thesis = await _context.Thesis.FirstOrDefaultAsync(u => u.SID == id);
            return thesis == null ? NotFound() : Ok(thesis);
        }

        // =====================================================
        // POST: CREATE (ALL FIELDS + FILES)
        // =====================================================
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadThesis([FromForm] ThesisUploadDto input)
        {
            if (input.SID <= 0)
                return BadRequest("SID is required.");

            bool exists = await _context.Thesis.AnyAsync(t => t.SID == input.SID);
            if (exists)
                return Conflict($"Thesis already uploaded for SID {input.SID}");

            var thesis = new Thesis
            {
                SID = input.SID,
                Thesis_Title = input.Thesis_Title,
                Fee = input.Fee,
                TxnID = input.TxnID,
                Txn_Date = input.Txn_Date,
                Thesis_No = input.Thesis_No,
                Thesis_File_No = input.Thesis_File_No,
                Status = input.Status,
                StatusApprovedDate = input.StatusApprovedDate,
                Remarks = input.Remarks,
                Verified_By = input.Verified_By,
                Verified_At = input.Verified_At,

                PlagCheck = input.PlagCheck,
                PlagRemarks = input.PlagRemarks,
                PlagVerifiedBy = input.PlagVerifiedBy,
                PlagVerifiedAt = DateTime.Now,

                UploadDate = DateTime.Now
            };

            // 1️⃣ Save files first
            await SaveFiles(input, thesis);

            // 2️⃣ Save thesis
            _context.Thesis.Add(thesis);
            await _context.SaveChangesAsync();   // ThesisID generated here

            // 3️⃣ Generate fees AFTER thesis exists
            await GenerateFees(input, thesis);

            return Ok(new
            {
                Message = "Thesis uploaded successfully",
                thesis.ThesisID
            });
        }
        private async Task GenerateFees(ThesisUploadDto input, Thesis thesis)
        {
            var categoryRaw = await _context.ScholarPersonalDetails
                .Where(x => x.SID == input.SID)
                .Select(x => x.Category)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(categoryRaw))
                throw new Exception("Scholar category not found.");

            var category = categoryRaw.Trim().ToLower();
            bool isUROBC = category == "general" || category == "obc";
            bool isSCST = category == "sc" || category == "st";

            // ================= Plag Fee =================
            if (input.PlagReportFile != null || input.PlagCheck == ThesisStatus.PlagApprove)
            {
                bool plagExists = await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == input.SID &&
                    p.PaymentCategory == PaymentCategory.PlagiarismFee);

                if (!plagExists)
                {
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = input.SID,
                        PaymentCategory = PaymentCategory.PlagiarismFee,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = "Plag Fee",
                        Remark = $"Generated after thesis upload (ThesisID: {thesis.ThesisID})"
                    });
                }
            }

            // ================= Thesis Fee =================
            if (!string.IsNullOrWhiteSpace(thesis.Thesis_File))
            {

                bool thesisFeeExists = await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == input.SID &&
                    p.PaymentCategory == PaymentCategory.Thesis);

                if (!thesisFeeExists)
                {
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = input.SID,
                        PaymentCategory = PaymentCategory.Thesis,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = "Scholar Thesis Fee",
                        Remark = $"Generated after thesis upload (ThesisID: {thesis.ThesisID})"
                    });
                }
            }

            await _context.SaveChangesAsync();
        }


        // =====================================================
        // PATCH: UPDATE (ALL FIELDS + FILES)
        // =====================================================
        [HttpPatch("upload/{sid:int}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> PatchThesis(
            int sid,
            [FromForm] ThesisUploadDto input)
        {
            var thesis = await _context.Thesis
                .FirstOrDefaultAsync(t => t.SID == sid);

            if (thesis == null)
                return NotFound("Thesis not found.");

            // -------- Fields (partial update) --------
            if (input.SID > 0) thesis.SID = input.SID;
            if (input.Thesis_Title != null) thesis.Thesis_Title = input.Thesis_Title;
            if (input.Fee.HasValue) thesis.Fee = input.Fee;
            if (input.TxnID != null) thesis.TxnID = input.TxnID;
            if (input.Txn_Date != default) thesis.Txn_Date = input.Txn_Date;
            if (input.Thesis_No != null) thesis.Thesis_No = input.Thesis_No;
            if (input.Thesis_File_No != null) thesis.Thesis_File_No = input.Thesis_File_No;
            if (input.Status.HasValue) thesis.Status = input.Status;
            if (input.StatusApprovedDate != default) thesis.StatusApprovedDate = DateTime.Now;
            if (input.Remarks != null) thesis.Remarks = input.Remarks;
            if (input.Verified_By.HasValue) thesis.Verified_By = input.Verified_By;
            if (input.Verified_At.HasValue) thesis.Verified_At = input.Verified_At;
            if (input.PlagCheck.HasValue)
            {
                thesis.PlagCheck = input.PlagCheck;
                thesis.PlagVerifiedAt = input.PlagVerifiedAt ?? DateTime.Now;
            }
            if (input.PlagRemarks != null) thesis.PlagRemarks = input.PlagRemarks;
            if (input.PlagVerifiedBy.HasValue) thesis.PlagVerifiedBy = input.PlagVerifiedBy;

            await SaveFiles(input, thesis);

            // =====================================================
            // 🔹 GET SCHOLAR CATEGORY (FROM ScholarPersonalDetails)
            // =====================================================
            var categoryRaw = await _context.ScholarPersonalDetails
                .Where(x => x.SID == sid)
                .Select(x => x.Category)
                .FirstOrDefaultAsync();

            var category = categoryRaw?.Trim().ToLower() ?? string.Empty;
            bool isUROBC = category == "general" || category.Contains("obc");
            bool isSCST = category.Contains("sc") || category.Contains("st");

            // =====================================================
            // 🔹 PLAG FEE (FCID = 13)
            // =====================================================
            if (input.PlagReportFile != null || input.PlagCheck.HasValue)
            {
                bool plagExists = await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == sid &&
                    p.PaymentCategory == PaymentCategory.PlagiarismFee);

                if (!plagExists)
                {
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = sid,
                        PaymentCategory = PaymentCategory.PlagiarismFee,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = "Plag Fee",
                        Remark = "Plag fee generated on thesis plagiarism submission"
                    });
                }
            }
         
            await _context.SaveChangesAsync();
            return Ok("Thesis updated successfully.");
        }

        //
        // =====================================================
        // FILE HANDLING (UNCHANGED)
        // =====================================================
        private async Task SaveFiles(ThesisUploadDto input, Thesis thesis)
        {
            var subFolder = Path.Combine("ThesisFiles", thesis.SID.ToString());

            if (input.Thesis_File != null)
                thesis.Thesis_File = await _fileStorageService.SaveAsync(
                    input.Thesis_File, subFolder, "THESIS");

            if (input.Thesis_Summary_File != null)
                thesis.Thesis_Summary_File = await _fileStorageService.SaveAsync(
                    input.Thesis_Summary_File, subFolder, "THESIS_SUMMARY");

            if (input.No_Dues_Cretificate_File != null)
                thesis.No_Dues_Cretificate_File = await _fileStorageService.SaveAsync(
                    input.No_Dues_Cretificate_File, subFolder, "NO_DUES");

            if (input.Pre_PhD_Notice_File != null)
                thesis.Pre_PhD_Notice_File = await _fileStorageService.SaveAsync(
                    input.Pre_PhD_Notice_File, subFolder, "PRE_PHD_NOTICE");

            if (input.Pre_PhD_Certificate_File != null)
                thesis.Pre_PhD_Certificate_File = await _fileStorageService.SaveAsync(
                    input.Pre_PhD_Certificate_File, subFolder, "PRE_PHD_CERT");

            if (input.Time_Extension_Letter_File != null)
                thesis.Time_Extension_Letter_File = await _fileStorageService.SaveAsync(
                    input.Time_Extension_Letter_File, subFolder, "TIME_EXTENSION");

            if (input.PlagReportFile != null)
                thesis.PlagReportFile = await _fileStorageService.SaveAsync(
                    input.PlagReportFile, subFolder, "PLAGREPORT");
        }


        // =====================================================
        // DTO (ALL FIELDS + FILES)
        // =====================================================
        public class ThesisUploadDto
        {
            public int SID { get; set; }
            public string? Thesis_Title { get; set; }

            public int? Fee { get; set; }
            public string? TxnID { get; set; }
            public DateTime? Txn_Date { get; set; }

            public string? Thesis_No { get; set; }
            public string? Thesis_File_No { get; set; }

            public ThesisStatus? Status { get; set; }
            public DateTime? StatusApprovedDate { get; set; }

            public string? Remarks { get; set; }
            public int? Verified_By { get; set; }
            public DateTime? Verified_At { get; set; }

            // 🔹 Plagiarism
            public ThesisStatus? PlagCheck { get; set; }
            public string? PlagRemarks { get; set; }
            public int? PlagVerifiedBy { get; set; }
            public DateTime? PlagVerifiedAt { get; set; }

            // 🔹 Files
            public IFormFile? Thesis_File { get; set; }
            public IFormFile? Thesis_Summary_File { get; set; }
            public IFormFile? No_Dues_Cretificate_File { get; set; }
            public IFormFile? Pre_PhD_Notice_File { get; set; }
            public IFormFile? Pre_PhD_Certificate_File { get; set; }
            public IFormFile? Time_Extension_Letter_File { get; set; }

            // 🔹 Plag Report PDF
            public IFormFile? PlagReportFile { get; set; }
        }

    }
}
