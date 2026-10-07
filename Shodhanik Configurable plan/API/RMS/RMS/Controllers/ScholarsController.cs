using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Client;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;

        public ScholarsController(RMSDbContext context, IConfiguration configuration, IEmailService emailService, IEmailTemplateService emailTemplateService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _emailTemplateService = emailTemplateService;

        }

        // GET: api/Scholars
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Scholar>>> GetScholars()
        {
            return await _context.Scholars.ToListAsync();
        }


        [HttpGet("PhdApplications")]
        public async Task<ActionResult<object>> GetPhdApplications(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 10,
    [FromQuery] string? search = null,
    [FromQuery] string? status = null,
    [FromQuery] string? regType = null,
    [FromQuery] string? primaryFilter = null,
    [FromQuery] string? sortField = null,
    [FromQuery] string? sortOrder = null,
    [FromQuery] bool onlyCompletedStep5 = true)
        {
            try
            {
                var query =
                    from s in _context.Scholars
                    join rt in _context.RegTypes on s.RegType equals rt.RegTypeID
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join app in _context.ScholarApplicationStatuses on s.SID equals app.SID into appGroup
                    from app in appGroup.DefaultIfEmpty()
                    select new
                    {
                        Scholar = s,
                        RegTypeName = rt.RegTypeName,
                        ExemptCategory = rt.ExemptCategory,
                        DepartmentName = d.Subject,
                        ApplicationStatus = app
                    };

                // ===============================
                // STEP COMPLETION FILTER
                // ===============================
                if (onlyCompletedStep5)
                {
                    query = query.Where(x =>
                        x.ApplicationStatus != null &&
                        (x.ApplicationStatus.Step_1 ?? false) &&
                        (x.ApplicationStatus.Step_2 ?? false) &&
                        (x.ApplicationStatus.Step_3 ?? false) &&
                        (x.ApplicationStatus.Step_4 ?? false) &&
                        (x.ApplicationStatus.Step_5 ?? false));
                }

                // ===============================
                // PRIMARY FILTER
                // ===============================
                if (!string.IsNullOrEmpty(primaryFilter) && primaryFilter != "all")
                {
                    query = primaryFilter switch
                    {
                        "ret" => query.Where(x => x.RegTypeName.Contains("RET")),
                        "net_ret_exemption" => query.Where(x => x.ExemptCategory != null && x.ExemptCategory.Contains("NET")),
                        "phd_direct" => query.Where(x => x.RegTypeName.Contains("Direct")),
                        "part_time" => query.Where(x => x.Scholar.isPartTime == true),
                        "foreign_students" => query.Where(x => x.RegTypeName.Contains("Foreign")),
                        _ => query
                    };
                }

                // ===============================
                // REG TYPE FILTER
                // ===============================
                if (!string.IsNullOrEmpty(regType) && regType != "all")
                {
                    query = regType switch
                    {
                        "ret_regular" => query.Where(x =>
                            x.RegTypeName.Contains("RET") &&
                            (x.ExemptCategory == null || !x.ExemptCategory.Contains("Exemption"))),

                        "ret_exemption" => query.Where(x =>
                            x.ExemptCategory != null && x.ExemptCategory.Contains("Exemption")),

                        "foreign_students" => query.Where(x =>
                            x.RegTypeName.Contains("Foreign")),

                        "part_time" => query.Where(x =>
                            x.Scholar.isPartTime == true),

                        "phd_direct" => query.Where(x =>
                            x.RegTypeName.Contains("Direct")),

                        _ => query
                    };
                }

                // ===============================
                // STATUS FILTER (INDIVIDUAL ENUM)
                // ===============================
                if (!string.IsNullOrEmpty(status) && status != "all")
                {
                    // Ignore synopsis completely
                    query = query.Where(x => (int)x.Scholar.DecisionStatus <= 12);

                    if (!Enum.TryParse<DecisionStatus>(status, true, out var parsedStatus))
                        return BadRequest($"Invalid status value: {status}");

                    // PASSED / APPROVED → CUMULATIVE
                    if (parsedStatus == DecisionStatus.ApplicationScreeningPassed ||
                        parsedStatus == DecisionStatus.InterviewApproved ||
                        parsedStatus == DecisionStatus.CounsellingApprovedFinal ||
                        parsedStatus == DecisionStatus.CourseworkApproved)
                    {
                        query = query.Where(x => x.Scholar.DecisionStatus >= parsedStatus);
                    }
                    else
                    {
                        // NON-PASSED → EXACT MATCH
                        query = query.Where(x => x.Scholar.DecisionStatus == parsedStatus);
                    }
                }

                // ===============================
                // SEARCH
                // ===============================
                if (!string.IsNullOrEmpty(search))
                {
                    var s = search.ToLower();
                    query = query.Where(x =>
                        x.Scholar.ApplicationNo.ToLower().Contains(s) ||
                        x.Scholar.Name.ToLower().Contains(s) ||
                        x.Scholar.Email.ToLower().Contains(s) ||
                        x.Scholar.PhoneNumber.Contains(search) ||
                        x.RegTypeName.ToLower().Contains(s) ||
                        x.DepartmentName.ToLower().Contains(s));
                }

                // ===============================
                // TOTAL COUNT
                // ===============================
                var totalCount = await query.CountAsync();

                // ===============================
                // SORTING
                // ===============================
                query = sortField?.ToLower() switch
                {
                    "name" => sortOrder == "ascend"
                        ? query.OrderBy(x => x.Scholar.Name)
                        : query.OrderByDescending(x => x.Scholar.Name),

                    "email" => sortOrder == "ascend"
                        ? query.OrderBy(x => x.Scholar.Email)
                        : query.OrderByDescending(x => x.Scholar.Email),

                    "department" => sortOrder == "ascend"
                        ? query.OrderBy(x => x.DepartmentName)
                        : query.OrderByDescending(x => x.DepartmentName),

                    _ => query.OrderByDescending(x => x.Scholar.SID)
                };

                // ===============================
                // PAGINATION + PROJECTION
                // ===============================
                var temp = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(x => new
                    {
                        x.Scholar.SID,
                        ScholarId = x.Scholar.ApplicationNo,
                        x.Scholar.Name,
                        x.Scholar.Email,
                        x.Scholar.PhoneNumber,
                        RegType = x.RegTypeName,
                        x.ExemptCategory,
                        Department = x.DepartmentName,
                        x.Scholar.DecisionStatus,
                        IsPartTime = x.Scholar.isPartTime ?? false,
                        Year = x.Scholar.Year
                    })
                    .ToListAsync();

                var data = temp.Select(x => new
                {
                    x.SID,
                    x.ScholarId,
                    x.Name,
                    x.Email,
                    x.PhoneNumber,
                    x.RegType,
                    x.ExemptCategory,
                    x.Department,
                    DecisionStatus = (int)x.DecisionStatus,
                    StatusText = GetStatusString(x.DecisionStatus),
                    x.IsPartTime,
                    x.Year
                });

                return Ok(new
                {
                    Data = data,
                    Total = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private static string GetStatusString(DecisionStatus status)
        {
            return status switch
            {
                DecisionStatus.ApplicationScreeningPending => "Screening Pending",
                DecisionStatus.ApplicationScreeningHold => "Screening On Hold",
                DecisionStatus.ApplicationScreeningRejected => "Screening Rejected",
                DecisionStatus.ApplicationScreeningPassed => "Screening Passed",

                DecisionStatus.InterviewScheduled => "Interview Scheduled",
                DecisionStatus.InterviewRejected => "Interview Rejected",
                DecisionStatus.InterviewApproved => "Interview Approved",

                DecisionStatus.CounsellingScheduled => "Counselling Scheduled",
                DecisionStatus.CounsellingUnderReview => "Counselling Under Review",
                DecisionStatus.CounsellingRejectedFinal => "Rejected",
                DecisionStatus.CounsellingApprovedFinal => "Selected",

                DecisionStatus.CourseworkRejected => "Coursework Rejected",
                DecisionStatus.CourseworkApproved => "Coursework Approved",

                DecisionStatus.SysnopsisSubmitted => "Synopsis Submitted",
                DecisionStatus.SysnopsisApproved => "Synopsis Approved",
                DecisionStatus.SysnopsisRejected => "Synopsis Rejected",

                _ => "N/A"
            };
        }

        // GET: api/Scholars/PhdApplications/PrimaryFilterCounts
        [HttpGet("PhdApplications/PrimaryFilterCounts")]
        public async Task<ActionResult<object>> GetPhdApplicationPrimaryFilterCounts()
        {
            try
            {
                var query = from s in _context.Scholars
                            join rt in _context.RegTypes on s.RegType equals rt.RegTypeID
                            select new
                            {
                                Scholar = s,
                                RegTypeName = rt.RegTypeName,
                                ExemptCategory = rt.ExemptCategory
                            };

                var scholars = await query.ToListAsync();
                var total = scholars.Count;

                var counts = new Dictionary<string, int>
                {
                    ["total"] = total,
                    ["ret"] = scholars.Count(s => s.RegTypeName.Contains("RET") || s.RegTypeName.Contains("Research Entrance Test")),
                    ["net_ret_exemption"] = scholars.Count(s => s.ExemptCategory != null && s.ExemptCategory.Contains("NET")),
                    ["phd_direct"] = scholars.Count(s => s.RegTypeName.Contains("Direct") || s.RegTypeName.Contains("Ph.D. Direct")),
                    ["part_time"] = scholars.Count(s => s.Scholar.isPartTime == true),
                    ["foreign_students"] = scholars.Count(s => s.RegTypeName.Contains("Foreign") || s.ExemptCategory != null && s.ExemptCategory.Contains("Foreign")),
                    ["net_qualified"] = scholars.Count(s => s.ExemptCategory != null && s.ExemptCategory.Contains("NET Qualified"))
                };

                return Ok(counts);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching primary filter counts: {ex.Message}");
            }
        }

        [HttpGet("PhdApplications/StatusCounts")]
        public async Task<ActionResult<object>> GetPhdApplicationStatusCounts(
    [FromQuery] string? regType = null,
    [FromQuery] string? primaryFilter = null)
        {
            try
            {
                var query =
                    from s in _context.Scholars
                    join rt in _context.RegTypes on s.RegType equals rt.RegTypeID
                    join app in _context.ScholarApplicationStatuses on s.SID equals app.SID into appGroup
                    from app in appGroup.DefaultIfEmpty()
                    select new
                    {
                        Scholar = s,
                        RegTypeName = rt.RegTypeName,
                        ExemptCategory = rt.ExemptCategory,
                        ApplicationStatus = app
                    };

                // ===============================
                // STEP 1–5 COMPLETED ONLY
                // ===============================
                query = query.Where(x =>
                    x.ApplicationStatus != null &&
                    (x.ApplicationStatus.Step_1 ?? false) &&
                    (x.ApplicationStatus.Step_2 ?? false) &&
                    (x.ApplicationStatus.Step_3 ?? false) &&
                    (x.ApplicationStatus.Step_4 ?? false) &&
                    (x.ApplicationStatus.Step_5 ?? false));

                // ===============================
                // REG TYPE FILTER
                // ===============================
                if (!string.IsNullOrEmpty(regType) && regType != "all")
                {
                    query = regType switch
                    {
                        "ret_regular" => query.Where(x =>
                            x.RegTypeName.Contains("RET") &&
                            (x.ExemptCategory == null || !x.ExemptCategory.Contains("Exemption"))),

                        "ret_exemption" => query.Where(x =>
                            x.ExemptCategory != null && x.ExemptCategory.Contains("Exemption")),

                        "foreign_students" => query.Where(x =>
                            x.RegTypeName.Contains("Foreign")),

                        "part_time" => query.Where(x =>
                            x.Scholar.isPartTime == true),

                        "phd_direct" => query.Where(x =>
                            x.RegTypeName.Contains("Direct")),

                        _ => query
                    };
                }

                // ===============================
                // PRIMARY FILTER
                // ===============================
                if (!string.IsNullOrEmpty(primaryFilter) && primaryFilter != "all")
                {
                    query = primaryFilter switch
                    {
                        "ret" => query.Where(x => x.RegTypeName.Contains("RET")),
                        "net_ret_exemption" => query.Where(x =>
                            x.ExemptCategory != null && x.ExemptCategory.Contains("NET")),
                        "phd_direct" => query.Where(x =>
                            x.RegTypeName.Contains("Direct")),
                        "part_time" => query.Where(x =>
                            x.Scholar.isPartTime == true),
                        "foreign_students" => query.Where(x =>
                            x.RegTypeName.Contains("Foreign")),
                        _ => query
                    };
                }

                // ===============================
                // MATERIALIZE SCHOLARS (IGNORE SYNOPSIS)
                // ===============================
                var scholars = await query
                    .Select(x => x.Scholar)
                    .Where(s => (int)s.DecisionStatus <= 12)
                    .ToListAsync();

                // ===============================
                // CUMULATIVE STATUS COUNTS
                // ===============================
                int CountAtOrBeyond(DecisionStatus stage, params DecisionStatus[] blockedBefore)
                {
                    return scholars.Count(s =>
                        s.DecisionStatus >= stage &&
                        !blockedBefore.Contains(s.DecisionStatus));
                }

                var result = new
                {
                    Total = scholars.Count,

                    // ---- Application Stage ----
                    ApplicationScreeningPending =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.ApplicationScreeningPending),

                    ApplicationScreeningHold =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.ApplicationScreeningHold),

                    ApplicationScreeningRejected =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.ApplicationScreeningRejected),

                    ApplicationScreeningPassed_Cumulative =
        scholars.Count(s => s.DecisionStatus >= DecisionStatus.ApplicationScreeningPassed),

                    // ---- Interview Stage ----
                    InterviewScheduled =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.InterviewScheduled),

                    InterviewRejected =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.InterviewRejected),

                    InterviewApproved_Cumulative =
        scholars.Count(s => s.DecisionStatus >= DecisionStatus.InterviewApproved),

                    // ---- Counselling Stage ----
                    CounsellingScheduled =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.CounsellingScheduled),

                    CounsellingUnderReview =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.CounsellingUnderReview),

                    CounsellingRejectedFinal =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.CounsellingRejectedFinal),

                    CounsellingApprovedFinal_Cumulative =
        scholars.Count(s => s.DecisionStatus >= DecisionStatus.CounsellingApprovedFinal),

                    // ---- Coursework Stage ----
                    CourseworkRejected =
        scholars.Count(s => s.DecisionStatus == DecisionStatus.CourseworkRejected),

                    CourseworkApproved_Cumulative =
        scholars.Count(s => s.DecisionStatus >= DecisionStatus.CourseworkApproved)
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching status counts: {ex.Message}");
            }
        }

        [HttpGet("InterviewSchedulingPending")]
        public async Task<ActionResult<IEnumerable<Scholar>>> GetScholarsPendingInterviewScheduling()
        {
            try
            {
                var scholars = await _context.Scholars.Where(s => s.DecisionStatus == DecisionStatus.ApplicationScreeningPassed && s.InterviewDate == null).ToListAsync();
                return Ok(scholars);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching scholars pending interview scheduling: {ex.Message}");
            }
        }


        [HttpGet("InterviewSchedulingPending/Subjects")]
        public async Task<ActionResult<object>> GetInterviewSchedulingPending(
    [FromQuery] int? subjectId = null,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 10)
        {
            try
            {
                var baseQuery =
                    from s in _context.Scholars
                    join d in _context.Departments
                        on s.Subject_ID equals d.DepartmentID
                    join sas in _context.ScholarApplicationStatuses
                        on s.SID equals sas.SID
                    where sas.Step_5 == true
                          && s.InterviewDate == null
                    select new { s, d };

                // ===============================
                // CASE 1: subjectId = 0 → ALL
                // ===============================
                if (subjectId.HasValue && subjectId.Value == 0)
                {
                    var totalCount = await baseQuery.CountAsync();

                    var scholars = await baseQuery
                        .OrderByDescending(x => x.s.SID)
                        .Skip((page - 1) * pageSize)
                        .Take(pageSize)
                        .Select(x => new
                        {
                            x.s.SID,
                            ScholarId = x.s.ApplicationNo,
                            x.s.Name,
                            x.s.Email,
                            x.s.PhoneNumber,
                            SubjectId = x.d.DepartmentID,
                            SubjectName = x.d.Subject
                        })
                        .ToListAsync();

                    return Ok(new
                    {
                        Data = scholars,
                        Total = totalCount,
                        Page = page,
                        PageSize = pageSize
                    });
                }

                // ===============================
                // CASE 2: subjectId > 0 → SUBJECT-WISE
                // ===============================
                if (subjectId.HasValue && subjectId.Value > 0)
                {
                    var subjectQuery = baseQuery
                        .Where(x => x.s.Subject_ID == subjectId.Value);

                    var totalCount = await subjectQuery.CountAsync();

                    var scholars = await subjectQuery
                        .OrderByDescending(x => x.s.SID)
                        .Skip((page - 1) * pageSize)
                        .Take(pageSize)
                        .Select(x => new
                        {
                            x.s.SID,
                            ScholarId = x.s.ApplicationNo,
                            x.s.Name,
                            x.s.Email,
                            x.s.PhoneNumber,
                            SubjectId = x.d.DepartmentID,
                            SubjectName = x.d.Subject
                        })
                        .ToListAsync();

                    return Ok(new
                    {
                        Data = scholars,
                        Total = totalCount,
                        Page = page,
                        PageSize = pageSize
                    });
                }

                // ===============================
                // CASE 3: subjectId = null → GROUPED SUBJECTS
                // ===============================
                var subjects = await baseQuery
                    .GroupBy(x => new
                    {
                        x.d.DepartmentID,
                        x.d.Subject
                    })
                    .Select(g => new
                    {
                        DepartmentId = g.Key.DepartmentID,
                        DepartmentName = g.Key.Subject,
                        PendingCount = g.Count()
                    })
                    .ToListAsync();

                return Ok(subjects);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Error fetching interview scheduling data",
                    Error = ex.Message
                });
            }
        }




        [HttpGet("GetScholarsSubjectsforInterview")]
        public async Task<IActionResult> GetScholarsSubjectsforInterview()
        {
            var subjects = await (from sch in _context.Scholars
                                  join dept in _context.Departments
                                  on sch.Subject_ID equals dept.DepartmentID
                                  where sch.DecisionStatus == DecisionStatus.InterviewScheduled
                                  select new
                                  {
                                      dept.DepartmentID,
                                      SubjectName = dept.Subject
                                  }
                                  )
                                  .Distinct()
                                  .ToListAsync();
            if (subjects == null)
                return NotFound();
            return Ok(subjects);
        }

        [HttpGet("GetScholarsforInterview/{subjectid}")]
        public async Task<IActionResult> GetScholarsforInterview(
            int subjectid,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] int? status = null)
        {
            try
            {
                // Base query for scholars with interview-related statuses
                var query = _context.Scholars.AsQueryable();

                // Filter by subject
                if (subjectid > 0)
                {
                    query = query.Where(s => s.Subject_ID == subjectid);
                }

                // Filter by status if provided
                if (status.HasValue)
                {
                    if (status.Value == 4)
                    {
                        // Interview Scheduled only
                        query = query.Where(s => s.DecisionStatus == DecisionStatus.InterviewScheduled);
                    }
                    else if (status.Value == 6)
                    {
                        // Interview Approved / Marks Uploaded (including subsequent stages)
                        query = query.Where(s => s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected);
                    }
                    else if (status.Value == 5)
                    {
                        // Interview Rejected only
                        query = query.Where(s => s.DecisionStatus == DecisionStatus.InterviewRejected);
                    }
                    else if (status.Value >= 6)
                    {
                        query = query.Where(s => s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected);
                    }
                }
                else
                {
                    // Default: show all interview-related statuses (4, 5, 6+)
                    query = query.Where(s =>
                        s.DecisionStatus == DecisionStatus.InterviewScheduled ||
                        s.DecisionStatus == DecisionStatus.InterviewRejected ||
                        s.DecisionStatus >= DecisionStatus.InterviewApproved);
                }

                // Get total count
                var totalCount = await query.CountAsync();

                // Apply pagination
                var scholars = await query
                    .OrderByDescending(s => s.SID)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(s => new
                    {
                        s.SID,
                        ScholarId = s.ApplicationNo,
                        s.Name,
                        s.Email,
                        s.PhoneNumber,
                        s.Subject_ID,
                        s.DecisionStatus,
                        StatusText = s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected
                            ? "Marks Uploaded"
                            : GetStatusString(s.DecisionStatus),
                        s.InterviewDate
                    })
                    .ToListAsync();

                return Ok(new
                {
                    Data = scholars,
                    Total = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching scholars for interview: {ex.Message}");
            }
        }

        [HttpGet("GetScholarsforInterviewBySid/{sid}")]
        public async Task<IActionResult> GetScholarsforInterviewBySid(
    int sid,
    [FromQuery] int? status = null)
        {
            try
            {
                // Base query
                var query = _context.Scholars.AsQueryable();

                // Filter by SID
                query = query.Where(s => s.SID == sid);

                // Filter by status if provided
                if (status.HasValue)
                {
                    if (status.Value == 4)
                    {
                        query = query.Where(s => s.DecisionStatus == DecisionStatus.InterviewScheduled);
                    }
                    else if (status.Value == 6)
                    {
                        query = query.Where(s => s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected);
                    }
                    else if (status.Value == 5)
                    {
                        query = query.Where(s => s.DecisionStatus == DecisionStatus.InterviewRejected);
                    }
                    else if (status.Value >= 6)
                    {
                        query = query.Where(s => s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected);
                    }
                }
                else
                {
                    // Default: all interview-related statuses
                    query = query.Where(s =>
                        s.DecisionStatus == DecisionStatus.InterviewScheduled ||
                        s.DecisionStatus == DecisionStatus.InterviewRejected ||
                        s.DecisionStatus >= DecisionStatus.InterviewApproved);
                }

                var scholar = await query
                    .Select(s => new
                    {
                        s.SID,
                        ScholarId = s.ApplicationNo,
                        s.Name,
                        s.Email,
                        s.PhoneNumber,
                        s.Subject_ID,
                        s.DecisionStatus,
                        StatusText = s.DecisionStatus >= DecisionStatus.InterviewApproved && s.DecisionStatus != DecisionStatus.InterviewRejected
                            ? "Marks Uploaded"
                            : GetStatusString(s.DecisionStatus),
                        s.InterviewDate
                    })
                    .FirstOrDefaultAsync();

                if (scholar == null)
                {
                    return NotFound(new
                    {
                        success = false,
                        message = $"No interview-related data found for SID: {sid}"
                    });
                }

                return Ok(new
                {
                    success = true,
                    Data = scholar
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = $"Error fetching scholar for interview: {ex.Message}"
                });
            }
        }


        // GET: api/Scholars/GetScholarsSubjectsforDocumentVerification - Get subjects for document verification
        [HttpGet("GetScholarsSubjectsforDocumentVerification")]
        public async Task<IActionResult> GetScholarsSubjectsforDocumentVerification()
        {
            try
            {
                // Get all subjects/departments that have scholars with status 6 (InterviewApproved)
                var subjects = await (from s in _context.Scholars
                                      where s.DecisionStatus == DecisionStatus.InterviewApproved
                                      join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                                      group new { s, d } by new { d.DepartmentID, d.Subject } into g
                                      select new
                                      {
                                          DepartmentID = g.Key.DepartmentID,
                                          SubjectName = g.Key.Subject,
                                          Count = g.Count()
                                      })
                                    .OrderBy(x => x.SubjectName)
                                    .ToListAsync();

                return Ok(subjects);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching subjects for document verification: {ex.Message}");
            }
        }

        // GET: api/Scholars/GetScholarsforDocumentVerification/{subjectid} - Get scholars for document verification
        [HttpGet("GetScholarsforDocumentVerification/{subjectid}")]
        public async Task<IActionResult> GetScholarsforDocumentVerification(
            int subjectid,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                // Base query for scholars with status 6 (InterviewApproved)
                var query = from s in _context.Scholars
                            join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                            where s.DecisionStatus == DecisionStatus.InterviewApproved
                            select new { Scholar = s, Department = d };

                // Filter by subject
                if (subjectid > 0)
                {
                    query = query.Where(x => x.Scholar.Subject_ID == subjectid);
                }

                // Get total count
                var totalCount = await query.CountAsync();

                // Apply pagination
                var scholars = await query
                    .OrderByDescending(x => x.Scholar.SID)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(x => new
                    {
                        x.Scholar.SID,
                        ApplicationNo = x.Scholar.ApplicationNo,
                        x.Scholar.Name,
                        x.Scholar.Email,
                        x.Scholar.PhoneNumber,
                        x.Scholar.Subject_ID,
                        SubjectName = x.Department.Subject
                    })
                    .ToListAsync();

                return Ok(new
                {
                    Data = scholars,
                    Total = totalCount,
                    Page = page,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching scholars for document verification: {ex.Message}");
            }
        }




        // GET: api/Scholars/PhdApplications/AllRegTypes - Get list of all registration types
        [HttpGet("PhdApplications/AllRegTypes")]
        public async Task<ActionResult<object>> GetAllRegTypes()
        {
            try
            {
                var regTypes = await (from rt in _context.RegTypes
                                      join s in _context.Scholars on rt.RegTypeID equals s.RegType into scholars
                                      select new
                                      {
                                          RegTypeID = rt.RegTypeID,
                                          RegTypeName = rt.RegTypeName,
                                          ExemptCategory = rt.ExemptCategory,
                                          Count = scholars.Count()
                                      })
                                    .Where(x => x.Count > 0)
                                    .OrderBy(x => x.RegTypeName)
                                    .ToListAsync();

                Console.WriteLine("All Registration Types:");
                foreach (var regType in regTypes)
                {
                    Console.WriteLine($"ID: {regType.RegTypeID}, Name: {regType.RegTypeName}, ExemptCategory: {regType.ExemptCategory}, Count: {regType.Count}");
                }

                return Ok(regTypes);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching all registration types: {ex.Message}");
            }
        }

        // GET: api/Scholars/PhdApplications/RegTypeCounts
        [HttpGet("PhdApplications/RegTypeCounts")]
        public async Task<ActionResult<object>> GetPhdApplicationRegTypeCounts([FromQuery] string? primaryFilter = null)
        {
            try
            {
                Console.WriteLine($"=== RegType Counts API (Step 5 Completed Only) ===");

                // Start with scholars joined with RegTypes, Departments, and ApplicationStatus - same as main API
                var query = from s in _context.Scholars
                            join rt in _context.RegTypes on s.RegType equals rt.RegTypeID
                            join appStatus in _context.ScholarApplicationStatuses on s.SID equals appStatus.SID into appStatusGroup
                            from appStatus in appStatusGroup.DefaultIfEmpty()
                            select new
                            {
                                Scholar = s,
                                RegTypeID = rt.RegTypeID,
                                RegTypeName = rt.RegTypeName,
                                ExemptCategory = rt.ExemptCategory,
                                ApplicationStatus = appStatus
                            };

                Console.WriteLine($"Initial query count: {await query.CountAsync()}");

                // Always filter by step completion (same as main API)
                Console.WriteLine("Filtering for applications with completed steps 1-5 (ready for review)");
                query = query.Where(x => x.ApplicationStatus != null &&
                                       (x.ApplicationStatus.Step_1 ?? false) &&
                                       (x.ApplicationStatus.Step_2 ?? false) &&
                                       (x.ApplicationStatus.Step_3 ?? false) &&
                                       (x.ApplicationStatus.Step_4 ?? false) &&
                                       (x.ApplicationStatus.Step_5 ?? false));

                Console.WriteLine($"After step 1-5 completion filter count: {await query.CountAsync()}");

                var scholars = await query.ToListAsync();
                var total = scholars.Count;

                Console.WriteLine($"=== RegType Analysis (Step 5 Complete Only) ===");
                Console.WriteLine($"Total step-5-completed scholars: {total}");

                // Debug: Show all unique registration types and exemption categories
                var uniqueRegTypes = scholars.Select(s => s.RegTypeName).Distinct().ToList();
                var uniqueExemptCategories = scholars.Where(s => s.ExemptCategory != null).Select(s => s.ExemptCategory).Distinct().ToList();

                Console.WriteLine("Unique Registration Types (Step 5 Complete):");
                foreach (var regType in uniqueRegTypes)
                {
                    var count = scholars.Count(s => s.RegTypeName == regType);
                    Console.WriteLine($"  - '{regType}' ({count} scholars)");
                }

                Console.WriteLine("Unique Exemption Categories (Step 5 Complete):");
                foreach (var exemptCat in uniqueExemptCategories)
                {
                    var count = scholars.Count(s => s.ExemptCategory == exemptCat);
                    Console.WriteLine($"  - '{exemptCat}' ({count} scholars)");
                }

                // Create result with all 6 specific filters requested - ALWAYS show all filters
                var result = new List<object>
                {
                    new { id = "all", name = "All Applications", count = total }
                };

                // 1. Research Entrance Test (RET) - Regular RET applications
                var retRegularCount = scholars.Count(s =>
                    (s.RegTypeName.Contains("Research Entrance Test") || s.RegTypeName.Contains("RET")) &&
                    !(s.ExemptCategory != null && s.ExemptCategory.Contains("Exemption")));
                Console.WriteLine($"Research Entrance Test (RET) count: {retRegularCount}");
                result.Add(new { id = "ret_regular", name = "Research Entrance Test (RET)", count = retRegularCount });

                // 2. Exemption from Entrance Test (RET) - RET exemption applications
                var retExemptionCount = scholars.Count(s =>
                    s.ExemptCategory != null && s.ExemptCategory.Contains("Exemption") &&
                    (s.RegTypeName.Contains("RET") || s.ExemptCategory.Contains("RET")));
                Console.WriteLine($"Exemption from Entrance Test (RET) count: {retExemptionCount}");
                result.Add(new { id = "ret_exemption", name = "Exemption from Entrance Test (RET)", count = retExemptionCount });

                // 3. Ph.D. Admission for Foreign Students - All foreign students (combined)
                var foreignStudentsCount = scholars.Count(s =>
                    s.RegTypeName.Contains("Ph.D. Admission for Foreign Students") ||
                    s.RegTypeName.Contains("Ph.D. For Foreign Students") ||
                    s.RegTypeName.Contains("Foreign"));
                Console.WriteLine($"Ph.D. Admission for Foreign Students count: {foreignStudentsCount}");
                result.Add(new { id = "foreign_students", name = "Ph.D. Admission for Foreign Students", count = foreignStudentsCount });

                // 4. Part Time Ph.D - Part-time applications
                var partTimeCount = scholars.Count(s =>
                    s.Scholar.isPartTime == true || s.RegTypeName.Contains("Part Time"));
                Console.WriteLine($"Part Time Ph.D count: {partTimeCount}");
                result.Add(new { id = "part_time", name = "Part Time Ph.D", count = partTimeCount });

                // 5. Ph.D. Direct Admission - Direct admission applications
                var directAdmissionCount = scholars.Count(s =>
                    s.RegTypeName.Contains("Direct") || s.RegTypeName.Contains("Ph.D. Direct"));
                Console.WriteLine($"Ph.D. Direct Admission count: {directAdmissionCount}");
                result.Add(new { id = "phd_direct", name = "Ph.D. Direct Admission", count = directAdmissionCount });

                Console.WriteLine($"RegType API returning {result.Count} items (Step 5 Complete Only)");
                foreach (var item in result)
                {
                    Console.WriteLine($"RegType: {item}");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching registration type counts: {ex.Message}");
            }
        }

        private bool IsMatchedBySpecificCategory(string regTypeName, dynamic scholarData)
        {
            // Check if this registration type is already covered by our specific categories
            if (regTypeName.Contains("RET") || regTypeName.Contains("Research Entrance Test")) return true;
            if (regTypeName.Contains("Direct") || regTypeName.Contains("Ph.D. Direct")) return true;
            if (regTypeName.Contains("Foreign")) return true;

            return false;
        }

        //private static string GetStatusString(DecisionStatus decisionStatus)
        //{
        //    int statusValue = (int)decisionStatus;

        //    // Simplified 3-status system
        //    if (statusValue == 2) return "rejected";           // Status 2 = Rejected
        //    if (statusValue >= 3) return "accepted";           // Status >= 3 = Accepted  
        //    return "pending";                                  // Status < 2 (0, 1) = Pending
        //}

        // GET: api/Scholars/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Scholar>> GetScholar(int id)
        {
            var scholar = await _context.Scholars.FindAsync(id);

            if (scholar == null)
            {
                return NotFound();
            }

            return scholar;
        }

        // PUT: api/Scholars/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholar(int id, Scholar scholar)
        {
            if (id != scholar.SID)
            {
                return BadRequest();
            }

            _context.Entry(scholar).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarExists(id))
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

        [HttpPost("SendEmailOtp")]
        public async Task<ActionResult<object>> SendEmailOtp([FromBody] string email)
        {
            OtpService otpService = new OtpService(6, TimeSpan.FromMinutes(10));
            var otpobject = otpService.GenerateOtp();
            var body = $"Your OTP for email verification is: <strong>{otpobject.otp}</strong>. This OTP is valid for 10 minutes.";
            string result = _emailService.SendEmail(email, "Email Verification OTP", body);
            Console.Write(result);
            return Ok(otpobject);
        }

        [HttpPost]
        public async Task<ActionResult<Scholar>> PostScholar([FromBody] Scholar scholar)
        {
            if (scholar == null)
                return BadRequest("Scholar data is null.");
            try
            {
                bool exists = await _context.SupervisorRegistrations
          .AnyAsync(s => (s.SupId == scholar.SID && s.MobileNo == scholar.PhoneNumber) ||
                         (s.SupId == scholar.SID && s.Email == scholar.Email));

                if (exists)
                {
                    return Conflict(new
                    {
                        message = "A record with the same MobileNo or Email already exists."
                    });
                }
                var verification = await _context.VerificationRequests
          .FirstOrDefaultAsync(v =>
          v.Email == scholar.Email &&
          v.MobileNo == scholar.PhoneNumber &&
          v.IsVerified == true);

                if (verification == null)
                {
                    return BadRequest("Email and phone not verified.");
                }

                _context.Scholars.Add(scholar);
                await _context.SaveChangesAsync();

                // =========================
                // Year handling
                // =========================
                int currentYear = DateTime.Now.Year;
                scholar.Year ??= $"{currentYear}-{currentYear + 1}";

                // =========================
                // Application Number Logic
                // =========================
                string yearPrefix = DateTime.Now.ToString("yy");

                var lastAppNo = await _context.Scholars
                    .Where(s => s.ApplicationNo.StartsWith(yearPrefix))
                    .OrderByDescending(s => s.ApplicationNo)
                    .Select(s => s.ApplicationNo)
                    .FirstOrDefaultAsync();

                int nextSerial = string.IsNullOrEmpty(lastAppNo)
                    ? 1
                    : int.Parse(lastAppNo.Substring(2)) + 1;

                scholar.ApplicationNo = $"{yearPrefix}{nextSerial:D6}";

                await _context.SaveChangesAsync();

                // =========================
                // Auth + Email
                // =========================
                string password = Passwordgen.GeneratePassword();

                _context.ScholarAuths.Add(new ScholarAuth
                {
                    SID = scholar.SID,
                    TempPassword = password,
                    isTempAutoGen = true
                });
                _context.VerificationRequests.Remove(verification);
                await _context.SaveChangesAsync();

                var tokens = new Dictionary<string, string>
    {
        { "name", scholar.Name },
        { "regno", scholar.ApplicationNo },
        { "pwd", password }
    };

                var (subject, body) = await _emailTemplateService.RenderAsync(1006, tokens);
                _emailService.SendEmail(scholar.Email, subject, body);

                return CreatedAtAction("GetScholar", new { id = scholar.SID }, scholar);
            }
            catch (DbUpdateException dbEx)
            {
                // Handle database unique constraints or other EF Core update exceptions
                return Conflict(new { message = "Possibly a duplicate record.", details = dbEx.Message });
            }
            catch (Exception ex)
            {
                // Catch any other unexpected exceptions
                return StatusCode(500, new { message = "An unexpected error occurred.", details = ex.Message });
            }
        }

            // POST: api/Scholars/SendForReview/{id}
            [HttpPost("SendForReview/{id}")]
        public async Task<IActionResult> SendApplicationForReview(int id)
        {
            try
            {
                Console.WriteLine($"=== Send for Review API Called ===");
                Console.WriteLine($"Scholar ID: {id}");

                // Get scholar and application status
                var scholar = await _context.Scholars.FindAsync(id);
                if (scholar == null)
                {
                    Console.WriteLine($"Scholar not found for ID: {id}");
                    return NotFound("Scholar not found");
                }

                var applicationStatus = await _context.ScholarApplicationStatuses
                    .FirstOrDefaultAsync(s => s.SID == id);

                if (applicationStatus == null)
                {
                    Console.WriteLine($"Application status not found for Scholar ID: {id}");
                    return BadRequest("Application status not found. Please complete the application first.");
                }

                Console.WriteLine($"Application Status - Step1: {applicationStatus.Step_1}, Step2: {applicationStatus.Step_2}, Step3: {applicationStatus.Step_3}, Step4: {applicationStatus.Step_4}, Step5: {applicationStatus.Step_5}");

                // Validate that steps 1-5 are completed
                if (!(applicationStatus.Step_1 ?? false) ||
                    !(applicationStatus.Step_2 ?? false) ||
                    !(applicationStatus.Step_3 ?? false) ||
                    !(applicationStatus.Step_4 ?? false) ||
                    !(applicationStatus.Step_5 ?? false))
                {
                    var missingSteps = new List<string>();
                    if (!(applicationStatus.Step_1 ?? false)) missingSteps.Add("Step 1");
                    if (!(applicationStatus.Step_2 ?? false)) missingSteps.Add("Step 2");
                    if (!(applicationStatus.Step_3 ?? false)) missingSteps.Add("Step 3");
                    if (!(applicationStatus.Step_4 ?? false)) missingSteps.Add("Step 4");
                    if (!(applicationStatus.Step_5 ?? false)) missingSteps.Add("Step 5");

                    Console.WriteLine($"Missing steps: {string.Join(", ", missingSteps)}");
                    return BadRequest($"Cannot send for review. Missing steps: {string.Join(", ", missingSteps)}");
                }

                // Update scholar status to indicate it's sent for review
                scholar.DecisionStatus = DecisionStatus.ApplicationScreeningHold;
                scholar.DecisionUpdateTime = DateTime.Now;
                scholar.RejectReason = "Application sent for review - all required steps completed";

                await _context.SaveChangesAsync();

                Console.WriteLine($"Application successfully sent for review. Scholar ID: {id}");

                return Ok(new
                {
                    message = "Application successfully sent for review",
                    scholarId = scholar.SID,
                    applicationNo = scholar.ApplicationNo,
                    status = "Under Review"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending application for review: {ex.Message}");
                return BadRequest($"Error sending application for review: {ex.Message}");
            }
        }

        [HttpGet("GetDistinctYears")]
        public async Task<ActionResult<IEnumerable<string>>> GetDistinctYears()
        {
            var years = await _context.Scholars
                .Select(s => s.Year)
                .Distinct()
                .ToListAsync();
            return Ok(years);
        }

        [HttpGet("GetCourseworkScholarsByYear/{year}")]
        public async Task<ActionResult<IEnumerable<dynamic>>> GetScholarsByYear(string year, int decisionnumber)
        {
            var decisionStatus = (CourseWorkDecisions)decisionnumber;
            var scholars = await _context.Scholars
                .Where(s => s.Year == year && s.CourseWorkStatus == decisionStatus)
                .Select(s => new
                {
                    s.SID,
                    s.Name,
                    s.FName,
                    s.PhoneNumber,
                    s.Email,
                    s.ApplicationNo,
                    s.Year,
                    s.CourseWorkStatus,
                    s.CourseWorkRejectReason,
                    ShodhanikId = _context.ScholarAuths
                        .Where(sa => sa.SID == s.SID)
                        .Select(sa => sa.PermUserName)
                        .FirstOrDefault() ?? s.SID.ToString()
                })
                .ToListAsync();
            return Ok(scholars);
        }


        [HttpPatch("{sid}")]
        public async Task<IActionResult> PatchScholar(
    int sid,
    [FromBody] ScholarPatchRequest request)
        {
            var scholar = await _context.Scholars.FindAsync(sid);
            if (scholar == null)
                return NotFound("Scholar not found.");

            // -------------------------
            // Basic Fields
            // -------------------------
            if (request.Name != null)
                scholar.Name = request.Name;

            if (request.FName != null)
                scholar.FName = request.FName;

            if (request.PhoneNumber != null)
                scholar.PhoneNumber = request.PhoneNumber;

            if (request.Email != null)
                scholar.Email = request.Email;

            if (request.Subject_ID.HasValue)
                scholar.Subject_ID = request.Subject_ID.Value;

            if (request.RegType.HasValue)
                scholar.RegType = request.RegType.Value;

            if (request.ExemptionType.HasValue)
                scholar.ExemptionType = request.ExemptionType;

            if (request.ApplicationNo != null)
                scholar.ApplicationNo = request.ApplicationNo;

            if (request.Year != null)
                scholar.Year = request.Year;

            if (request.isPartTime.HasValue)
                scholar.isPartTime = request.isPartTime.Value;

            if (request.InterviewMarks.HasValue)
            {
                if (request.InterviewMarks < 0 || request.InterviewMarks > 100)
                    return BadRequest("Interview marks must be between 0 and 100.");

                scholar.InterviewMarks = request.InterviewMarks.Value;
            }



            // -------------------------
            // Decision Status Handling
            // -------------------------
            if (request.DecisionStatus.HasValue)
            {
                var decision = request.DecisionStatus.Value;

                if (!Enum.IsDefined(typeof(DecisionStatus), decision))
                {
                    return BadRequest("Invalid decision status.");
                }

                bool reasonRequired =
        decision == DecisionStatus.ApplicationScreeningHold ||
        decision == DecisionStatus.ApplicationScreeningRejected ||
        decision == DecisionStatus.ApplicationScreeningHold ||
        decision == DecisionStatus.ApplicationScreeningRejected ||
        decision == DecisionStatus.InterviewRejected ||
        decision == DecisionStatus.CounsellingUnderReview ||
        decision == DecisionStatus.CounsellingRejectedFinal;

                if (reasonRequired && string.IsNullOrWhiteSpace(request.RejectReason))
                {
                    return BadRequest("Reject/Review reason is mandatory for this decision state.");
                }

                if (decision == DecisionStatus.ApplicationScreeningPassed)
                {
                    var sap = await _context.ScholarApplicationStatuses
    .FirstOrDefaultAsync(s => s.SID == scholar.SID);

                    sap.Step_7 = true;
                    sap.Step_7At = GetISTNow(); // ✅ API time only

                }

                scholar.DecisionStatus = decision;
                if (decision == DecisionStatus.InterviewScheduled)
                {
                    if (!request.InterviewDate.HasValue)
                        return BadRequest("Interview date is required.");

                    // Store scheduled interview datetime (from UI)
                    scholar.InterviewDate = request.InterviewDate.Value;

                    // API-generated timestamp
                    var nowIST = GetISTNow();

                    var department = await _context.Departments
                        .Where(d => d.DepartmentID == scholar.Subject_ID)
                        .Select(d => d.Subject)
                        .FirstOrDefaultAsync() ?? "";

                    var regTypeName = await _context.RegTypes
                        .Where(r => r.RegTypeID == scholar.RegType)
                        .Select(r => r.RegTypeName)
                        .FirstOrDefaultAsync() ?? "";

                    var interviewDateStr = scholar.InterviewDate.Value.ToString("dd-MM-yyyy");
                    var interviewTimeStr = scholar.InterviewDate.Value.ToString("hh:mm tt");

                    var tokens = new Dictionary<string, string>
                    {
                        { "date", nowIST.ToString("dd-MM-yyyy") }, // ✅ API TIME
                        { "name", scholar.Name ?? "" },
                        { "appl_no", scholar.ApplicationNo ?? "" },
                        { "appl_id", scholar.ApplicationNo ?? "" },
                        { "subject", department },
                        { "department", department },
                        { "venue", department },
                        { "iwdate", interviewDateStr },
                        { "time", interviewTimeStr },
                        { "appl_type", regTypeName },
                        { "univ_name", "Chaudhary Charan Singh University, Meerut" }
                    };

                    var (subject, body) = await _emailTemplateService.RenderAsync(1013, tokens);
                    _emailService.SendEmail(scholar.Email, subject, body);
                }


                if (decision == DecisionStatus.CounsellingApprovedFinal)
                {
                    var sa = await _context.ScholarAuths
                        .FirstOrDefaultAsync(s => s.SID == scholar.SID);

                    if (sa != null)
                    {
                        sa.PermUserName = "SH" + scholar.ApplicationNo;
                        sa.PermPassword = Passwordgen.GeneratePassword();
                        sa.isPermAutoGen = true;

                        var tokens = new Dictionary<string, string>
                        {
                            { "name", scholar.Name },
                            { "uname", sa.PermUserName },
                            { "pwd", sa.PermPassword }
                        };

                        var (subject, body) = await _emailTemplateService.RenderAsync(1016, tokens);
                        _emailService.SendEmail(scholar.Email, subject, body);
                    }
                }
                scholar.RejectReason = reasonRequired ? request.RejectReason : null;
            }

            scholar.DecisionUpdateTime = GetISTNow();


            // -------------------------
            // Coursework Handling
            // -------------------------
            if (request.CourseWorkStatus.HasValue)
            {
                // 1 = Complete, 2 = Review, 3 = Rejected
                if ((request.CourseWorkStatus == 2 || request.CourseWorkStatus == 3)
                    && string.IsNullOrWhiteSpace(request.CourseWorkRejectReason))
                {
                    return BadRequest("Coursework review/rejection reason is required.");
                }
                var decision = (CourseWorkDecisions)request.CourseWorkStatus.Value;
                scholar.CourseWorkStatus = decision;
                scholar.CourseWorkRejectReason =
                    request.CourseWorkStatus == 2 || request.CourseWorkStatus == 3
                        ? request.CourseWorkRejectReason
                        : null;
            }

            if (request.InterviewDate.HasValue)
                scholar.InterviewDate = request.InterviewDate.Value;

            // -------------------------
            // Save Changes
            // -------------------------
            await _context.SaveChangesAsync();

            return NoContent();
        }


        private static DateTime GetISTNow()
        {
            var istTimeZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTimeZone);
        }


        [HttpGet("ApplicationStatus/{id}")]
        public async Task<IActionResult> GetApplicationStatusByID(int id)
        {
            var scholar = await _context.Scholars.FindAsync(id);
            if (scholar == null)
                return NotFound();
            var applicationStatus = await _context.ScholarApplicationStatuses.FirstOrDefaultAsync(s => s.SID == scholar.SID);
            if (applicationStatus == null)
                return NotFound();
            //bool ret = false;
            //if (scholar.RegType == 1)
            //{
            //    ret = true;
            //}
            string interviewStatus = "Pending";
            if (scholar.DecisionStatus >= DecisionStatus.InterviewApproved)
            {
                interviewStatus = "Interview completed successfully and approved.";
            }
            else if (scholar.DecisionStatus == DecisionStatus.InterviewRejected)
            {
                interviewStatus = "Rejected in Interview";
            }


            string status = GetStatusHelp(scholar.DecisionStatus);
            var result = new
            {
                FormStatus = "Successfully Submitted",
                FormSubmitDate = applicationStatus.Step_1At,
                InterviewDate = scholar.InterviewDate,
                InterviewResult = interviewStatus
            };
            return Ok(result);
        }

        /* [HttpGet("PreviewAllDetails/{id}")]
         public async Task<ActionResult<object>> GetAllScholarsDetails(int id)
         {
             var scholar = await _context.Scholars
                 .AsNoTracking()
                 .FirstOrDefaultAsync(s => s.SID == id);
             if (scholar == null)
                 return NotFound("User Not Found");
             var subject = await _context.Departments
                 .AsNoTracking()
                 .FirstOrDefaultAsync(d => d.DepartmentID == scholar.Subject_ID);
             if (subject == null)
                 return NotFound("Subject Not Chosen");

             var personal = await _context.ScholarPersonalDetails
                 .AsNoTracking()
                 .FirstOrDefaultAsync(sp => sp.SID == id);
             if (personal == null)
                 return NotFound("Personal Details Not Filled");
             var academics = await _context.ScholarAcademicQualifications
                 .AsNoTracking()
                 .Where(saq => saq.SID == id)
                 .ToListAsync();
             if (academics == null)
                 return NotFound("Academic Qualifications not Filled");

             // Get uploads with document names from DocumentMaster table
             var uploads = await (from su in _context.ScholarUploads
                                  join dm in _context.DocumentMasters on su.DocumentMasterID equals dm.DocumentMasterID
                                  where su.SID == id
                                  select new
                                  {
                                      su.ScholarUploadID,
                                      su.SID,
                                      su.DocumentMasterID,
                                      su.Path,
                                      su.DecisionStatus,
                                      DocumentName = dm.DocumentName
                                  })
                                .AsNoTracking()
                                .ToListAsync();

             if (uploads == null)
                 return NotFound("Not Uploaded Documents");

             var result = new
             {
                 Scholar = scholar,
                 Subject = subject.Subject,
                 PersonalDetails = personal,
                 AcademicQualifications = academics,
                 Uploads = uploads
             };

             return Ok(result);
         }
 */

        [HttpGet("PreviewAllDetails/{id}")]
        public async Task<ActionResult<object>> GetAllScholarsDetails(int id)
        {
            // =========================
            // SCHOLAR (WITH SUBJECT & REGTYPE)
            // =========================
            var scholar = await
                (from s in _context.Scholars.AsNoTracking()
                 join d in _context.Departments.AsNoTracking()
                     on s.Subject_ID equals d.DepartmentID
                 join rt in _context.RegTypes.AsNoTracking()
                     on s.RegType equals rt.RegTypeID
                 where s.SID == id
                 select new
                 {
                     s.SID,
                     s.Name,
                     s.Email,
                     s.Subject_ID,
                     s.RegType,

                     // Embedded values
                     SubjectName = d.Subject,
                     RegTypeName = rt.RegTypeName,

                     // include other Scholar fields as needed
                 })
                .FirstOrDefaultAsync();

            if (scholar == null)
                return NotFound("User Not Found / Subject / Registration Type Missing");

            // =========================
            // PERSONAL DETAILS
            // =========================
            var personal = await _context.ScholarPersonalDetails
                .AsNoTracking()
                .FirstOrDefaultAsync(sp => sp.SID == id);

            if (personal == null)
                return NotFound("Personal Details Not Filled");

            // =========================
            // ACADEMICS
            // =========================
            var academics = await _context.ScholarAcademicQualifications
                .AsNoTracking()
                .Where(saq => saq.SID == id)
                .ToListAsync();

            if (!academics.Any())
                return NotFound("Academic Qualifications not Filled");

            // =========================
            // UPLOADS
            // =========================
            var uploads = await
                (from su in _context.ScholarUploads.AsNoTracking()
                 join dm in _context.DocumentMasters.AsNoTracking()
                     on su.DocumentMasterID equals dm.DocumentMasterID
                 where su.SID == id
                 select new
                 {
                     su.ScholarUploadID,
                     su.SID,
                     su.DocumentMasterID,
                     su.Path,
                     su.DecisionStatus,
                     DocumentName = dm.DocumentName
                 })
                .ToListAsync();

            if (!uploads.Any())
                return NotFound("Not Uploaded Documents");

            // =========================
            // FINAL RESPONSE
            // =========================
            var result = new
            {
                Scholar = scholar,   // Subject & RegType included here
                PersonalDetails = personal,
                AcademicQualifications = academics,
                Uploads = uploads
            };

            return Ok(result);
        }

        [HttpGet("Profile/{id}")]
        public async Task<ActionResult<object>> Profile(int id)
        {
            var scholar = await _context.Scholars
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SID == id);
            if (scholar == null)
                return NotFound("User Not Found");
            var subject = await _context.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.DepartmentID == scholar.Subject_ID);
            //if (subject == null)
            //    return NotFound("Subject Not Chosen");
            var sauth = await _context.ScholarAuths
                .AsNoTracking()
                .FirstOrDefaultAsync(sa => sa.SID == id);
            //if (sauth == null)
            //    return NotFound("Auth Not Found");
            var personal = await _context.ScholarPersonalDetails
                .AsNoTracking()
                .FirstOrDefaultAsync(sp => sp.SID == id);
            //if (personal == null)
            //    return NotFound("Personal Details Not Filled");
            var sup = await _context.ScholarSupervisors
                .AsNoTracking()
                .Where(ss => ss.SID == id)
                .FirstOrDefaultAsync();
            //if (sup == null)
            //    return NotFound("No Supervisor is Selected");
            var supervisor1 = await _context.SupervisorRegistrations.FindAsync(sup?.SUPID1);
            //if (supervisor1 == null)
            //    return NotFound("Supervisor1 not Found");
            var supervisor2 = await _context.SupervisorRegistrations.FindAsync(sup?.SUPID2);
            //if (supervisor2 == null)
            //    return NotFound("Supervisor2 not Found");
            var uploads = await _context.ScholarUploads
                .Where(su => su.SID == id)
                .ToListAsync();
            if (uploads == null)
                return NotFound("Uploads not Found");
            int regtype = scholar.RegType;
            var regtypename = await _context.RegTypes.FindAsync(regtype);
            var result = new
            {
                AdmissionYear = scholar?.Year,
                ShodhanikID = sauth?.PermUserName,
                Subject = subject?.Subject,

                Supervisor1Name = supervisor1?.FullName,
                Supervisor2Name = supervisor2?.FullName,

                ScholarName = scholar?.Name,
                MobileNo = scholar?.PhoneNumber,
                EmailID = scholar?.Email,

                CorrespondanceAddress = personal == null
        ? null
        : $"{personal.CorrespondenceAddress} {personal.CState} {personal.CDistrict} {personal.CPincode}",

                PermanentAddress = personal == null
        ? null
        : $"{personal.PermanentAddress} {personal.PState} {personal.PDistrict} {personal.PPinCode}",

                ProfilePicture = uploads?
        .FirstOrDefault(u => u.DocumentMasterID == 1)?.Path,

                Signature = uploads?
        .FirstOrDefault(u => u.DocumentMasterID == 2)?.Path,

                Regtype = regtypename?.RegTypeName, // ⚠️ return a FIELD, not entity
                ExemptionCategory = regtypename?.ExemptCategory,

                Uploads = uploads ?? new List<ScholarUpload>()
            };

            return Ok(result);
        }


        // DELETE: api/Scholars/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholar(int id)
        {
            var scholar = await _context.Scholars.FindAsync(id);
            if (scholar == null)
            {
                return NotFound();
            }

            _context.Scholars.Remove(scholar);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ScholarExists(int id)
        {
            return _context.Scholars.Any(e => e.SID == id);
        }

        private string GetStatusHelp(DecisionStatus status)
        {
            return status switch
            {
                DecisionStatus.ApplicationScreeningPending =>
                    "Application is pending initial screening.",

                DecisionStatus.ApplicationScreeningHold =>
                    "Application is on hold during screening.",

                DecisionStatus.ApplicationScreeningRejected =>
                    "Application has been rejected during screening.",

                DecisionStatus.ApplicationScreeningPassed =>
                    "Application has successfully passed screening.",

                DecisionStatus.InterviewScheduled =>
                    "Interview has been scheduled.",

                DecisionStatus.InterviewRejected =>
                    "Application was rejected after interview.",

                DecisionStatus.InterviewApproved =>
                    "Interview completed successfully and approved.",

                DecisionStatus.CounsellingScheduled =>
                    "Counselling session has been scheduled.",

                DecisionStatus.CounsellingUnderReview =>
                    "Counselling decision is under review.",

                DecisionStatus.CounsellingRejectedFinal =>
                    "Application has been rejected after counselling.",

                DecisionStatus.CounsellingApprovedFinal =>
                    "Application has been finally approved after counselling.",

                DecisionStatus.CourseworkRejected =>
                    "Coursework submission has been rejected.",

                DecisionStatus.CourseworkApproved =>
                    "Coursework submission has been approved.",

                DecisionStatus.SysnopsisSubmitted =>
                    "Synopsis has been submitted and is under review.",

                DecisionStatus.SysnopsisApproved =>
                    "Synopsis has been approved.",

                DecisionStatus.SysnopsisRejected =>
                    "Synopsis has been rejected.",

                _ => "Unknown status."
            };
        }

    }

    public class ApproveRequest
    {
        public int Decision { get; set; }
        public string? RejectReason { get; set; }
    }

    public class ScholarPatchRequest
    {
        public string? Name { get; set; }
        public string? FName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }

        public int? Subject_ID { get; set; }
        public int? RegType { get; set; }
        public int? ExemptionType { get; set; }

        [EnumDataType(typeof(DecisionStatus), ErrorMessage = "Invalid decision status.")]
        public DecisionStatus? DecisionStatus { get; set; }

        public DateTime? DecisionUpdateTime { get; set; }

        public string? ApplicationNo { get; set; }
        public string? Year { get; set; }

        public string? RejectReason { get; set; }

        public int? CourseWorkStatus { get; set; } // 1=complete, 2=review, 3=rejected
        public string? CourseWorkRejectReason { get; set; }

        public bool? isPartTime { get; set; }

        public DateTime? InterviewDate { get; set; }
        public decimal? InterviewMarks { get; set; }


    }
}
