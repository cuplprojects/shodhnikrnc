using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NPOI.SS.Formula.Functions;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System.Runtime.Intrinsics.X86;
using RMS.Models.Enums;
using DocumentFormat.OpenXml.Bibliography;
using Microsoft.AspNetCore.Authorization;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AwardExamineeController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorageService;
        public AwardExamineeController(RMSDbContext context, IFileStorageService fileStorageService)
        {
            _context = context;
            _fileStorageService = fileStorageService;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetConfidential(int id)
        {
            var confidential = await (
                from v in _context.Viva_VoceExaminers.AsNoTracking()

                    // ================= Examiner =================
                join e in _context.ExaminerLists.AsNoTracking()
                    on v.ExaminerId equals e.Id

                // ================= Designation (LEFT JOIN) =================
                join d in _context.Designations.AsNoTracking()
                    on e.Designation equals d.DesignationID into des
                from d in des.DefaultIfEmpty()

                    // ================= Scholar =================
                join reg in _context.Scholars.AsNoTracking()
                    on v.Sid equals reg.SID into regi
                from reg in regi.DefaultIfEmpty()

                    // ================= Scholar Personal Details =================
                join pers in _context.ScholarPersonalDetails.AsNoTracking()
                    on v.Sid equals pers.SID into personal
                from pers in personal.DefaultIfEmpty()

                    // ================= Department =================
                join subj in _context.Departments.AsNoTracking()
                    on reg.Subject_ID equals subj.DepartmentID into sj
                from subj in sj.DefaultIfEmpty()

                    // ================= Scholar Auth =================
                join auth in _context.ScholarAuths.AsNoTracking()
                    on v.Sid equals auth.SID into au
                from auth in au.DefaultIfEmpty()

                    // ================= Scholar → Supervisor Mapping =================
                join ss in _context.ScholarSupervisors.AsNoTracking()
                    on v.Sid equals ss.SID into ssj
                from ss in ssj.DefaultIfEmpty()

                    // ================= Supervisor =================
                join s in _context.SupervisorRegistrations.AsNoTracking()
                    on ss.SUPID1 equals s.SupId into sup
                from s in sup.DefaultIfEmpty()

                join sp in _context.SupervisorPersonal.AsNoTracking()
                    on ss.SUPID1 equals sp.SupId into supPer
                from sp in supPer.DefaultIfEmpty()

                    // ================= Supervisor Education =================
                join se in _context.SupervisorEducations.AsNoTracking()
                    on ss.SUPID1 equals se.SupId into supEdu
                from se in supEdu.DefaultIfEmpty()

                    // ================= University =================
                join u in _context.Universities.AsNoTracking()
                    on se.UniversityId equals u.UniversityId into uni
                from u in uni.DefaultIfEmpty()

                    // ================= Award =================
                join ae in _context.AwardExaminees.AsNoTracking()
                    on v.Sid equals ae.SId into award
                from ae in award.DefaultIfEmpty()

                    // ================= Scholar Upload =================
                join su in _context.ScholarUploads.AsNoTracking()
                        .Where(x => x.DocumentMasterID == 1)
                    on v.Sid equals su.SID into uploads
                from su in uploads.DefaultIfEmpty()

                where v.Sid == id

                select new
                {
                    v.Sid,

                    // ================= Scholar =================
                    auth.PermUserName,
                    reg.Name,
                    reg.Year,
                    reg.Email,
                    pers.CorrespondenceAddress,
                    pers.PermanentAddress,
                    reg.Subject_ID,
                    SubjectName = subj != null ? subj.Subject : null,

                    // ================= Examiner =================
                    ExaminerName = e.Name,
                    ExaminerEmail = e.Email,
                    e.ContactNo,
                    e.Address,
                    e.State,
                    e.Institution,
                    e.Designation,

                    // ================= Designation =================
                    DesignationName = d != null ? d.DesignationName : null,

                    // ================= Supervisor =================
                    SupervisorName = s != null ? s.FullName : null,
                    SupervisorEmail = s != null ? s.Email : null,
                    SupervisorContact = s != null ? s.MobileNo : null,
                    SupervisorAddress = sp != null ? sp.PeAddress : null,

                    // ================= Supervisor Education =================
                    SupervisorUniversity = u != null ? u.UniversityName : null,

                    // ================= Upload =================
                    ProfileImage = su != null ? su.Path : null,

                    // ================= Award Status =================
                    AwardID = (int?)ae.Id,
                    UploadDecision = ae != null? ae.uploadDecision : 0,
                    UploadRemark = ae!=null? ae.UploadRemark : null,
                    AwardFilePath = ae!=null? ae.AwardFilePath : null,
                    Level1Status = ae != null ? ae.Level1ApprovalStatus : null,
                    Level1Remark = ae != null ? ae.Level1Remark : null,

                    Level2Status = ae != null ? ae.Level2ApprovalStatus : null,
                    Level2Remark = ae != null ? ae.Level2Remark : null,

                    Level3Status = ae != null ? ae.Level3ApprovalStatus : null,
                    Level3Remark = ae != null ? ae.Level3Remark : null,

                    Level4Status = ae != null ? ae.Level4ApprovalStatus : null,
                    Level4Remark = ae != null ? ae.Level4Remark : null,

                    Level5Status = ae != null ? ae.Level5ApprovalStatus : null,
                    Level5Remark = ae != null ? ae.Level5Remark : null
                }
            )
            // 🔥 DUPLICATE FIX 🔥
            .GroupBy(x => x.Sid)
            .Select(g => g.First())
            .ToListAsync();

            if (!confidential.Any())
                return NotFound("No viva voce examiner found");

            return Ok(confidential);
        }




        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateAwardExaminee(
    [FromForm] AwardExamineeCreateDto request)
        {
            if (request == null || request.SId <= 0)
                return BadRequest("Invalid data");

            // Prevent duplicate entry per Scholar
            var exists = await _context.AwardExaminees
                .AnyAsync(x => x.SId == request.SId);

            if (exists)
                return BadRequest("Record already exists for this Scholar");

            string? filePath = null;

            if (request.AwardFile != null)
            {
                filePath =  await _fileStorageService.SaveAsync(
                    request.AwardFile,
                    "progress-reports",
                    $"Award_{request.SId}"
                );
            }

            var award = new AwardExaminee
            {
                SId = request.SId,
                UploadRemark = request.UploadRemark,
                uploadDecision = request.UploadDecision,
                AwardFilePath = filePath
            };

            _context.AwardExaminees.Add(award);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "AwardExaminee created successfully",
                award.Id,
                award.AwardFilePath
            });
        }

        [HttpGet("GetScholarsForLevel1")]
        public async Task<IActionResult> GetScholarsForLevel1()
        {
            var scholars = await (from sch in  _context.Scholars
                                  join ae in _context.AwardExaminees
                                  on sch.SID equals ae.SId
                                  where ae.Level1ApprovalStatus == null
                                  select sch
                                  ).ToListAsync();
            if (scholars == null)
                return NotFound();
            return Ok(scholars);
        }

        [HttpGet("GetScholarsForLevel2")]
        public async Task<IActionResult> GetScholarsForLevel2()
        {
            var scholars = await (from sch in _context.Scholars
                                  join ae in _context.AwardExaminees
                                  on sch.SID equals ae.SId
                                  where ae.Level2ApprovalStatus == null && ae.Level1ApprovalStatus.HasValue
                                  select sch
                                  ).ToListAsync();
            if (scholars == null)
                return NotFound();
            return Ok(scholars);
        }

        [HttpGet("GetScholarsForLevel3")]
        public async Task<IActionResult> GetScholarsForLevel3()
        {
            var scholars = await (from sch in _context.Scholars
                                  join ae in _context.AwardExaminees
                                  on sch.SID equals ae.SId
                                  where ae.Level3ApprovalStatus == null && ae.Level2ApprovalStatus.HasValue
                                  select sch
                                  ).ToListAsync();
            if (scholars == null)
                return NotFound();
            return Ok(scholars);
        }

        [HttpGet("GetScholarsForLevel4")]
        public async Task<IActionResult> GetScholarsForLevel4()
        {
            var scholars = await (from sch in _context.Scholars
                                  join ae in _context.AwardExaminees
                                  on sch.SID equals ae.SId
                                  where ae.Level4ApprovalStatus == null && ae.Level3ApprovalStatus.HasValue
                                  select sch
                                  ).ToListAsync();
            if (scholars == null)
                return NotFound();
            return Ok(scholars);
        }

        [HttpGet("GetScholarsForLevel5")]
        public async Task<IActionResult> GetScholarsForLevel5()
        {
            var scholars = await (from sch in _context.Scholars
                                  join ae in _context.AwardExaminees
                                  on sch.SID equals ae.SId
                                  where ae.Level5ApprovalStatus == null && ae.Level4ApprovalStatus.HasValue
                                  select sch
                                  ).ToListAsync();
            if (scholars == null)
                return NotFound();
            return Ok(scholars);
        }

        public class AwardExamineeCreateDto
        {
            public int SId { get; set; }
            public string? UploadRemark { get; set; }
            public AwardExamieeDecision UploadDecision { get; set; }

            // File
            public IFormFile? AwardFile { get; set; }
        }

        public class AwardExamineePatchDto
        {
            // =========================
            // Level 1
            // =========================
            public int? Level1ApprovalStatus { get; set; }
            public string? Level1Remark { get; set; }
            public int? Level1ApprovedBy { get; set; }

            // =========================
            // Level 2
            // =========================
            public int? Level2ApprovalStatus { get; set; }
            public string? Level2Remark { get; set; }
            public int? Level2ApprovedBy { get; set; }

            // =========================
            // Level 3
            // =========================
            public int? Level3ApprovalStatus { get; set; }
            public string? Level3Remark { get; set; }
            public int? Level3ApprovedBy { get; set; }

            // =========================
            // Level 4
            // =========================
            public int? Level4ApprovalStatus { get; set; }
            public string? Level4Remark { get; set; }
            public int? Level4ApprovedBy { get; set; }

            // =========================
            // Level 5
            // =========================
            public int? Level5ApprovalStatus { get; set; }
            public string? Level5Remark { get; set; }
            public int? Level5ApprovedBy { get; set; }
        }
        [Authorize]
        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchAwardExaminee(
    int id,
    [FromBody] AwardExamineePatchDto request)
        {
            var award = await _context.AwardExaminees.FindAsync(id);

            if (award == null)
                return NotFound($"AwardExaminee with ID {id} not found.");
            

            // =========================
            // Level 1
            // =========================
            if (request.Level1ApprovalStatus.HasValue)
                award.Level1ApprovalStatus = request.Level1ApprovalStatus;

            if (!string.IsNullOrWhiteSpace(request.Level1Remark))
                award.Level1Remark = request.Level1Remark;

            if (request.Level1ApprovedBy.HasValue)
                award.Level1Approvedby = request.Level1ApprovedBy;

            // =========================
            // Level 2
            // =========================
            if (request.Level2ApprovalStatus.HasValue)
                award.Level2ApprovalStatus = request.Level2ApprovalStatus;

            if (!string.IsNullOrWhiteSpace(request.Level2Remark))
                award.Level2Remark = request.Level2Remark;

            if (request.Level2ApprovedBy.HasValue)
                award.Level2Approvedby = request.Level2ApprovedBy;

            // =========================
            // Level 3
            // =========================
            if (request.Level3ApprovalStatus.HasValue)
                award.Level3ApprovalStatus = request.Level3ApprovalStatus;

            if (!string.IsNullOrWhiteSpace(request.Level3Remark))
                award.Level3Remark = request.Level3Remark;

            if (request.Level3ApprovedBy.HasValue)
                award.Level3Approvedby = request.Level3ApprovedBy;

            // =========================
            // Level 4
            // =========================
            if (request.Level4ApprovalStatus.HasValue)
                award.Level4ApprovalStatus = request.Level4ApprovalStatus;

            if (!string.IsNullOrWhiteSpace(request.Level4Remark))
                award.Level4Remark = request.Level4Remark;

            if (request.Level4ApprovedBy.HasValue)
                award.Level4Approvedby = request.Level4ApprovedBy;

            // =========================
            // Level 5
            // =========================
            if (request.Level5ApprovalStatus.HasValue)
                award.Level5ApprovalStatus = request.Level5ApprovalStatus;

            if (!string.IsNullOrWhiteSpace(request.Level5Remark))
                award.Level5Remark = request.Level5Remark;

            if (request.Level5ApprovedBy.HasValue)
                award.Level5Approvedby = request.Level5ApprovedBy;
            if(request.Level5ApprovalStatus == 1)
            {
                var scholarPayment = new ScholarPayment
                {
                    SID = award.SId,
                    PaymentCategory = PaymentCategory.ProvisionalDegreeFee,
                    PaymentStatus = PaymentStatus.Pending,
                    Remark = "Provisional Degree Fee",
                    Category = "Provisional Degree Fee"
                };
                _context.ScholarPayments.Add(scholarPayment);
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "AwardExaminee updated successfully",
                award.Id
            });
        }



    }
}
