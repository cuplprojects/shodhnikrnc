using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NPOI.OpenXmlFormats.Dml;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CourseWorkController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorage;

        public CourseWorkController(RMSDbContext context, IFileStorageService fileStorage)
        {
            _context = context;
            _fileStorage = fileStorage;
        }

        // GET: api/CourseWork
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CourseWork>>> GetCourseWorks()
        {
            return await _context.CourseWorks.ToListAsync();
        }

        // GET: api/CourseWork/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CourseWork>> GetCourseWork(int id)
        {
            var courseWork = await _context.CourseWorks.FindAsync(id);

            if (courseWork == null)
            {
                return NotFound();
            }

            return courseWork;
        }

        [HttpGet("BySid/{sid}")]
        public async Task<ActionResult<object>> GetCourseWorkBySid(int sid)
        {
            var scholar = await _context.Scholars
                .FirstOrDefaultAsync(s => s.SID == sid);

            var courseWork = await _context.CourseWorks
                .FirstOrDefaultAsync(cw => cw.SID == sid);
            if (courseWork == null)
            {
                return NotFound();
            }
            return new
            {
                EnrollmentNumber = scholar != null ? scholar.ApplicationNo : null,
                RollNumber = scholar != null ? scholar.RollNumber : null,  
                CourseWork = courseWork
            };
        }

        [HttpPost("temp")]
        public async Task<IActionResult> TempPost([FromForm]CourseWorkDTO couseworkDTO)
        {
            var scholar = await _context.Scholars
                .FirstOrDefaultAsync(s => s.SID == couseworkDTO.SID);
            if (scholar == null)
            {
                return NotFound("Scholar not found.");
            }
            CourseWork courseWork = new CourseWork
            {
                SID = couseworkDTO.SID

            };
            if (couseworkDTO.MarksheetFile != null)
            {
                var filePath = await _fileStorage.SaveAsync(
                    couseworkDTO.MarksheetFile,
                    subFolder: "course-work",
                    filePrefix: $"CW_{couseworkDTO.SID}"
                );
                courseWork.CourseWorkFilePath = filePath;
                var istTimeZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                courseWork.UploadDate= TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTimeZone);
            }
            scholar.RollNumber = couseworkDTO.RollNumber;
            scholar.CourseWorkStatus = CourseWorkDecisions.CourseworkPending;
            _context.CourseWorks.Add(courseWork);
            await _context.SaveChangesAsync();
            return Ok(courseWork);
        }

        // PUT: api/CourseWork/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCourseWork(int id, CourseWork courseWork)
        {
            if (id != courseWork.CWID)
            {
                return BadRequest();
            }

            _context.Entry(courseWork).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CourseWorkExists(id))
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

        // POST: api/CourseWork
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<CourseWork>> PostCourseWork(
    [FromForm] CourseWorkCreateRequest request)
        {
            if (request == null)
                return BadRequest("Invalid CourseWork data.");

            string? filePath = null;

            // ============================
            // File Upload via Service
            // ============================
            if (request.CourseWorkFile != null)
            {
                filePath = await _fileStorage.SaveAsync(
                    request.CourseWorkFile,
                    subFolder: "course-work",
                    filePrefix: $"CW_{request.SID}"
                );
            }

            var courseWork = new CourseWork
            {
                SID = request.SID,
                CourseWorkFilePath = filePath,
                CourseWorkResult = (CourseWorkDecisions) request.CourseWorkResult,
                CourseWorkRemark = request.CourseWorkRemark,
                CourseWorkStatus = request.CourseWorkStatus,
                ApprovedAt = null
            };

            _context.CourseWorks.Add(courseWork);
            var scholar = await _context.Scholars
                .FirstOrDefaultAsync(s => s.SID == request.SID);
            if (scholar == null)
            {
                return NotFound("Scholar not found.");
            }
            scholar.CourseWorkStatus = CourseWorkDecisions.CourseworkPending;
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetCourseWork),
                new { id = courseWork.CWID },
                courseWork
            );
        }

        /* [HttpPatch("{id}")]
         public async Task<IActionResult> PatchCourseWork(
         int id,
         [FromForm] CourseWorkPatchRequest request)
         {
             var courseWork = await _context.CourseWorks.FindAsync(id);

             if (courseWork == null)
                 return NotFound($"CourseWork with ID {id} not found.");

             // ============================
             // File Replace / Upload
             // ============================
             if (request.MarksheetFile != null)
             {
                 if (!string.IsNullOrWhiteSpace(courseWork.CourseWorkFilePath))
                 {
                     await _fileStorage.OverwriteAsync(
                         request.MarksheetFile,
                         courseWork.CourseWorkFilePath
                     );
                 }
                 else
                 {
                     courseWork.CourseWorkFilePath = await _fileStorage.SaveAsync(
                         request.MarksheetFile,
                         subFolder: "course-work",
                         filePrefix: $"CW_{courseWork.SID}"
                     );
                 }
             }
             var previousResult = courseWork.CourseWorkResult;
             // ============================
             // Partial Scalar Updates
             // ============================
             if (request.CourseWorkResult != null)
                 courseWork.CourseWorkResult = request.CourseWorkResult;

             if (request.CourseWorkRemark != null)
                 courseWork.CourseWorkRemark = request.CourseWorkRemark;

             if (request.CourseWorkStatus != null)
                 courseWork.CourseWorkStatus = request.CourseWorkStatus;

             if (request.ApprovedAt.HasValue)
                 courseWork.ApprovedAt = request.ApprovedAt;

             // ============================
             // Coursework Approved → Payment Entry
             // ============================
             if (courseWork.CourseWorkResult == CourseWorkDecisions.CourseworkApproved)
             {
                 var scholar = await _context.Scholars
                     .FirstOrDefaultAsync(s => s.SID == courseWork.SID);

                 if (scholar == null)
                     return NotFound("Scholar not found.");

                 scholar.CourseWorkStatus = CourseWorkDecisions.CourseworkApproved;

                 // ---- Scholar Category ----
                 var categoryRaw = await _context.ScholarPersonalDetails
                     .Where(x => x.SID == courseWork.SID)
                     .Select(x => x.Category)
                     .FirstOrDefaultAsync();

                 if (!string.IsNullOrWhiteSpace(categoryRaw))
                 {
                     var category = categoryRaw.Trim().ToLower();
                     bool isUROBC = category == "general" || category == "obc";
                     bool isSCST = category == "sc" || category == "st";

                     if (isUROBC || isSCST)
                     {
                         string feeCategoryName = isUROBC
                             ? "Scholar Pre Ph.D Coursework Fee(UR/OBC)"
                             : "Scholar Pre Ph.D Coursework Fee(SC/ST)";

                         var feeCategory = await _context.FeeCategories
                             .FirstOrDefaultAsync(f => f.CategoryName == feeCategoryName);

                         if (feeCategory != null)
                         {
                             bool paymentExists = await _context.ScholarPayments
                                 .AnyAsync(p =>
                                     p.SID == courseWork.SID &&
                                     p.PaymentCategory == PaymentCategory.CourseworkAdmissionPayment);

                             if (!paymentExists)
                             {
                                 _context.ScholarPayments.Add(new ScholarPayment
                                 {
                                     SID = courseWork.SID,
                                     PaymentCategory = PaymentCategory.CourseworkAdmissionPayment,
                                     PaymentStatus = PaymentStatus.Pending,
                                     Created = DateTime.UtcNow,
                                     Category = feeCategory.CategoryName,
                                     Remark = "Coursework fee generated after approval"
                                 });
                             }
                         }
                     }
                 }
             }

             await _context.SaveChangesAsync();

             return Ok(courseWork);
         }

 */
        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchCourseWork(
      int id,
      [FromForm] CourseWorkPatchRequest request)
    
        {
            // ============================
            // Fetch Coursework
            // ============================
            var courseWork = await _context.CourseWorks.FindAsync(id);

            if (courseWork == null)
                return NotFound($"CourseWork with ID {id} not found.");

            // Store previous enum value
            var previousResult = courseWork.CourseWorkResult;

            // ============================
            // File Upload / Replace
            // ============================
            if (request.MarksheetFile != null)
            {
                if (!string.IsNullOrWhiteSpace(courseWork.CourseWorkFilePath))
                {
                    await _fileStorage.OverwriteAsync(
                        request.MarksheetFile,
                        courseWork.CourseWorkFilePath
                    );
                }
                else
                {
                    courseWork.CourseWorkFilePath = await _fileStorage.SaveAsync(
                        request.MarksheetFile,
                        "course-work",
                        $"CW_{courseWork.SID}"
                    );
                }
            }

            // ============================
            // PATCH Scalar Updates
            // ============================

            // ENUM
            if (request.CourseWorkResult.HasValue)
                courseWork.CourseWorkResult = request.CourseWorkResult.Value;

            // STRING
            if (!string.IsNullOrWhiteSpace(request.CourseWorkRemark))
                courseWork.CourseWorkRemark = request.CourseWorkRemark;

            if (!string.IsNullOrWhiteSpace(request.CourseWorkStatus))
                courseWork.CourseWorkStatus = request.CourseWorkStatus;

            // DateTime?
            if (request.ApprovedAt.HasValue)
                courseWork.ApprovedAt = request.ApprovedAt.Value;

            // ============================
            // Decision Status Handling & Payment Creation on Approval
            // ============================
            if (courseWork.CourseWorkResult == CourseWorkDecisions.CourseworkApproved)
            {
                // ---- Scholar ----
                var scholar = await _context.Scholars
                    .FirstOrDefaultAsync(s => s.SID == courseWork.SID);

                if (scholar == null)
                    return NotFound("Scholar not found.");

                scholar.CourseWorkStatus = CourseWorkDecisions.CourseworkApproved;
                scholar.DecisionStatus = DecisionStatus.CourseworkApproved;
                scholar.DecisionUpdateTime = DateTime.UtcNow;

                // ---- Prevent Duplicate Payment ----
                bool paymentExists = await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == courseWork.SID &&
                    p.PaymentCategory == PaymentCategory.CourseworkAdmissionPayment);

                if (!paymentExists)
                {
                    // ---- Scholar Category ----
                    var categoryRaw = await _context.ScholarPersonalDetails
                        .Where(x => x.SID == courseWork.SID)
                        .Select(x => x.Category)
                        .FirstOrDefaultAsync();

                    if (string.IsNullOrWhiteSpace(categoryRaw))
                        return BadRequest("Scholar category missing.");

                    var category = categoryRaw.Trim().ToLower();

                    string feeCategoryName =
                        (category == "sc" || category == "st")
                            ? "Scholar Pre Ph.D Coursework Fee(SC/ST)"
                            : "Scholar Pre Ph.D Coursework Fee(UR/OBC)";

                    var feeCategory = await _context.FeeCategories
                        .FirstOrDefaultAsync(f => f.CategoryName == feeCategoryName);

                    if (feeCategory == null)
                        return BadRequest("Fee category not configured.");

                    // ---- Create Payment ----
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = courseWork.SID,
                        PaymentCategory = PaymentCategory.CourseworkAdmissionPayment,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = feeCategory.CategoryName,
                        Remark = "Coursework fee generated after approval"
                    });
                }
            }
            else if (courseWork.CourseWorkResult == CourseWorkDecisions.CourseworkRejected)
            {
                var scholar = await _context.Scholars
                    .FirstOrDefaultAsync(s => s.SID == courseWork.SID);

                if (scholar != null)
                {
                    scholar.CourseWorkStatus = CourseWorkDecisions.CourseworkRejected;
                    scholar.DecisionStatus = DecisionStatus.CourseworkRejected;
                    scholar.DecisionUpdateTime = DateTime.UtcNow;
                }
            }

            // ============================
            // Save Changes
            // ============================
            await _context.SaveChangesAsync();

            return Ok(courseWork);
        }







        // DELETE: api/CourseWork/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCourseWork(int id)
        {
            var courseWork = await _context.CourseWorks.FindAsync(id);
            if (courseWork == null)
            {
                return NotFound();
            }

            _context.CourseWorks.Remove(courseWork);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CourseWorkExists(int id)
        {
            return _context.CourseWorks.Any(e => e.CWID == id);
        }
    }

    public class CourseWorkCreateRequest
    {
        public int SID { get; set; }

        public IFormFile? CourseWorkFile { get; set; }

        public CourseWorkDecisions? CourseWorkResult { get; set; }
        public string? CourseWorkRemark { get; set; }
        public string? CourseWorkStatus { get; set; }
    }

    public class CourseWorkPatchRequest
    {
        public IFormFile? MarksheetFile { get; set; }

        public CourseWorkDecisions? CourseWorkResult { get; set; }
        public string? CourseWorkRemark { get; set; }
        public string? CourseWorkStatus { get; set; }
        public DateTime? ApprovedAt { get; set; }
    }

    public class CourseWorkDTO
    {
        public int SID { get; set; }

        public IFormFile? MarksheetFile { get; set; }

        public string? RollNumber { get; set; }

    }
}
