using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorScreeningController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IEmailTemplateService _emailTemplateService;
        private readonly IEmailService _emailService;
        public SupervisorScreeningController(RMSDbContext context,IEmailTemplateService emailTemplateService,
    IEmailService emailService)
        {
            _context = context;
            _emailTemplateService = emailTemplateService;
            _emailService = emailService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrUpdateScreening(SupervisorScreening dto)
        {
            try
            {
                var existing = await _context.SupervisorScreenings
                    .FirstOrDefaultAsync(x => x.SupId == dto.SupId);

                if (existing == null)
                {
                    existing = new SupervisorScreening
                    {
                        SupId = dto.SupId
                    };
                    _context.SupervisorScreenings.Add(existing);
                }

                // 🔹 Detect which screening is being updated
                int screeningNo =
                    dto.Screening1Status > 0 ? 1 :
                    dto.Screening2Status > 0 ? 2 :
                    dto.Screening3Status > 0 ? 3 :
                    dto.Screening4Status > 0 ? 4 :
                      dto.Screening5Status > 0 ? 5 :
                        dto.Screening6Status > 0 ? 6 :
                    0;

                if (screeningNo == 0)
                    return BadRequest("No screening status provided.");

                // 🔒 Enforce screening order
                if (screeningNo > 1)
                {
                    int prevStatus = screeningNo switch
                    {
                        2 => existing.Screening1Status ?? 0,
                        3 => existing.Screening2Status ?? 0,
                        4 => existing.Screening3Status ?? 0,
                        5 => existing.Screening4Status ?? 0,
                        6 => existing.Screening5Status ?? 0,
                        _ => 0
                    };

                    if (prevStatus != 1)
                        return BadRequest($"Previous screening not approved.");
                }


                var result = ApplyScreening(existing, dto, screeningNo);
                if (result != null)
                    return result;

                await _context.SaveChangesAsync();

                // 🚨 If rejected twice in ANY screening → mark supervisor as rejected
                bool rejectedTwice =
                    (existing.Screening1Status == 2 && existing.Screening1Count == 2) ||
                    (existing.Screening2Status == 2 && existing.Screening2Count == 2) ||
                    (existing.Screening3Status == 2 && existing.Screening3Count == 2) ||
                    (existing.Screening4Status == 2 && existing.Screening4Count == 2) ||
                    (existing.Screening5Status == 2 && existing.Screening5Count == 2) ||
                    (existing.Screening6Status == 2 && existing.Screening6Count == 2);

                if (rejectedTwice)
                {
                    await UpdateSupervisorAcceptanceAsync(dto.SupId, 2);
                    return Ok(existing);
                }

                // ✅ Final decision after Screening 4
                if (screeningNo == 6)
                {
                    if (existing.Screening6Status == 1)
                        await UpdateSupervisorAcceptanceAsync(dto.SupId, 1);
                    else if (existing.Screening6Status == 2)
                        await UpdateSupervisorAcceptanceAsync(dto.SupId, 2);
                }

                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Error creating/updating screening data",
                    error = ex.Message
                });
            }
        }

        private IActionResult? ApplyScreening(
     SupervisorScreening existing,
     SupervisorScreening dto,
     int screeningNo)
        {
            int dtoStatus = screeningNo switch
            {
                1 => dto.Screening1Status ?? 0,
                2 => dto.Screening2Status ?? 0,
                3 => dto.Screening3Status ?? 0,
                4 => dto.Screening4Status ?? 0,
                5 => dto.Screening5Status ?? 0,
                6 => dto.Screening6Status ?? 0,
                _ => 0
            };

            int status = screeningNo switch
            {
                1 => existing.Screening1Status ?? 0,
                2 => existing.Screening2Status ?? 0,
                3 => existing.Screening3Status ?? 0,
                4 => existing.Screening4Status ?? 0,
                5 => existing.Screening5Status ?? 0,
                6 => existing.Screening6Status ?? 0,
                _ => 0
            };

            int count = screeningNo switch
            {
                1 => existing.Screening1Count ?? 0,
                2 => existing.Screening2Count ?? 0,
                3 => existing.Screening3Count ?? 0,
                4 => existing.Screening4Count ?? 0,
                5 => existing.Screening5Count ?? 0,
                6 => existing.Screening6Count ?? 0,
                _ => 0
            };

            // 🔒 Lock rules
            if (status == 1)
                return new BadRequestObjectResult($"Screening {screeningNo} already accepted.");

            if (status == 2 && count >= 2)
                return new BadRequestObjectResult($"Screening {screeningNo} already rejected twice.");

            // Increment count ONLY on rejection
            if (dtoStatus == 2)
                count++;

            DateTime now = DateTime.Now;

            switch (screeningNo)
            {
                case 1:
                    existing.Screening1Status = dto.Screening1Status;
                    existing.Screening1Count = count;
                    existing.Screening1Time = now;
                    if (count == 1) existing.Screening1Remark1 = dto.Screening1Remark1;
                    if (count == 2) existing.ScreeningRemark2 = dto.ScreeningRemark2;
                    existing.User1 = dto.User1;
                    break;

                case 2:
                    existing.Screening2Status = dto.Screening2Status;
                    existing.Screening2Count = count;
                    existing.Screening2Time = now;
                    if (count == 1) existing.Screening2Remark1 = dto.Screening2Remark1;
                    if (count == 2) existing.Screening2Remark2 = dto.Screening2Remark2;
                    existing.User2 = dto.User2;
                    break;

                case 3:
                    existing.Screening3Status = dto.Screening3Status;
                    existing.Screening3Count = count;
                    existing.Screening3Time = now;
                    if (count == 1) existing.Screening3Remark1 = dto.Screening3Remark1;
                    if (count == 2) existing.Screening3Remark2 = dto.Screening3Remark2;
                    existing.User3 = dto.User3;
                    break;

                case 4:
                    existing.Screening4Status = dto.Screening4Status;
                    existing.Screening4Count = count;
                    existing.Screening4Time = now;
                    if (count == 1) existing.Screening4Remark1 = dto.Screening4Remark1;
                    if (count == 2) existing.Screening4Remark2 = dto.Screening4Remark2;
                    existing.User4 = dto.User4;
                    break;
                case 5:
                    existing.Screening5Status = dto.Screening5Status;
                    existing.Screening5Count = count;
                    existing.Screening5Time = now;
                    if (count == 1) existing.Screening5Remark1 = dto.Screening5Remark1;
                    if (count == 2) existing.Screening5Remark2 = dto.Screening5Remark2;
                    existing.User5 = dto.User5;
                    break;
                case 6:
                    existing.Screening6Status = dto.Screening6Status;
                    existing.Screening6Count = count;
                    existing.Screening6Time = now;
                    if (count == 1) existing.Screening6Remark1 = dto.Screening6Remark1;
                    if (count == 2) existing.Screening6Remark2 = dto.Screening6Remark2;
                    existing.User6 = dto.User6;
                    break;
            }

            return null;
        }


        private async Task UpdateSupervisorAcceptanceAsync(
    int supId,
    int isAccepted
)
        {
            var supervisor = await _context.SupervisorRegistrations
                .FirstOrDefaultAsync(s => s.SupId == supId);
            var pers = await _context.SupervisorPersonal
                 .FirstOrDefaultAsync(s => s.SupId == supId);

            var edu = await _context.SupervisorEducations
                .FirstOrDefaultAsync(s => s.SupId == supId);

            if (supervisor == null)
                throw new Exception("Supervisor not found");

            supervisor.IsAccepted = isAccepted;

            _context.Entry(supervisor).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            // 🔐 Generate credentials ONLY when accepted
            if (isAccepted == 1)
            {
                var supervisorAuth = await _context.SupervisorAuths
                    .FirstOrDefaultAsync(sa => sa.SupId == supId);

                if (supervisorAuth == null)
                    throw new Exception("Supervisor auth not found");

                supervisorAuth.PermUserName = "SUP" + supervisor.ApplicationNumber;
                supervisorAuth.PermPassword = Passwordgen.GeneratePassword();
                supervisorAuth.isPermAutoGen = true;

                _context.Entry(supervisorAuth).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                string departmentName = await GetDepartmentNameAsync(pers);
                string collegeName = await GetCollegeNameAsync(edu);
                await SendApprovalEmailAsync(supervisor, supervisorAuth, departmentName,
             collegeName);
            }
            if (isAccepted == 2)
            {
                await SendRejectionEmailAsync(supervisor);
            }
        }

        private async Task<string> GetDepartmentNameAsync(SupervisorPersonal pers)
        {
            if (pers?.PrimarySuperviseSubject > 0)
            {
                var dept = await _context.Departments
                    .Where(d => d.DepartmentID == pers.PrimarySuperviseSubject)
                    .Select(d => d.Subject)
                    .FirstOrDefaultAsync();

                return dept ?? "";
            }

            return "";
        }

        private async Task<string> GetCollegeNameAsync(SupervisorEducation edu)
        {
            if (edu == null)
                return "";

            // Case 1: College selected from list
            if (edu.CollegeId > 0)
            {
                var college = await _context.CollegeLists
                    .Where(c => c.Id == edu.CollegeId)
                    .Select(c => c.CollegeName)
                    .FirstOrDefaultAsync();

                return college ?? "";
            }

            // Case 2: Manually entered college name
            return edu.CollegeName ?? "";
        }


        private async Task SendApprovalEmailAsync(
    SupervisorRegistration supervisor,
    SupervisorAuth auth, string departmentName,
    string collegeName)
        {
            var tokens = new Dictionary<string, string>
    {
        { "name", supervisor.FullName },
        { "dept", departmentName },
        { "college",collegeName },
        { "uname", auth.PermUserName },
        { "pwd", auth.PermPassword }
    };

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1010,
                tokens: tokens
            );

            string emailSubject = string.IsNullOrWhiteSpace(subject) || subject.Length > 150 || subject.Contains('\n') || subject.Contains('\r')
                ? "Research Supervisor Appointment - Approval and Login Details"
                : subject.Replace("\r", " ").Replace("\n", " ").Trim();

            _emailService.SendEmail(
                supervisor.Email,
                emailSubject,
                body
            );
        }


        private async Task SendRejectionEmailAsync(SupervisorRegistration supervisor)
        {
            var screening = await _context.SupervisorScreenings
                .FirstOrDefaultAsync(x => x.SupId == supervisor.SupId);

            string remarks =
                screening?.Screening1Remark1 ?? "Not eligible as per university norms.";

            string review =
                screening?.Screening2Remark2 ?? "";

            var tokens = new Dictionary<string, string>
    {
        { "user_id", supervisor.ApplicationNumber },
        { "appl_type", "Research Supervisor Application" },
        { "date", DateTime.Now.ToString("dd-MM-yyyy") },
        { "name", supervisor.FullName },
        { "appl_no", supervisor.ApplicationNumber },
        { "remarks", remarks },
        { "review", review }
    };

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1014,
                tokens: tokens
            );

            string emailSubject = string.IsNullOrWhiteSpace(subject) || subject.Length > 150 || subject.Contains('\n') || subject.Contains('\r')
                ? "Research Supervisor Application Status"
                : subject.Replace("\r", " ").Replace("\n", " ").Trim();

            _emailService.SendEmail(
                supervisor.Email,
                emailSubject,
                body
            );
        }


        [HttpGet]
        public async Task<IActionResult> GetStage1Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Status = (screening.Screening1Status ?? 0) == 1 ? "Provisional Accepted" :
                                 (screening.Screening1Status ?? 0) == 2 ? "Rejected" :
                                 "Pending",
                        Form = "Stage 1",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 1 eligible data", error = ex.Message });
            }
        }

        [HttpGet("stage2-eligible")]
        public async Task<IActionResult> GetStage2Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    where (screening.Screening1Status ?? 0) == 1 // Only those who passed Screening 1
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Status = (screening.Screening2Status ?? 0) == 1 ? "Final Accepted" :
                                 (screening.Screening2Status ?? 0) == 2 ? "Final Rejected" :
                                 "Pending Screening 2",
                        Form = "Stage 2",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 2 eligible data", error = ex.Message });
            }
        }


        [HttpGet("stage3-eligible")]
        public async Task<IActionResult> GetStage3Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    where (screening.Screening2Status ?? 0) == 1 // Only those who passed Screening 1
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Status = (screening.Screening3Status ?? 0) == 1 ? "Final Accepted" :
                                 (screening.Screening3Status ?? 0) == 2 ? "Final Rejected" :
                                 "Pending Screening 3",
                        Form = "Stage 3",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 2 eligible data", error = ex.Message });
            }
        }


        [HttpGet("stage4-eligible")]
        public async Task<IActionResult> GetStage4Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    where (screening.Screening3Status ?? 0) == 1 // Only those who passed Screening 1
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Status = (screening.Screening4Status ?? 0) == 1 ? "Final Accepted" :
                                 (screening.Screening4Status ?? 0) == 2 ? "Final Rejected" :
                                 "Pending Screening 4",
                        Form = "Stage 4",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 2 eligible data", error = ex.Message });
            }
        }


        [HttpGet("stage5-eligible")]
        public async Task<IActionResult> GetStage5Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    where (screening.Screening4Status ?? 0) == 1 // Only those who passed Screening 1
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Screening5Status = screening.Screening5Status ?? 0,
                        Screening5Count = screening.Screening5Count ?? 0,
                        Status = (screening.Screening5Status ?? 0) == 1 ? "Final Accepted" :
                                 (screening.Screening5Status ?? 0) == 2 ? "Final Rejected" :
                                 "Pending Screening 5",
                        Form = "Stage 5",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 2 eligible data", error = ex.Message });
            }
        }

        [HttpGet("stage6-eligible")]
        public async Task<IActionResult> GetStage6Eligible()
        {
            try
            {
                var result = await (
                    from screening in _context.SupervisorScreenings
                    join registration in _context.SupervisorRegistrations
                        on screening.SupId equals registration.SupId
                    join pers in _context.SupervisorPersonal
                        on screening.SupId equals pers.SupId
                    join desi in _context.Designations
                    on pers.Designation equals desi.DesignationID
                    join edu in _context.SupervisorEducations
                    on screening.SupId equals edu.SupId
                    join department in _context.Departments
                        on pers.PrimarySuperviseSubject equals department.DepartmentID
                    where (screening.Screening5Status ?? 0) == 1 // Only those who passed Screening 1
                    select new
                    {
                        ApplicationNo = registration.ApplicationNumber,
                        Name = registration.FullName,
                        Designation = desi.DesignationName,
                        Subject = department.Subject + " / " + department.Subject,
                        MobileNo = registration.MobileNo,
                        Screening1Status = screening.Screening1Status ?? 0,
                        Screening1Count = screening.Screening1Count ?? 0,
                        Screening2Status = screening.Screening2Status ?? 0,
                        Screening2Count = screening.Screening2Count ?? 0,
                        Screening3Status = screening.Screening3Status ?? 0,
                        Screening3Count = screening.Screening3Count ?? 0,
                        Screening4Status = screening.Screening4Status ?? 0,
                        Screening4Count = screening.Screening4Count ?? 0,
                        Screening5Status = screening.Screening5Status ?? 0,
                        Screening5Count = screening.Screening5Count ?? 0,
                        Screening6Status = screening.Screening6Status ?? 0,
                        Screening6Count = screening.Screening6Count ?? 0,
                        Status = (screening.Screening6Status ?? 0) == 1 ? "Final Accepted" :
                                 (screening.Screening6Status ?? 0) == 2 ? "Final Rejected" :
                                 "Pending Screening 6",
                        Form = "Stage 6",
                        SupId = screening.SupId
                    }
                ).ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving stage 2 eligible data", error = ex.Message });
            }
        }

        // Get screening details for a specific supervisor
        /* [HttpGet("{supId}")]
         public async Task<IActionResult> GetScreeningBySupId(int supId)
         {
             try
             {
                 var screening = await _context.SupervisorScreenings
                     .FirstOrDefaultAsync(s => s.SupId == supId);
                 join a1 in _context.Admins on s.User1 equals a1.AID into u1
                    from a1 in u1.DefaultIfEmpty()
                     join a2 in _context.Admins on s.User2 equals a2.AID into u2
                     from a2 in u2.DefaultIfEmpty()
                     join a3 in _context.Admins on s.User3 equals a3.AID into u3
                     from a3 in u3.DefaultIfEmpty()
                     join a4 in _context.Admins on s.User4 equals a4.AID into u4
                     from a4 in u4.DefaultIfEmpty()
                     join a5 in _context.Admins on s.User5 equals a5.AID into u5
                     from a5 in u5.DefaultIfEmpty()
                     join a6 in _context.Admins on s.User6 equals a6.AID into u6
                     from a6 in u6.DefaultIfEmpty()
                 if (screening == null)
                 {
                     // Return a default screening object instead of 404
                     var defaultScreening = new SupervisorScreening
                     {
                         Id = 0,
                         SupId = supId,
                         Screening1Status = 0,
                         Screening2Status = 0,
                         Screening1Count = 0,
                         Screening2Count = 0,
                         Screening1Remark1 = "",
                         ScreeningRemark2 = "",
                         Screening2Remark1 = "",
                         Screening2Remark2 = "",
                         User1 = 0,
                         User2 = 0,
                         Screening1Time = null,
                         Screening2Time = null,
                         Screening3Count = 0,
                         Screening4Count = 0,
                         Screening3Remark1 = "",
                         Screening3Remark2 = "",
                         Screening4Remark1 = "",
                         Screening4Remark2 = "",
                         User3 = 0,
                         User4 = 0,
                         Screening3Time = null,
                         Screening4Time = null,
                         Screening3Status = 0,
                         Screening4Status = 0,
                         Screening5Status = 0,
                         Screening6Status = 0,
                         Screening5Time = null,
                         Screening6Time = null,
                         User5 = 0,
                         User6 = 0,
                         Screening5Remark1 = "",
                         Screening5Remark2 = "",
                         Screening5Count = 0,
                         Screening6Count = 0,
                         Screening6Remark1 = "",
                         Screening6Remark2 = "",

                     };
                     return Ok(defaultScreening);
                 }

                 // Ensure nullable fields have default values if null
                 screening.Screening1Status ??= 0;
                 screening.Screening2Status ??= 0;
                 screening.Screening1Count ??= 0;
                 screening.Screening2Count ??= 0;
                 screening.Screening1Remark1 ??= "";
                 screening.ScreeningRemark2 ??= "";
                 screening.Screening2Remark1 ??= "";
                 screening.Screening2Remark2 ??= "";
                 screening.Screening3Status ??= 0;
                 screening.Screening4Status ??= 0;
                 screening.Screening3Count ??= 0;
                 screening.Screening4Count ??= 0;
                 screening.Screening3Remark1 ??= "";
                 screening.Screening3Remark2 ??= "";
                 screening.Screening4Remark1 ??= "";
                 screening.Screening4Remark2 ??= "";
                 screening.User3 ??= 0;
                 screening.User4 ??= 0;
                 screening.User1 ??= 0;
                 screening.User2 ??= 0;
                 screening.Screening5Status ??= 0;
                 screening.Screening6Status ??= 0;
                 screening.Screening5Time ??= null;
                 screening.Screening6Time ??= null;
                 screening.User5 ??= 0;
                 screening.User6 ??= 0;
                 screening.Screening5Remark1 ??= "";
                 screening.Screening5Remark2 ??= "";
                 screening.Screening5Count ??= 0;
                 screening.Screening6Count ??= 0;
                 screening.Screening6Remark1 ??= "";
                 screening.Screening6Remark2 ??= "";
                 return Ok(screening);
             }
             catch (Exception ex)
             {
                 return StatusCode(500, new { message = "Error retrieving screening data", error = ex.Message });
             }
         }*/


        [HttpGet("{supId}")]
        public async Task<IActionResult> GetScreeningBySupId(int supId) =>
            Ok(await GetScreeningDataAsync(supId));

        [HttpGet("Screening")]
        public async Task<IActionResult> GetScreeningBySupervisorId(int supId) =>
            Ok(await GetScreeningDataAsync(supId));

        private async Task<object> GetScreeningDataAsync(int supId)
        {
            try
            {
                var instance = await _context.WorkflowInstances
                    .Where(i => i.EntityType == "Supervisor" && i.EntityID == supId)
                    .OrderByDescending(i => i.StartedAt)
                    .FirstOrDefaultAsync();

                var logs = instance != null
                    ? await _context.WorkflowLogs
                        .Include(l => l.Step)
                        .Where(l => l.InstanceID == instance.InstanceID)
                        .ToListAsync()
                    : new List<WorkflowLog>();

                var adminIds = logs.Select(l => l.ActionByUserID).Distinct();
                var adminMap = await _context.Admins
                    .Where(a => adminIds.Contains(a.AID))
                    .ToDictionaryAsync(a => a.AID, a => a.Name);

                var legacy = await _context.SupervisorScreenings
                    .FirstOrDefaultAsync(s => s.SupId == supId) ?? new SupervisorScreening { SupId = supId };

                // Resolve each step's status, date, reviewer name, and remarks
                (int Status, DateTime? Time, string User, string Remark) ResolveStep(int order, int? legStatus, DateTime? legTime, string? legRemark)
                {
                    var log = logs.LastOrDefault(l => l.Step?.StepOrder == order);
                    if (log != null)
                    {
                        string user = adminMap.TryGetValue(log.ActionByUserID, out var name) ? name : $"Admin #{log.ActionByUserID}";
                        return (log.Action == "Approve" ? 1 : 2, log.ActionTimestamp, user, log.Comments ?? "");
                    }
                    return (legStatus ?? 0, legTime, "", legRemark ?? "");
                }

                var s1 = ResolveStep(1, legacy.Screening1Status, legacy.Screening1Time, legacy.Screening1Remark1);
                var s2 = ResolveStep(2, legacy.Screening2Status, legacy.Screening2Time, legacy.Screening2Remark1);
                var s3 = ResolveStep(3, legacy.Screening3Status, legacy.Screening3Time, legacy.Screening3Remark1);
                var s4 = ResolveStep(4, legacy.Screening4Status, legacy.Screening4Time, legacy.Screening4Remark1);
                var s5 = ResolveStep(5, legacy.Screening5Status, legacy.Screening5Time, legacy.Screening5Remark1);
                var s6 = ResolveStep(6, legacy.Screening6Status, legacy.Screening6Time, legacy.Screening6Remark1);

                var supervisorReg = await _context.SupervisorRegistrations.FindAsync(supId);
                string eligibility = (instance?.Status == "Approved" || supervisorReg?.IsAccepted == 1 || s6.Status == 1) ? "Eligible"
                    : (instance?.Status == "Rejected" || supervisorReg?.IsAccepted == 2 || supervisorReg?.IsAccepted == 3 || s6.Status == 2) ? "Not Eligible"
                    : "Pending";

                return new
                {
                    Screening = new
                    {
                        legacy.Id,
                        SupId = supId,
                        Screening1Status = s1.Status, Screening2Status = s2.Status, Screening3Status = s3.Status,
                        Screening4Status = s4.Status, Screening5Status = s5.Status, Screening6Status = s6.Status,
                        Screening1Time = s1.Time, Screening2Time = s2.Time, Screening3Time = s3.Time,
                        Screening4Time = s4.Time, Screening5Time = s5.Time, Screening6Time = s6.Time,
                        User1 = s1.User, User2 = s2.User, User3 = s3.User,
                        User4 = s4.User, User5 = s5.User, User6 = s6.User,
                        Screening1Remark1 = s1.Remark, Screening2Remark1 = s2.Remark, Screening3Remark1 = s3.Remark,
                        Screening4Remark1 = s4.Remark, Screening5Remark1 = s5.Remark, Screening6Remark1 = s6.Remark,
                        Screening1Count = legacy.Screening1Count ?? 0,
                        Screening2Count = legacy.Screening2Count ?? 0,
                        Screening3Count = legacy.Screening3Count ?? 0,
                        Screening4Count = legacy.Screening4Count ?? 0,
                        Screening5Count = legacy.Screening5Count ?? 0,
                        Screening6Count = legacy.Screening6Count ?? 0
                    },
                    Eligibility = eligibility,
                    User1Name = s1.User,
                    User2Name = s2.User,
                    User3Name = s3.User,
                    User4Name = s4.User,
                    User5Name = s5.User,
                    User6Name = s6.User
                };
            }
            catch (Exception ex)
            {
                return new { message = "Error retrieving screening data", error = ex.Message };
            }
        }


    }
}
