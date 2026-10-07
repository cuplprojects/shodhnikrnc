using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OfficeDashboardController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public OfficeDashboardController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/OfficeDashboard/Counts
        [HttpGet("PHD-Admission-Dashboard")]
        public async Task<IActionResult> GetOfficeDashboardCounts([FromQuery] int? regType)
        {
            // 🔹 Base scholars query
            var scholarsQuery = _context.Scholars.AsQueryable();

            // 🔹 Apply RegType filter ONLY if passed
            if (regType.HasValue)
            {
                scholarsQuery = scholarsQuery.Where(s => s.RegType == regType.Value);
            }

            // ===== TOTAL APPLICANTS =====
            var totalApplicantCount = await scholarsQuery.CountAsync();

            // ===== UPLOADED SIDs =====
            var uploadedSids = await _context.ScholarUploads
                .Select(x => x.SID)
                .Distinct()
                .ToListAsync();

            // ===== SCREENING =====
            var screeningCount = await scholarsQuery
                .Where(s =>
                    s.DecisionStatus == (DecisionStatus)3 &&
                    !uploadedSids.Contains(s.SID))
                .CountAsync();

            // ===== REJECTED SCREENING =====
            var rejectedScreeningCount = await _context.ScholarUploads
                .CountAsync(x =>
                    x.DecisionStatus.HasValue &&
                    (int)x.DecisionStatus == 2);

            // ===== INTERVIEW =====
            var interviewScheduled = await scholarsQuery
                .CountAsync(s => s.DecisionStatus == DecisionStatus.InterviewScheduled);

            var interviewPass = await scholarsQuery
                .CountAsync(s => s.DecisionStatus == DecisionStatus.InterviewApproved);

            var interviewFail = await scholarsQuery
                .CountAsync(s => s.DecisionStatus == DecisionStatus.InterviewRejected);

            // ===== COUNSELLING =====
            var counsellingScheduled = await scholarsQuery
                .CountAsync(s => s.DecisionStatus == DecisionStatus.CounsellingScheduled);

            var counsellingDone = await scholarsQuery
                .CountAsync(s => s.DecisionStatus == DecisionStatus.CounsellingApprovedFinal);

            // ===== RESPONSE =====
            return Ok(new
            {
                TotalApplicants = totalApplicantCount,
                Screening = screeningCount,
                RejectScreening = rejectedScreeningCount,
                InterviewScheduled = interviewScheduled,
                InterviewPassed = interviewPass,
                InterviewFail = interviewFail,
                CounsellingScheduled = counsellingScheduled,
                CounsellingDone = counsellingDone
            });
        }






        [HttpGet("PHD-Admission")]
        public async Task<IActionResult> GetAdmissionDashboardStudents(
       [FromQuery] string type,
       [FromQuery] int? regType   // ✅ OPTIONAL
   )
        {
            if (string.IsNullOrEmpty(type))
                return BadRequest("Type parameter is required.");

            // 🔹 Base query
            var query =
                from s in _context.Scholars
                join d in _context.Departments
                    on s.Subject_ID equals d.DepartmentID
                select new { s, d };

            // 🔹 Apply RegType filter ONLY if passed
            if (regType.HasValue)
            {
                query = query.Where(x => x.s.RegType == regType.Value);
            }

            switch (type.ToLower())
            {
                // 🔹 ALL TOTAL APPLICATIONS
                case "all":
                    // no extra filter
                    break;

                case "screening":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.ApplicationScreeningPassed);
                    break;

                case "reject-screening":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.ApplicationScreeningRejected);
                    break;

                case "interview-scheduled":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.InterviewScheduled);
                    break;

                case "interview-passed":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.InterviewApproved);
                    break;

                case "interview-failed":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.InterviewRejected);
                    break;

                case "counselling-scheduled":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.CounsellingScheduled);
                    break;

                case "counselling-done":
                    query = query.Where(x =>
                        x.s.DecisionStatus == DecisionStatus.CounsellingRejectedFinal);
                    break;

                default:
                    return BadRequest("Invalid type parameter.");
            }

            var students = await query
                .Select(x => new
                {
                    SID = x.s.SID,
                    Name = x.s.Name,
                    PhoneNumber = x.s.PhoneNumber,
                    ApplicationNo = x.s.ApplicationNo,
                    SubjectID = x.s.Subject_ID,
                    Subject = x.d.Subject
                })
                .Distinct()
                .ToListAsync();

            return Ok(students);
        }




        public class AdmissionDashboardScholarDetailsDto
        {
            public int SID { get; set; }
            public string Name { get; set; }
            public string PhoneNumber { get; set; }
            public string? ApplicationNo { get; set; }
            public int? SubjectID { get; set; }
            public string? Subject { get; set; }
        }


        // =================================================================================================




        //[HttpGet("GetResearchEntranceTestApplication")]
        //public async Task<IActionResult> GetRetAndPhdCounts()
        //{
        //    var data = await _context.Scholars
        //        .GroupBy(x => 1)
        //        .Select(g => new ScholarRegTypeCountDto
        //        {
        //            RetApplicationCount = g.Count(x => x.RegType == 1),

        //            NetExemptedCount = g.Count(x =>
        //                x.RegType == 2 || x.RegType == 3 ||
        //                x.RegType == 4 || x.RegType == 5),

        //            PhdForeignStudentCount = g.Count(x =>
        //                x.RegType == 6 || x.RegType == 7 ||
        //                x.RegType == 8 || x.RegType == 9),

        //            PartTimeCount = g.Count(x => x.isPartTime == true),

        //            TotalCount = g.Count()
        //        })
        //        .FirstOrDefaultAsync();

        //    return Ok(data ?? new ScholarRegTypeCountDto());
        //}


        //public class ScholarRegTypeCountDto
        //{
        //    public int RetApplicationCount { get; set; }
        //    public int NetExemptedCount { get; set; }
        //    public int PhdForeignStudentCount { get; set; }
        //    public int PartTimeCount { get; set; }
        //    public int TotalCount { get; set; }
        //}

        // ==================================================================================================


        //[HttpGet("GetRetCounts")]
        //public async Task<IActionResult> GetRetCounts()
        //{
        //    var baseQuery = _context.Scholars
        //.Where(s =>
        //    (s.RegType == 1)
        //    && (s.isPartTime == false || s.isPartTime == null)   // ✅ only full-time
        //);

        //    var applicationReceivedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID))
        //        .CountAsync();

        //    var unscreenedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)0))
        //        .CountAsync();

        //    var notEligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)2))
        //        .CountAsync();

        //    var eligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    var applicationForReviewCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)1))
        //        .CountAsync();

        //    return Ok(new
        //    {
        //        ApplicationReceivedCount = applicationReceivedCount,
        //        UnscreenedCount = unscreenedCount,
        //        EligibleCount = eligibleCount,
        //        NotEligibleCount = notEligibleCount,
        //        ApplicationForReviewCount = applicationForReviewCount
        //    });
        //}









        //[HttpGet("RET")]
        //public async Task<IActionResult> GetRetDashboardStudents([FromQuery] string type)
        //{
        //    if (string.IsNullOrEmpty(type))
        //        return BadRequest("Type parameter is required.");

        //    var query =
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()
        //        where s.RegType == 1
        //              && (s.isPartTime == false || s.isPartTime == null)
        //        select new { s, d, sp };

        //    switch (type.ToLower())
        //    {
        //        case "received":
        //            query = query.Where(x =>
        //                _context.ScholarUploads.Any(u => u.SID == x.s.SID));
        //            break;


        //        case "unscreened":
        //            query = query.Where(x =>
        //                x.s.DecisionStatus == (DecisionStatus)0);
        //            break;

        //        case "eligible":
        //            query = query.Where(x =>
        //                x.s.DecisionStatus == (DecisionStatus)3);
        //            break;

        //        case "not-eligible":
        //            query = query.Where(x =>
        //                x.s.DecisionStatus == (DecisionStatus)2);
        //            break;

        //        case "review":
        //            query = query.Where(x =>
        //                x.s.DecisionStatus == (DecisionStatus)1);
        //            break;

        //        default:
        //            return BadRequest("Invalid type parameter.");
        //    }

        //    var students = await query
        //        .Select(x => new RetStudentDetailsDto
        //        {
        //            ApplicationNo = x.s.ApplicationNo,
        //            Name = x.s.Name,
        //            Category = x.sp != null ? x.sp.Category : null,
        //            SubjectID = x.s.Subject_ID,
        //            Subject = x.d.Subject,
        //            PhoneNumber = x.s.PhoneNumber
        //        })
        //        .Distinct()
        //        .ToListAsync();

        //    return Ok(students);
        //}



        //public class RetStudentDetailsDto
        //{
        //    public string? ApplicationNo { get; set; }
        //    public string Name { get; set; }
        //    public string? Category { get; set; }
        //    public int SubjectID { get; set; }
        //    public string? Subject { get; set; }
        //    public string PhoneNumber { get; set; }
        //}

        //======================================================================================================



        //[HttpGet("GetRetExemptionCounts")]
        //public async Task<IActionResult> GetRetExemptionCounts()
        //{
        //    var baseQuery = _context.Scholars
        //.Where(s =>
        //    (s.RegType == 2 || s.RegType == 3 ||
        //     s.RegType == 4 || s.RegType == 5)
        //    && (s.isPartTime != true)   // ✅ only full-time
        //);

        //    var applicationReceivedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID))
        //        .CountAsync();

        //    var unscreenedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == UploadDecisionStatus.DocumentPendingforVerification))
        //        .CountAsync();

        //    var notEligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)2))
        //        .CountAsync();

        //    var eligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    var applicationForReviewCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)1))
        //        .CountAsync();

        //    return Ok(new
        //    {
        //        ApplicationReceivedCount = applicationReceivedCount,
        //        UnscreenedCount = unscreenedCount,
        //        EligibleCount = eligibleCount,
        //        NotEligibleCount = notEligibleCount,
        //        ApplicationForReviewCount = applicationForReviewCount
        //    });
        //}


        //[HttpGet("list-of-RET-Exempted-Application-Received-Students")]
        //public async Task<IActionResult> GetRetExemptedApplicationReceivedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()
        //        where (s.RegType == 2 || s.RegType == 3 || s.RegType == 4 || s.RegType == 5)
        //              && (s.isPartTime == false || s.isPartTime == null)
        //              && _context.ScholarUploads.Any(u => u.SID == s.SID)
        //        select new RetExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).Distinct().ToListAsync();

        //    return Ok(students);
        //}



        //[HttpGet("list-of-RET-Exempted-Unscreened-Students")]
        //public async Task<IActionResult> GetExemptedUnscreenedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 2 || s.RegType == 3 || s.RegType == 4 || s.RegType == 5
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)0
        //        select new RetExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-RET-Exempted-Eligible-Students")]
        //public async Task<IActionResult> GetExemptedEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 2 || s.RegType == 3 || s.RegType == 4 || s.RegType == 5
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)3
        //        select new RetExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //[HttpGet("list-of-RET-Exempted-NotEligible-Students")]
        //public async Task<IActionResult> GetExemptedNotEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 2 || s.RegType == 3 || s.RegType == 4 || s.RegType == 5
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)2
        //        select new RetExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-RET-Exampted-Review-Students")]
        //public async Task<IActionResult> GetExamtedReviewStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 2 || s.RegType == 3 || s.RegType == 4 || s.RegType == 5
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)1
        //        select new RetExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //public class RetExemptedStudentDetailsDto
        //{
        //    public string? ApplicationNo { get; set; }
        //    public string Name { get; set; }
        //    public string? Category { get; set; }
        //    public int SubjectID { get; set; }
        //    public string? Subject { get; set; }
        //    public string PhoneNumber { get; set; }
        //}

      //================================================================================================

        //[HttpGet("PhdForForeignExemptionCounts")]
        //public async Task<IActionResult> GetPhdForForeignExemptionCounts()
        //{
        //    var baseQuery = _context.Scholars
        // .Where(s =>
        //     (s.RegType == 6 || s.RegType == 7 ||
        //      s.RegType == 8 || s.RegType == 9)
        //     && (s.isPartTime == false || s.isPartTime == null)   // ✅ only full-time
        // );
        //    var applicationReceivedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID))
        //        .CountAsync();

        //    var unscreenedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)0))
        //        .CountAsync();

        //    var notEligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)2))
        //        .CountAsync();

        //    var eligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    var applicationForReviewCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    return Ok(new
        //    {
        //        ApplicationReceivedCount = applicationReceivedCount,
        //        UnscreenedCount = unscreenedCount,
        //        EligibleCount = eligibleCount,
        //        NotEligibleCount = notEligibleCount,
        //        ApplicationForReviewCount = applicationForReviewCount
        //    });
        //}



        //[HttpGet("list-of-RET-Foreign-Exempted-Application-Received-Students")]
        //public async Task<IActionResult> GetRetForeignExemptedApplicationReceivedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 6 || s.RegType == 7 || s.RegType == 8 || s.RegType == 9
        //        && (s.isPartTime == false || s.isPartTime == null)
        //        select new RetForeignExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //[HttpGet("list-of-RET-Foreign-Exempted-Unscreened-Students")]
        //public async Task<IActionResult> GetForeignExemptedUnscreenedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 6 || s.RegType == 7 || s.RegType == 8 || s.RegType == 9
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)0
        //        select new RetForeignExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-RET-Foreign-Exempted-Eligible-Students")]
        //public async Task<IActionResult> GetForeignExemptedEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 6 || s.RegType == 7 || s.RegType == 8 || s.RegType == 9
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)3
        //        select new RetForeignExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //[HttpGet("list-of-RET-Foreign-Exempted-NotEligible-Students")]
        //public async Task<IActionResult> GetForeignExemptedNotEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 6 || s.RegType == 7 || s.RegType == 8 || s.RegType == 9
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)2
        //        select new RetForeignExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-RET-Foreign-Exampted-Review-Students")]
        //public async Task<IActionResult> GetForeignExamtedReviewStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where s.RegType == 6 || s.RegType == 7 || s.RegType == 8 || s.RegType == 9
        //        && (s.isPartTime == false || s.isPartTime == null)
        //              && s.DecisionStatus == (DecisionStatus)1
        //        select new RetForeignExemptedStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //public class RetForeignExemptedStudentDetailsDto
        //{
        //    public string? ApplicationNo { get; set; }
        //    public string Name { get; set; }
        //    public string? Category { get; set; }
        //    public int SubjectID { get; set; }
        //    public string? Subject { get; set; }
        //    public string PhoneNumber { get; set; }
        //}


        //============================================================================================


        //[HttpGet("PartTimePhdCountCounts")]
        //public async Task<IActionResult> GetPartTimePhdCountCounts()
        //{
        //    var baseQuery = _context.Scholars
        // .Where(s =>
             
        //      (s.isPartTime == true)   // ✅ only full-time
        // );
        //    var applicationReceivedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID))
        //        .CountAsync();

        //    var unscreenedCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)0))
        //        .CountAsync();

        //    var notEligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)2))
        //        .CountAsync();

        //    var eligibleCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    var applicationForReviewCount = await baseQuery
        //        .Where(s => _context.ScholarUploads
        //            .Any(u => u.SID == s.SID
        //                && u.DecisionStatus == (UploadDecisionStatus)3))
        //        .CountAsync();

        //    return Ok(new
        //    {
        //        ApplicationReceivedCount = applicationReceivedCount,
        //        UnscreenedCount = unscreenedCount,
        //        EligibleCount = eligibleCount,
        //        NotEligibleCount = notEligibleCount,
        //        ApplicationForReviewCount = applicationForReviewCount
        //    });
        //}

        //[HttpGet("list-of-PartTime-Application-Received-Students")]
        //public async Task<IActionResult> GetPartTimeApplicationReceivedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where (s.isPartTime == true)
        //        select new PartTimeStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //[HttpGet("list-of-PartTime-Unscreened-Students")]
        //public async Task<IActionResult> GetPartTimeUnscreenedStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where (s.isPartTime == true)
        //              && s.DecisionStatus == (DecisionStatus)0
        //        select new PartTimeStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-PartTime-Eligible-Students")]
        //public async Task<IActionResult> GetPartTimeEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where (s.isPartTime == true)
        //              && s.DecisionStatus == (DecisionStatus)3
        //        select new PartTimeStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //[HttpGet("list-of-PartTime-NotEligible-Students")]
        //public async Task<IActionResult> GetPartTimeNotEligibleStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where (s.isPartTime == true)
        //              && s.DecisionStatus == (DecisionStatus)2
        //        select new PartTimeStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}

        //[HttpGet("list-of-PartTime-Review-Students")]
        //public async Task<IActionResult> GetPartTimeReviewStudents()
        //{
        //    var students = await (
        //        from s in _context.Scholars
        //        join d in _context.Departments
        //            on s.Subject_ID equals d.DepartmentID
        //        join sp in _context.ScholarPersonalDetails
        //            on s.SID equals sp.SID into spJoin
        //        from sp in spJoin.DefaultIfEmpty()   // LEFT JOIN
        //        where (s.isPartTime == true)
        //              && s.DecisionStatus == (DecisionStatus)1
        //        select new PartTimeStudentDetailsDto
        //        {
        //            ApplicationNo = s.ApplicationNo,
        //            Name = s.Name,
        //            Category = sp != null ? sp.Category : null,
        //            SubjectID = s.Subject_ID,
        //            Subject = d.Subject,
        //            PhoneNumber = s.PhoneNumber
        //        }
        //    ).ToListAsync();

        //    return Ok(students);
        //}


        //public class PartTimeStudentDetailsDto
        //{
        //    public string? ApplicationNo { get; set; }
        //    public string Name { get; set; }
        //    public string? Category { get; set; }
        //    public int SubjectID { get; set; }
        //    public string? Subject { get; set; }
        //    public string PhoneNumber { get; set; }
        //}




    }



}


