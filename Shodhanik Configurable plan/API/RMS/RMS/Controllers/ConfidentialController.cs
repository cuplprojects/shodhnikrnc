using MathNet.Numerics.LinearAlgebra;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NuGet.Common;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System.Security.Cryptography;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ConfidentialController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;
        private readonly IFileStorageService _fileStorageService;
        public ConfidentialController(RMSDbContext context, IEmailService emailService, IFileStorageService fileStorageService, IEmailTemplateService emailTemplateService)
        {
            _context = context;
            _emailService = emailService;
            _fileStorageService = fileStorageService;
            _emailTemplateService = emailTemplateService;
        }



        [HttpGet("{id}")]
        public async Task<IActionResult> GetConfidential(int id)
        {
            var confidential = await (
                from v in _context.Viva_VoceExaminers

                // Examiner details
                join e in _context.ExaminerLists
              on v.ExaminerId equals e.Id into exam
                from e in exam.DefaultIfEmpty()


                    // Designation (LEFT JOIN)
                join d in _context.Designations
                    on e.Designation equals d.DesignationID into des
                from d in des.DefaultIfEmpty()


                    // Supervisor (LEFT JOIN)
                join s in _context.SupervisorRegistrations
                    on v.AddedBy equals s.SupId into sup
                from s in sup.DefaultIfEmpty()

                join auth in _context.ScholarAuths
                   on v.Sid equals auth.SID into au
                from auth in au.DefaultIfEmpty()

                join reg in _context.Scholars
                 on v.Sid equals reg.SID into regi
                from reg in regi.DefaultIfEmpty()
                join subj in _context.Departments
               on reg.Subject_ID equals subj.DepartmentID into sj
                from subj in sj.DefaultIfEmpty()
                    // Admin / Role (LEFT JOIN)
                join a in _context.Roles
                    on v.RecommendedBy equals a.RoleID into adm
                from a in adm.DefaultIfEmpty()

                where v.Sid == id

                select new
                {
                    v.Id,
                    v.Sid,
                    v.Status,
                    v.ExaminerStatus,

                    IsAddedBySupervisor = (bool?)v.IsAddedBySupervisor,
                    AddedBy = (int?)v.AddedBy,

                    v.UploadReport,
                    v.Remarks,
                    v.Examiner1Report,
                    v.Examiner1Remarks,

                  auth.PermUserName,

                   reg.Name,
                    Subject_ID = (int?)reg.Subject_ID,

                    SubjectName = subj != null ? subj.Subject : null,

                    // Examiner
                    ExaminerId = (int?)e.Id,
                    ExaminerName = e != null ? e.Name : s.FullName,
                    ExaminerEmail = e != null ? e.Email : s.Email,

                    ContactNo = e != null ? e.ContactNo : s.MobileNo,
                    Address = e != null ? e.Address : null,
                    State = e != null ? e.State : null,
                    Institution = e != null ? e.Institution : null,

                    Designation = e != null ? (int?)e.Designation : null,
                    DesignationName = d != null ? d.DesignationName : null,
                    SupervisorName = s != null ? s.FullName : null,
                    AdminName = a != null ? a.RoleName : null
                }

            ).ToListAsync();

            if (!confidential.Any())
                return NotFound("No viva voce examiner found");

            return Ok(confidential);
        }

        public class VivaVoceExaminerDto
        {
            // ExaminerList table fields
            public string? Name { get; set; }
            public string? Email { get; set; }
            public string? ContactNo { get; set; }
            public string? Address { get; set; }
            public int Designation { get; set; }
            public string? State { get; set; }
            public int DepartmentId { get; set; }
            public string? Institution { get; set; }
            // Viva_voceExaminer table fields
            public int Sid { get; set; }
            public int AddedBy { get; set; }
            public int? RecommendedBy { get; set; }
            public int Status { get; set; }
            public int ExaminerStatus { get; set; } = 0;
            public bool IsAddedBySupervisor { get; set; }
            public string? Remarks { get; set; }
            public int? ExaminerId { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> PostConfidential(VivaVoceExaminerDto model)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Save ExaminerList
                var examiner = new ExaminerList
                {
                    Name = model.Name,
                    Email = model.Email,
                    ContactNo = model.ContactNo,
                    Address = model.Address,
                    Designation = model.Designation,
                    State = model.State,
                    Institution = model.Institution,
                    DepartmentId = model.DepartmentId
                };

                _context.ExaminerLists.Add(examiner);
                await _context.SaveChangesAsync();

                // 2. Save Viva_voceExaminer using ExaminerId
                var vivaExaminer = new Viva_voceExaminer
                {
                    Sid = model.Sid,
                    AddedBy = model.AddedBy,
                    RecommendedBy = model.RecommendedBy,
                    Status = model.Status,
                    ExaminerId = examiner.Id, // FK from ExaminerList
                    ExaminerStatus = model.ExaminerStatus,
                    IsAddedBySupervisor = model.IsAddedBySupervisor,
                    Remarks = model.Remarks,
                };

                _context.Viva_VoceExaminers.Add(vivaExaminer);
                await _context.SaveChangesAsync();
                var supervisorId = await _context.ScholarSupervisors
               .Where(x => x.SID == model.Sid)
               .Select(x => x.SUPID1)
              .FirstOrDefaultAsync();

                if (supervisorId == 0)
                    return BadRequest("Supervisor not found for this scholar.");
                var exisiting = await _context.Viva_VoceExaminers.AnyAsync(u => u.Sid == model.Sid && u.SupId == supervisorId);
                if(!exisiting)
                {
                    // 4. Save Supervisor entry directly into Viva-Voce
                    var supervisorVivaEntry = new Viva_voceExaminer
                    {
                        Sid = model.Sid,
                        SupId = supervisorId,
                        Status = 0, // or whatever default
                        ExaminerStatus = 0,
                        IsAddedBySupervisor = true,
                        AddedBy = supervisorId,
                        Remarks = ""
                    };
                    _context.Viva_VoceExaminers.Add(supervisorVivaEntry);
                    await _context.SaveChangesAsync();
                }
                else
                {

                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    ExaminerId = examiner.Id,
                    VivaExaminerId = vivaExaminer.Id
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    Message = ex.Message,
                    Inner = ex.InnerException?.Message,
                    Stack = ex.StackTrace
                });
            }

        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutConfidential(int id, [FromBody] VivaVoceExaminerDto model)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Try to find the Viva_voceExaminer record by Id, or fallback by ExaminerId
                var vivaExaminer = await _context.Viva_VoceExaminers
                    .FirstOrDefaultAsync(v => v.Id == id);

                if (vivaExaminer == null)
                {
                    vivaExaminer = await _context.Viva_VoceExaminers
                        .FirstOrDefaultAsync(v => v.ExaminerId == id);
                }

                if (vivaExaminer == null)
                    return NotFound("Viva voce examiner record not found.");

                // 2. Find or create linked ExaminerList
                ExaminerList? examiner = null;
                if (vivaExaminer.ExaminerId.HasValue && vivaExaminer.ExaminerId.Value > 0)
                {
                    examiner = await _context.ExaminerLists
                        .FirstOrDefaultAsync(e => e.Id == vivaExaminer.ExaminerId.Value);
                }

                if (examiner == null && model.ExaminerId.HasValue && model.ExaminerId.Value > 0)
                {
                    examiner = await _context.ExaminerLists
                        .FirstOrDefaultAsync(e => e.Id == model.ExaminerId.Value);
                }

                if (examiner == null)
                {
                    examiner = new ExaminerList
                    {
                        Name = model.Name ?? string.Empty,
                        Email = model.Email ?? string.Empty,
                        ContactNo = model.ContactNo ?? string.Empty,
                        Address = model.Address ?? string.Empty,
                        Designation = model.Designation,
                        State = model.State ?? string.Empty,
                        Institution = model.Institution ?? string.Empty,
                        DepartmentId = model.DepartmentId
                    };
                    _context.ExaminerLists.Add(examiner);
                    await _context.SaveChangesAsync();
                    vivaExaminer.ExaminerId = examiner.Id;
                }
                else
                {
                    if (!string.IsNullOrEmpty(model.Name)) examiner.Name = model.Name;
                    if (!string.IsNullOrEmpty(model.Email)) examiner.Email = model.Email;
                    if (!string.IsNullOrEmpty(model.ContactNo)) examiner.ContactNo = model.ContactNo;
                    if (!string.IsNullOrEmpty(model.Address)) examiner.Address = model.Address;
                    if (model.Designation > 0) examiner.Designation = model.Designation;
                    if (!string.IsNullOrEmpty(model.State)) examiner.State = model.State;
                    if (!string.IsNullOrEmpty(model.Institution)) examiner.Institution = model.Institution;
                    if (model.DepartmentId > 0) examiner.DepartmentId = model.DepartmentId;
                }

                // 3. Update Viva_voceExaminer fields
                if (model.Sid > 0) vivaExaminer.Sid = model.Sid;
                if (model.AddedBy > 0) vivaExaminer.AddedBy = model.AddedBy;
                if (model.RecommendedBy.HasValue) vivaExaminer.RecommendedBy = model.RecommendedBy;
                if (model.Status > 0) vivaExaminer.Status = model.Status;
                if (model.ExaminerStatus > 0) vivaExaminer.ExaminerStatus = model.ExaminerStatus;
                if (model.Remarks != null) vivaExaminer.Remarks = model.Remarks;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = "Examiner updated successfully",
                    ExaminerId = examiner.Id,
                    VivaExaminerId = vivaExaminer.Id
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    Message = ex.Message,
                    Inner = ex.InnerException?.Message,
                    Stack = ex.StackTrace
                });
            }
        }

        [HttpPatch("update-status")]
        public async Task<IActionResult> UpdateStatus(UpdateVivaStatusDto model)
        {
            if (model.VivaExaminerIds == null || !model.VivaExaminerIds.Any())
                return BadRequest("No IDs provided");



            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var basicExaminers = await (
     from v in _context.Viva_VoceExaminers


     join e in _context.ExaminerLists
        on v.ExaminerId equals e.Id into examinerJoin
     from e in examinerJoin.DefaultIfEmpty()

     join s in _context.Scholars 
        on v.Sid equals s.SID

     join sup in _context.SupervisorRegistrations
        on v.AddedBy equals sup.SupId into supJoin
     from sup in supJoin.DefaultIfEmpty()

     join t in _context.Thesis 
        on v.Sid equals t.SID into thesisJoin
     from t in thesisJoin.DefaultIfEmpty()   // ✅ LEFT JOIN

     join de in _context.Designations 
        on e.Designation equals de.DesignationID into desigJoin
     from de in desigJoin.DefaultIfEmpty()   // ✅ LEFT JOIN

     join d in _context.Departments
       on e.DepartmentId equals d.DepartmentID into deptJoin
     from d in deptJoin.DefaultIfEmpty()

     where model.VivaExaminerIds.Contains(v.Id)
     select new
     {
         Viva = v,
         ExaminerName = e != null ? e.Name : "",
         ExaminerEmail = !string.IsNullOrEmpty(e.Email)
                            ? e.Email
                            : (sup != null ? sup.Email : ""),
         Address = e != null ? e.Address : "",
         Designation = de != null ? de.DesignationName : "",
         Institution = e != null ? e.Institution : "",
         State = e != null ? e.State : "",
         SubjectId = s.Subject_ID,
         DepartmentName = d != null ? d.Subject : "",
         ThesisTitle = t != null ? t.Thesis_Title : ""
     }
 ).ToListAsync();

                foreach (var x in basicExaminers)
                {
                    Console.WriteLine("---- BASIC EXAMINER RECORD ----");
                    Console.WriteLine($"VivaId        : {x.Viva.Id}");
                    Console.WriteLine($"ExaminerId    : {x.Viva.ExaminerId}");
                    Console.WriteLine($"AddedBy       : {x.Viva.AddedBy}");
                    Console.WriteLine($"ExaminerEmail : '{x.ExaminerEmail}'");
                    Console.WriteLine("--------------------------------");
                }

                // Now fetch department names separately
                var deptIds = basicExaminers.Select(x => x.SubjectId).Distinct().ToList();
                var departments = await _context.Departments
     .Where(d => deptIds.Contains(d.DepartmentID))
     .Select(d => new
     {
         d.DepartmentID,
         Subject = d.Subject ?? ""
     })
     .ToDictionaryAsync(d => d.DepartmentID, d => d.Subject);


                var examiners = basicExaminers.Select(x => new
                {
                    x.Viva,
                    x.ExaminerName,
                    x.ExaminerEmail,
                    x.Designation,
                    Address = string.Join(", ", new[] { x.Address, x.Institution, x.State }.Where(str => !string.IsNullOrWhiteSpace(str))),
                    SubjectName = departments.ContainsKey(x.SubjectId) ? departments[x.SubjectId] : "",
                    x.ThesisTitle
                }).ToList();
                Console.WriteLine(examiners);
                if (!examiners.Any())
                    return NotFound("No matching records found");

                foreach (var examiner in examiners)
                {
                    examiner.Viva.Status = model.Status;
                    examiner.Viva.Remarks = model?.Remarks;
                    // 🔥 Send email only when Approved
                    if (model.Status == 3)
                    {
                        var token = GenerateSecureToken();

                        // 2️⃣ Store token in DB
                        var consentLink = new ExaminerConsentLink
                        {
                            VivaId = examiner.Viva.Id,
                            Token1 = token,
                            ExpiryTime1 = DateTime.UtcNow.AddDays(7),
                            CreatedAt1 = DateTime.UtcNow
                        };

                        _context.ExaminerConsentLinks.Add(consentLink);

                        // 3️⃣ Build links
                        var summaryLink = $"{model.SummaryBaseUrl}?token={token}";
                        var consentLinkUrl = $"{model.ConsentBaseUrl}?token={token}";


                        // 4️⃣ Build email
                        var tokens = new Dictionary<string, string>
    {
        { "date", DateTime.Now.ToString("dd/MM/yyyy hh:mm:ss tt") },
        { "name", examiner.ExaminerName },
        { "designation", examiner.Designation },
        {"department", examiner.SubjectName },
        { "address", examiner.Address },
        { "Address", examiner.Address },
        { "dept_name", examiner.SubjectName },
        { "thesis_title", examiner.ThesisTitle },
        { "summary", summaryLink },
        { "last", consentLink.ExpiryTime1.ToString("dd/MM/yyyy hh:mm:ss tt") },
        { "link", consentLinkUrl }
    };

                        // 📧 Render from DB template
                        var (subject, body) = await _emailTemplateService.RenderAsync(
                            templateID: 1020,
                            tokens: tokens
                        );

                        // 📨 Send mail
                        _emailService.SendEmail(
                            examiner.ExaminerEmail,
                            string.IsNullOrWhiteSpace(subject)
                                ? "Thesis Evaluation Request"
                                : subject,
                            body
                        );
                    }

                
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    UpdatedCount = examiners.Count,
                    NewStatus = model.Status
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }


        public class UpdateVivaStatusDto
        {
            public List<int> VivaExaminerIds { get; set; }
            public int Status { get; set; }
            public string? Remarks { get; set; } = "";
            public string? ConsentBaseUrl { get; set; } = "";
            public string? SummaryBaseUrl { get; set; } = "";
        }


        /* [HttpPatch("final-selection/{vivaExaminerId}")]
         public async Task<IActionResult> UpdateFinalStatus(
       int vivaExaminerId,
       [FromBody] UpdateFinalExaminee model)
         {
             var examiner = await _context.Viva_VoceExaminers
                 .FirstOrDefaultAsync(x => x.Id == vivaExaminerId);

             if (examiner == null)
                 return NotFound("Viva examiner not found");

             examiner.Examiner1Report = model.Status;

             await _context.SaveChangesAsync();

             return Ok(new
             {
                 VivaExaminerId = vivaExaminerId,
                 NewStatus = model.Status
             });
         }*/


        [HttpPatch("final-selection/{vivaExaminerId}")]
        public async Task<IActionResult> UpdateFinalStatus(
    int vivaExaminerId,
    [FromBody] UpdateFinalExaminee model)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var emailData = await (
                    from v in _context.Viva_VoceExaminers
                    join e in _context.ExaminerLists
                        on v.ExaminerId equals e.Id into examinerJoin
                    from e in examinerJoin.DefaultIfEmpty()
                    join s in _context.Scholars on v.Sid equals s.SID
                    join t in _context.Thesis on v.Sid equals t.SID into thesisJoin
                    from t in thesisJoin.DefaultIfEmpty()
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join sup in _context.SupervisorRegistrations
                        on v.SupId equals sup.SupId into supJoin
                    from sup in supJoin.DefaultIfEmpty()
                    join des in _context.Designations on e.Designation equals des.DesignationID into desJoin
                    from des in desJoin.DefaultIfEmpty()
                    where v.Id == vivaExaminerId
                    select new
                    {
                        Viva = v,
                        ExaminerEmail = e != null ? e.Email : (sup != null ? sup.Email : ""),
                        ExaminerName = e != null ? e.Name : (sup != null ? sup.FullName : ""),
                        DesignationName = des != null ? des.DesignationName : "",
                        Subject = d != null ? d.Subject : "",
                        ThesisTitle = t != null ? t.Thesis_Title : "",
                        SupervisorName = sup != null ? sup.FullName : "",
                        ExaminerAddress = e != null ? string.Join(", ", new[] { e.Address, e.Institution, e.State }.Where(str => !string.IsNullOrWhiteSpace(str))) : "",
                        ScholarName = s != null ? s.Name : ""
                    }
                ).FirstOrDefaultAsync();

                if (emailData == null)
                    return NotFound("Viva examiner not found");

                // 1️⃣ Update status
                emailData.Viva.Examiner1Report = model.Status;

                // 2️⃣ Send email ONLY when final status submitted
                if (model.Status == 2) // adjust if your final status code differs
                {
                    var tokens = new Dictionary<string, string>
            {
                { "date", DateTime.Now.ToString("dd/MM/yyyy hh:mm:ss tt") },
                { "name", emailData.ExaminerName ?? "" },
                { "designation", emailData.DesignationName ?? "" },
                { "address", emailData.ExaminerAddress ?? "" },
                { "Address", emailData.ExaminerAddress ?? "" },
                { "dept_name", emailData.Subject ?? "" },
                { "thesis_title", emailData.ThesisTitle ?? "" },
                { "std_name", emailData.ScholarName ?? "" },
                { "sup_name", emailData.SupervisorName ?? "" },
                { "supervisor", emailData.SupervisorName ?? "" }
            };

                    var (subject, body) = await _emailTemplateService.RenderAsync(
                        templateID: 1021,
                        tokens: tokens
                    );

                    _emailService.SendEmail(
                        emailData.ExaminerEmail,
                        string.IsNullOrWhiteSpace(subject)
                            ? "Ph.D. Viva Voce Examination"
                            : subject,
                        body
                    );
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    VivaExaminerId = vivaExaminerId,
                    NewStatus = model.Status,
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        public class UpdateFinalExaminee
        {
            public int Status { get; set; }
        }



        private string GenerateSecureToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace("+", "")
                .Replace("/", "")
                .Replace("=", "");
        }

        public class ExaminerConsentDto
        {
            public string Token { get; set; }
            public int Decision { get; set; } // 1=Accept, 2=Reject
            public string? Remarks { get; set; }
            public string? AwardBaseUrl { get; set; } = "";
            public string? SummaryBaseUrl { get; set; } = "";
        }



        [HttpPost("submit-consent")]
        public async Task<IActionResult> SubmitConsent(ExaminerConsentDto dto)
        {
            using var tx = await _context.Database.BeginTransactionAsync();

            // =========================
            // 1️⃣ Validate token (Token1)
            // =========================
            var link = await _context.ExaminerConsentLinks
                .FirstOrDefaultAsync(x => x.Token1 == dto.Token);

            if (link == null || link.ExpiryTime1 < DateTime.UtcNow)
                return BadRequest("Invalid or expired link");

            // =========================
            // 2️⃣ Fetch viva
            // =========================
            var viva = await _context.Viva_VoceExaminers
                .FirstOrDefaultAsync(x => x.Id == link.VivaId);

            if (viva == null)
                return NotFound("Viva record not found");

            // =========================
            // 3️⃣ Update decision
            // =========================
            viva.ExaminerStatus = dto.Decision;
            viva.Remarks = dto.Remarks ?? "";

            await _context.SaveChangesAsync();

            // =========================
            // 4️⃣ Send Email ONLY if Accepted
            // =========================
            if (dto.Decision == 1)
            {
                var emailData = await (
                    from v in _context.Viva_VoceExaminers
                    join e in _context.ExaminerLists on v.ExaminerId equals e.Id into examJoin
                    from e in examJoin.DefaultIfEmpty()
                    join s in _context.Scholars on v.Sid equals s.SID
                    join t in _context.Thesis on v.Sid equals t.SID into thesisJoin
                    from t in thesisJoin.DefaultIfEmpty()
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID into deptJoin
                    from d in deptJoin.DefaultIfEmpty()
                    join de in _context.Designations on e.Designation equals de.DesignationID into desJoin
                    from de in desJoin.DefaultIfEmpty()
                    where v.Id == link.VivaId
                    select new
                    {
                        ExaminerName = e != null ? e.Name : "",
                        ExaminerEmail = e != null ? e.Email : "",
                        Designation = de != null ? de.DesignationName : "",
                        Address = e != null ? e.Address : "",
                        Institution = e != null ? e.Institution : "",
                        State = e != null ? e.State : "",
                        University = e != null ? e.Institution : "",
                        Subject = d != null ? d.Subject : "",
                        ThesisTitle = t != null ? t.Thesis_Title : ""
                    }
                ).FirstOrDefaultAsync();

                // 🔹 Generate NEW token for report upload
                var token2 = GenerateSecureToken();

                // 🔹 UPDATE existing consent link (DO NOT ADD)
                link.Token2 = token2;
                link.ExpiryTime2 = DateTime.UtcNow.AddDays(30);
                link.CreatedAt2 = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                if (emailData != null)
                {
                    var awardLinkUrl = $"{dto.AwardBaseUrl}?token={token2}";
                    var summaryLinkUrl = $"{dto.SummaryBaseUrl}?token={token2}";

                    var addressParts = new List<string>();
                    if (!string.IsNullOrWhiteSpace(emailData.Address)) addressParts.Add(emailData.Address.Trim());
                    if (!string.IsNullOrWhiteSpace(emailData.Institution) &&
                        (string.IsNullOrWhiteSpace(emailData.Address) || !emailData.Address.Contains(emailData.Institution, StringComparison.OrdinalIgnoreCase)))
                    {
                        addressParts.Add(emailData.Institution.Trim());
                    }
                    if (!string.IsNullOrWhiteSpace(emailData.State) &&
                        (string.IsNullOrWhiteSpace(emailData.Address) || !emailData.Address.Contains(emailData.State, StringComparison.OrdinalIgnoreCase)))
                    {
                        addressParts.Add(emailData.State.Trim());
                    }
                    string examinerAddress = addressParts.Count > 0 
                        ? string.Join(", ", addressParts) 
                        : (emailData.Address ?? emailData.Institution ?? "");

                    var tokens = new Dictionary<string, string>
                    {
                        { "date", DateTime.Now.ToString("dd/MM/yyyy hh:mm:ss tt") },
                        { "name", emailData.ExaminerName ?? "" },
                        { "designation", emailData.Designation ?? "" },
                        { "address", examinerAddress },
                        { "Address", examinerAddress },
                        { "institution", emailData.Institution ?? "" },
                        { "university", emailData.University ?? "" },
                        { "state", emailData.State ?? "" },
                        { "dept_name", emailData.Subject ?? "" },
                        { "department", emailData.Subject ?? "" },
                        { "thesis_title", emailData.ThesisTitle ?? "" },
                        { "summary", summaryLinkUrl },
                        { "link", awardLinkUrl }
                    };

                    // 📧 Render from DB template
                    var (subject, body) = await _emailTemplateService.RenderAsync(
                        templateID: 1026,
                        tokens: tokens
                    );

                    _emailService.SendEmail(
                            emailData.ExaminerEmail,
                            string.IsNullOrWhiteSpace(subject)
                                ? "Submission Report"
                                : subject,
                            body
                        );
                }
            }

            await tx.CommitAsync();
            return Ok("Consent submitted successfully");
        }

        public class ExaminerAwardDto
        {
            public string Token { get; set; }
            public int Decision { get; set; } // 1=Accept, 2=Reject
            public string? Remarks { get; set; }
            public IFormFile UploadReport { get; set; }
        }

        [HttpPost("award-report")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitAwardReport([FromForm] ExaminerAwardDto dto)
        {
            using var tx = await _context.Database.BeginTransactionAsync();

            var link = await _context.ExaminerConsentLinks
                .FirstOrDefaultAsync(x => x.Token2 == dto.Token);

            if (link == null || link.ExpiryTime2 < DateTime.UtcNow)
                return BadRequest("Invalid or expired link");

            var viva = await _context.Viva_VoceExaminers
                .FirstOrDefaultAsync(x => x.Id == link.VivaId);

            if (viva == null)
                return NotFound("Viva record not found");

            string reportPath = viva.UploadReport;

            // 🔹 Save or overwrite file
            if (dto.UploadReport != null)
            {
                if (string.IsNullOrEmpty(viva.UploadReport))
                {
                    // First time upload
                    reportPath = await _fileStorageService.SaveAsync(
                        dto.UploadReport,
                        "examiner-reports",
                        $"Viva_{viva.Id}"
                    );
                }
                else
                {
                    // Overwrite existing file
                    await _fileStorageService.OverwriteAsync(
                        dto.UploadReport,
                        viva.UploadReport
                    );
                }
            }

            viva.Examiner1Report = dto.Decision;
            viva.Examiner1Remarks = dto.Remarks ?? "";
            viva.UploadReport = reportPath;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok("Award report submitted successfully");
        }

      
        public class TokenRequest
        {
            public string Token { get; set; }
        }

        [HttpPost("summary-details")]
        public async Task<IActionResult> GetSummaryDetails([FromBody] TokenRequest request)
        {
            var token = request.Token;

            if (string.IsNullOrWhiteSpace(token))
                return BadRequest("Token is required");

            // =========================
            // 1️⃣ Validate Token
            // =========================
            var consent = await _context.ExaminerConsentLinks
                .FirstOrDefaultAsync(x =>
                    (x.Token1 == token &&
                    x.ExpiryTime1 >= DateTime.UtcNow) || (x.Token2 == token && x.ExpiryTime2>=DateTime.UtcNow));

            if (consent == null)
                return BadRequest("Invalid or expired token");

            // =========================
            // 2️⃣ Get Viva + SID
            // =========================
            var vivaData = await (
                from v in _context.Viva_VoceExaminers
                where v.Id == consent.VivaId
                select new
                {
                    VivaId = v.Id,
                    SID = v.Sid,
                }
            ).FirstOrDefaultAsync();

            if (vivaData == null)
                return NotFound("No viva record found");

            int sid = vivaData.SID;

            // =========================
            // 3️⃣ Synopsis
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
            // 4️⃣ Thesis Files
            // =========================
            var thesisFiles = await _context.Thesis
                .Where(t => t.SID == sid)
                .Select(t => new
                {
                    t.Thesis_File,
                    t.Thesis_Summary_File
                })
                .FirstOrDefaultAsync();

            // =========================
            // 5️⃣ Research Papers (First 2)
            // =========================
            var researchPapers = await _context.ScholarResearchPaper
                .Where(rp => rp.SID == sid)
                .OrderBy(rp => rp.CreatedAt)
                .Select(rp => rp.UploadPaper)
                .Take(2)
                .ToListAsync();

            // =========================
            // 6️⃣ Conferences (Dynamic)
            // =========================
            var conferenceFiles = await _context.ScholarConferences
                .Where(c => c.SID == sid && !string.IsNullOrEmpty(c.PresentationCertificate))
                .OrderBy(c => c.StartingDate)
                .Select(c => c.PresentationCertificate)
                .ToListAsync();

            var conferences = new Dictionary<string, string?>();
            for (int i = 0; i < conferenceFiles.Count; i++)
            {
                conferences[$"Conference{i + 1}"] = conferenceFiles[i];
            }

            // =========================
            // 7️⃣ Final Response
            // =========================
            var response = new Dictionary<string, object?>
    {
        { "VivaDetails", vivaData },
        { "SID", sid },
        { "SynopsisFilePath", synopsisFilePath },
        { "ThesisFile", thesisFiles?.Thesis_File },
        { "ThesisSummaryFile", thesisFiles?.Thesis_Summary_File },
        { "ResearchPaper1", researchPapers.Count > 0 ? researchPapers[0] : null },
        { "ResearchPaper2", researchPapers.Count > 1 ? researchPapers[1] : null }
    };

            foreach (var conf in conferences)
                response.Add(conf.Key, conf.Value);

            return Ok(response);
        }


        [HttpPost("consent-details")]
        public async Task<IActionResult> GetConsentDetails([FromBody] TokenRequest request)
        {
            var token = request.Token;

            if (string.IsNullOrWhiteSpace(token))
                return BadRequest("Token is required");

            // 1️⃣ Validate token
            var consent = await _context.ExaminerConsentLinks
                .FirstOrDefaultAsync(x =>
                    x.Token1 == token &&
                    x.ExpiryTime1 >= DateTime.UtcNow);

            if (consent == null)
                return BadRequest("Invalid or expired token");

            // 2️⃣ Fetch details using VivaId
            var data = await (
                from v in _context.Viva_VoceExaminers
                join e in _context.ExaminerLists on v.ExaminerId equals e.Id
                join s in _context.Scholars on v.Sid equals s.SID
                join t in _context.Thesis on v.Sid equals t.SID
                join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                join de in _context.Designations on e.Designation equals de.DesignationID
                where v.Id == consent.VivaId
                select new
                {
                    VivaId = v.Id,
                    ExaminerName = e.Name,
                    Designation = de.DesignationName,
                    University = e.Institution,
                    Subject = d.Subject,
                    ThesisTitle = t.Thesis_Title,
                    ExaminerStatus = v.ExaminerStatus,
                    Remarks = v.Remarks??""
                }
            ).FirstOrDefaultAsync();

            if (data == null)
                return NotFound("No viva record found");

            return Ok(data);
        }

        [HttpPost("award-details")]
        public async Task<IActionResult> GetAwardDetails([FromBody] TokenRequest request)
        {
            var token = request.Token;

            if (string.IsNullOrWhiteSpace(token))
                return BadRequest("Token is required");

            // 1️⃣ Validate token
            var consent = await _context.ExaminerConsentLinks
                .FirstOrDefaultAsync(x =>
                    x.Token2 == token &&
                    x.ExpiryTime2 >= DateTime.UtcNow);

            if (consent == null)
                return BadRequest("Invalid or expired token");

            // 2️⃣ Fetch details using VivaId
            var data = await (
                from v in _context.Viva_VoceExaminers
                join e in _context.ExaminerLists on v.ExaminerId equals e.Id
                join s in _context.Scholars on v.Sid equals s.SID
                join t in _context.Thesis on v.Sid equals t.SID
                join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                join de in _context.Designations on e.Designation equals de.DesignationID
                where v.Id == consent.VivaId
                select new
                {
                    VivaId = v.Id,
                    ExaminerName = e.Name,
                    Designation = de.DesignationName,
                    University = e.Institution,
                    Subject = d.Subject,
                    ThesisTitle = t.Thesis_Title,
                    Remarks1 = v.Examiner1Remarks,
                    Status = v.Examiner1Report,
                    Upload = v.UploadReport
                }
            ).FirstOrDefaultAsync();

            if (data == null)
                return NotFound("No viva record found");

            return Ok(data);
        }

    }
}
