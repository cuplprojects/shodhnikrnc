using Microsoft.AspNetCore.Http;
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
    public class VivaController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;
        private readonly IFileStorageService _fileStorageService;
        private readonly IEmailService _emailService;

        public VivaController(RMSDbContext context, IFileService fileService,
            IFileStorageService fileStorageService, IEmailService emailService)
        {
            _context = context;
            _fileService = fileService;
            _emailService = emailService;
            _fileStorageService = fileStorageService;
        }

        [HttpGet]
        public IActionResult GetViva()
        {
            var result = (
                from v in _context.Viva_VoceExaminers

                join s in _context.SupervisorRegistrations
                    on v.AddedBy equals s.SupId into sup
                from s in sup.DefaultIfEmpty()

                join sp in _context.SupervisorPersonal
           on s.SupId equals sp.SupId into spp
                from sp in spp.DefaultIfEmpty()

                join se in _context.SupervisorEducations on sp.SupId equals se.SupId into see
                from se in see.DefaultIfEmpty()

                join auth in _context.ScholarAuths
                    on v.Sid equals auth.SID into au
                from auth in au.DefaultIfEmpty()

                join reg in _context.Scholars
                    on v.Sid equals reg.SID into regi
                from reg in regi.DefaultIfEmpty()

                join thesis in _context.Thesis
                   on v.Sid equals thesis.SID into the
                from thesis in the.DefaultIfEmpty()

                join subj in _context.Departments
                    on reg.Subject_ID equals subj.DepartmentID into sj
                from subj in sj.DefaultIfEmpty()

                select new
                {
                    Viva = v,
                    Supervisor = s,
                    SupervisorPersonal = sp,
                    Edu = se,
                    Auth = auth,
                    Scholar = reg,
                    Subject = subj,
                    thesis = thesis,
                }
            )
            .AsEnumerable() // DB se nikal ke memory me
            .GroupBy(x => x.Viva.Sid)
            .Where(g =>
            g.Where(x => x.Viva.ExaminerStatus == 1)
            .All(x => x.Viva.Examiner1Report >= 1)
             )
            .Select(g => g.OrderByDescending(x => x.Viva.Id).First())
            .Select(x => new
            {
                x.Viva.Sid,
                x.Scholar?.Name,
                x.Auth?.PermUserName,
                x.Scholar?.Subject_ID,
                VivaDate = x.thesis?.VivaDate,
                ForwardToDor = x.thesis?.ForwardToVor,
                SubjectName = x.Subject?.Subject,
                Department = x.Subject?.Faculity,
                VivaDateAccepted = x.thesis?.VivaDateAccepted,
                VivaDateAcceptedAt = x.thesis?.vivaDateAcceptedAt,
                SupervisorName = x.Supervisor?.FullName,
                ThesisTitle = x.thesis?.Thesis_Title,
                SupervisorCollegeName = x.Edu?.CollegeName,
                Venue = x.thesis?.VenueDetails,
            })
            .ToList();

            if (!result.Any())
                return NotFound("Kisi bhi scholar ke saare viva approve nahi hain");

            return Ok(result);
        }

        [HttpGet("Examiner")]
        public async Task<ActionResult> GetExaminer(int id)
        {
            var result = await _context.ExaminerLists.Where(s => s.DepartmentId == id).ToListAsync();
            return Ok(result);
        }

        public class UpdateVivaDateDto
        {
            public DateTime? VivaDate { get; set; }
            public bool? ForwardToDor {  get; set; }

            public bool? VivaDateAccepted { get; set; }
            public DateTime? VivaDateAcceptedAt { get; set; }
            public string? VenueDetails { get; set; }
        }

        [HttpGet("ThesisSubmitted")]
        public async Task<IActionResult> GetConfidential()
        {
            var data = await (
                from pay in _context.ScholarPayments

                    // 🔥 PAYMENT FILTER
                where pay.PaymentCategory == PaymentCategory.Thesis
                      && pay.PaymentStatus == PaymentStatus.Successful

                join auth in _context.ScholarAuths
                    on pay.SID equals auth.SID into au
                from auth in au.DefaultIfEmpty()

                join viva in _context.Viva_VoceExaminers
                   on pay.SID equals viva.Sid into vv
             from viva in vv.DefaultIfEmpty()

             join reg in _context.Scholars
                 on pay.SID equals reg.SID into regi
             from reg in regi.DefaultIfEmpty()

             join subj in _context.Departments
                 on reg.Subject_ID equals subj.DepartmentID into sj
             from subj in sj.DefaultIfEmpty()

             join the in _context.Thesis
               on reg.SID equals the.SID into thesis
             from the in thesis.DefaultIfEmpty()

             select new
             {
                 SID = pay.SID,
                 auth.PermUserName,
                 reg.Name,
                 reg.Subject_ID,
                 SubjectName = subj != null ? subj.Subject : null,
                 reg.Email,
                 reg.PhoneNumber,
                 reg.Year,
                 the.Thesis_Title,
                 Status = viva != null ? (ScholarResearchPaperDecision?)viva.Status : 0,
                 the.UploadDate,
             }
            ).ToListAsync();

            var result = data
       .GroupBy(x => x.SID)
       .Select(g => g
           .OrderByDescending(x => x.Status ?? ScholarResearchPaperDecision.Pending)
           .First()
       )
       .ToList();
            if (!result.Any())
                return NotFound("No scholars found with submitted thesis fees");

            return Ok(result);
        }



        [HttpPatch("update-viva-date/{sid}")]
        public async Task<IActionResult> UpdateVivaDate(int sid, [FromBody] UpdateVivaDateDto dto)
        {

            var thesis = await _context.Thesis
                .FirstOrDefaultAsync(t => t.SID == sid);

            if (thesis == null)
                return NotFound($"No thesis found for SID {sid}");

            thesis.VivaDate = dto.VivaDate;
            thesis.ForwardToVor = dto.ForwardToDor;
            thesis.VivaDateAccepted = dto.VivaDateAccepted;
            thesis.vivaDateAcceptedAt = dto.VivaDateAcceptedAt;
            thesis.VenueDetails = dto.VenueDetails;
            await _context.SaveChangesAsync();
            if (dto.VivaDateAccepted == true)
            {
                SendVivaAcceptanceEmails(sid, thesis);
            }
            return Ok(new
            {
                Message = "VivaDate updated successfully",
                SID = sid,
                VivaDate = thesis.VivaDate,
                ForwardToDor = thesis.ForwardToVor,
                Venue = thesis.VenueDetails,
            });
        }


        private void SendVivaAcceptanceEmails(int sid, Thesis thesis)
        {
            var examiners = (
                from v in _context.Viva_VoceExaminers
                join e in _context.ExaminerLists
                    on v.ExaminerId equals e.Id into ex
                from e in ex.DefaultIfEmpty()
                where v.Sid == sid
                      && v.Examiner1Report == 2
                select new
                {
                    Email = e.Email,
                    Name = e.Name
                }
            ).ToList();

            if (!examiners.Any())
                return;

            foreach (var examiner in examiners)
            {
                if (string.IsNullOrWhiteSpace(examiner.Email))
                    continue;

                var body = $@"
<p>Dear {examiner.Name},</p>


<p>
<b>Viva Date:</b> {thesis.VivaDate:dd-MM-yyyy}<br/>
<b>Venue:</b> {thesis.VenueDetails}
</p>

<p>Regards,<br/>RMS</p>";

                _emailService.SendEmail(
                    examiner.Email,
                    "Viva Voce Date Accepted",
                    body
                );
            }
        }



        [HttpPatch("viva-voce/{sid:int}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> PatchVivaVoceExaminer(
    int sid,
    [FromForm] VivaVoceExaminerUploadDto input)
        {
            // 🔹 Find by SID (same pattern as Thesis)
            var viva = await _context.Viva_VoceExaminers
                .FirstOrDefaultAsync(v => v.Sid == sid);

            if (viva == null)
                return NotFound("Viva-voce examiner record not found.");

            // -------- Fields (partial update) --------
            if (input.AddedBy > 0) viva.AddedBy = input.AddedBy;
            if (input.RecommendedBy.HasValue) viva.RecommendedBy = input.RecommendedBy;
            if (input.Status.HasValue) viva.Status = input.Status.Value;
            if (input.ExaminerId.HasValue) viva.ExaminerId = input.ExaminerId;
            if (input.ExaminerStatus.HasValue) viva.ExaminerStatus = input.ExaminerStatus.Value;
            if (input.IsAddedBySupervisor.HasValue) viva.IsAddedBySupervisor = input.IsAddedBySupervisor.Value;
            if (input.Remarks != null) viva.Remarks = input.Remarks;
            if (input.Examiner1Remarks != null) viva.Examiner1Remarks = input.Examiner1Remarks;
            if (input.Examiner1Report.HasValue) viva.Examiner1Report = input.Examiner1Report;
            if (input.SupId.HasValue) viva.SupId = input.SupId;
           

            // -------- File Upload --------
            if (input.UploadReport != null)
            {
                var subFolder = Path.Combine("VivaVoceReports", sid.ToString());

                viva.UploadReport = await _fileStorageService.SaveAsync(
                    input.UploadReport,
                    subFolder,
                    "VIVA_REPORT");
            }

            await _context.SaveChangesAsync();

            return Ok("Viva-voce examiner updated successfully.");
        }


        public class VivaVoceExaminerUploadDto
        {
            public int AddedBy { get; set; }
            public int? RecommendedBy { get; set; }
            public int? Status { get; set; }
            public int? ExaminerId { get; set; }
            public int? ExaminerStatus { get; set; }
            public bool? IsAddedBySupervisor { get; set; }
            public string? Remarks { get; set; }
            public string? Examiner1Remarks { get; set; }
            public int? Examiner1Report { get; set; }
            public int? SupId { get; set; }
            public DateTime? VivaDate { get; set; }
            public bool? ForwardToDor { get; set; }

            public IFormFile? UploadReport { get; set; }
        }




    }
}
