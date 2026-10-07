using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using static RMS.Controllers.SupervisorCategoriesController;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorPersonalsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorPersonalsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorPersonals
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorPersonal>>> GetSupervisorPersonal()
        {
            return await _context.SupervisorPersonal.ToListAsync();
        }

        [HttpGet("RegWithPers")]
        public async Task<ActionResult> GetSupRegWithPers(int id)
        {
            var result = await (
                from pers in _context.SupervisorPersonal

                join reg in _context.SupervisorRegistrations
                    on pers.SupId equals reg.SupId

                join edu in _context.SupervisorEducations
                    on pers.SupId equals edu.SupId
                    into education from edu in education.DefaultIfEmpty()

                join doc in _context.DocumentMasters
                    on pers.IdentityProofType equals doc.DocumentMasterID

                join des in _context.Designations
                    on pers.Designation equals des.DesignationID

                // LEFT JOIN - Primary Subject
                join dept in _context.Departments
                    on pers.PrimarySuperviseSubject equals dept.DepartmentID into deptJoin
                from dept in deptJoin.DefaultIfEmpty()

                // LEFT JOIN - Secondary Subject 1
                join dep in _context.Departments
                    on pers.SecSuperviseSubject1 equals dep.DepartmentID into depJoin
                from dep in depJoin.DefaultIfEmpty()

                // LEFT JOIN - Secondary Subject 2
                join depa in _context.Departments
                    on pers.SecSuperviseSubject2 equals depa.DepartmentID into depaJoin
                from depa in depaJoin.DefaultIfEmpty()

                join auth in _context.SupervisorAuths
                    on pers.SupId equals auth.SupId

                // LEFT JOIN - College List
                join college in _context.CollegeLists
                    on edu.CollegeId equals college.Id into collegeJoin
                    from college in collegeJoin.DefaultIfEmpty()

                where pers.SupId == id

                select new
                {
                    pers.SupId,
                    pers.CoPinCode,
                    pers.CoAddress,
                    pers.CoDistrict,
                    pers.CoState,
                    pers.DateOfBirth,
                    pers.PeDistrict,
                    pers.PeState,
                    pers.PePinCode,
                    pers.PeAddress,
                    pers.RetirementDate,
                    pers.Designation,
                    pers.IdentityProofNo,
                    pers.IdentityProofType,
                    pers.LinkedinID,
                    pers.AlternateMobileNo,
                    pers.PrimarySuperviseSubject,
                    pers.SecSuperviseSubject1,
                    pers.SecSuperviseSubject2,
                    pers.ApaarId,
                    CollegeName = !string.IsNullOrEmpty(edu.CollegeName)
                        ? edu.CollegeName
                        : college != null ? college.CollegeName : null,
                    pers.OfficialAddress,
                    pers.UniversityDomainEmail,
                    pers.Nationality,
                    pers.Gender,
                    reg.Title,
                    reg.MobileNo,
                    reg.Email,
                    reg.FullName,
                    reg.FatherName,
                    ShodhnikId = auth.PermUserName,

                    PrimarySupervise = dept != null ? dept.Subject : null,
                    SecondarySupervise1 = dep != null ? dep.Subject : null,
                    SecondarySupervise2 = depa != null ? depa.Subject : null,

                    DocumentName = doc.DocumentName,
                    DesignationName = des.DesignationName
                }
            ).FirstOrDefaultAsync();

            if (result == null)
                return NotFound("No data found");

            return Ok(result);
        }

        [HttpPost("SelectedSupervisor")]
        public async Task<ActionResult> PostSelectedSupervisorPersonal(supervisorDTO dto)
        {
            var supervisor = await _context.SupervisorPersonal
                .FirstOrDefaultAsync(s => s.SupId == dto.SupId);
            var supervisorEdu = await _context.SupervisorEducations
               .FirstOrDefaultAsync(s => s.SupId == dto.SupId);
            if (supervisor == null)
            {
                return NotFound($"Supervisor with SupId {dto.SupId} not found.");
            }

            // ALWAYS UPDATE when exists
            supervisor.OfficialAddress = dto.OfficialAddress;
            supervisor.PrimarySuperviseSubject = dto.PrimarySuperviseSubject;
            supervisor.SecSuperviseSubject1 = dto.SecSuperviseSubject1;
            supervisor.SecSuperviseSubject2 = dto.SecSuperviseSubject2;
            supervisor.AlternateMobileNo = dto.AlternateMobileNo;
            supervisor.UniversityDomainEmail = dto.UniversityDomainEmail;
            supervisor.LinkedinID = dto.LinkedinID;
            supervisorEdu.CollegeName = dto.CollegeName;

            await _context.SaveChangesAsync();

            return Ok(supervisor);
        }

        public class supervisorDTO
        {
            public int SupId { get; set; }
            public string FullName { get; set; }
            public string Email { get; set; }
            public string PermanentState { get; set; }
            public string PermanentPinCode {  get; set; }
            public string PermanentAddress { get; set; }
            public string? OfficialAddress { get; set; }
            public int? PrimarySuperviseSubject { get; set; }
            public int? SecSuperviseSubject1 { get; set; }
            public int? SecSuperviseSubject2 { get; set; }
            public string? AlternateMobileNo { get; set; }
            [EmailAddress]
            public string? UniversityDomainEmail { get; set; }
            public string? TwitterID { get; set; }
            public string? LinkedinID { get; set; }
            public string? CollegeName { get; set; }
        }


        [HttpGet("AllDetail")]
        public async Task<ActionResult> GetAllDetails(int id)
        {
            try
            {
                var result = await _context.SupervisorPersonal
                    .Where(p => p.SupId == id)
                    .Select(pers => new
                    {
                    // SupervisorPersonal
                    pers.SupId,
                    pers.CoPinCode,
                    pers.CoAddress,
                    pers.CoDistrict,
                    pers.CoState,
                    pers.DateOfBirth,
                    pers.PeDistrict,
                    pers.PeState,
                    pers.PePinCode,
                    pers.PeAddress,
                    pers.RetirementDate,
                    pers.Designation,
                    pers.IdentityProofNo,
                    pers.IdentityProofType,
                    pers.Nationality,
                    pers.Gender,
                    pers.PrimarySuperviseSubject,
                    pers.ApaarId,
                     SubjectName = _context.Departments.
                     Where(d=>d.DepartmentID == pers.PrimarySuperviseSubject)
                     .Select(d=>d.Subject).FirstOrDefault(),
                    IdentityProofName = _context.DocumentMasters
                .Where(d => d.DocumentMasterID == pers.IdentityProofType)
                .Select(d => d.DocumentName)
                .FirstOrDefault(),
                DesignationName = _context.Designations
                .Where(d => d.DesignationID == pers.Designation)
                .Select(d=>d.DesignationName)
                .FirstOrDefault(),
                    //Age = pers.DateOfBirth - DateTime.UtcNow,

                    // Acceptance Status from SupervisorRegistrations
                    IsAccepted = _context.SupervisorRegistrations
                        .Where(r => r.SupId == pers.SupId)
                        .Select(r => r.IsAccepted)
                        .FirstOrDefault(),
                    
                    RejectionReason = _context.SupervisorScreenings
                        .Where(r => r.SupId == pers.SupId)
                        .Select(r => r.Screening2Remark1)
                        .FirstOrDefault(),

                    // SupervisorRegistration (LEFT JOIN)
                    Registration = _context.SupervisorRegistrations
                        .Where(r => r.SupId == pers.SupId)
                        .Select(r => new
                        {
                            r.Title,
                            r.MobileNo,
                            r.Email,
                            r.FullName,
                            r.FatherName,
                            r.ApplicationNumber
                        })
                        .FirstOrDefault(),


                    // Transaction (LEFT JOIN)
                    Transaction = _context.SupervisorTransactions
                        .Where(t => t.SupId == pers.SupId)
                        .Select(t => new
                        {
                            t.TxnNo,
                            t.TotalFee,
                            t.TxnDate
                        })
                        .FirstOrDefault(),


                    // Img And Sign (LEFT JOIN)
                    SupUploads = _context.SupervisorUploads
                    .Where(u => u.SupId == pers.SupId)
                    .Select(u => new
                    {
                        u.Photo,
                        u.Sign,
                        u.ApaarId,
                        u.AppLetter,
                    })
                    .FirstOrDefault(),
                    Experience = _context.SupervisorExperiences
                    .Where(s=>s.SupId == pers.SupId).ToList(),
                        // Education List (LEFT JOIN)
                        Education =
(
    from e in _context.SupervisorEducations
    where e.SupId == pers.SupId

    join u in _context.Universities
        on e.UniversityId equals u.UniversityId into uJoin
    from u in uJoin.DefaultIfEmpty()

    join c in _context.CollegeLists
        on e.CollegeId equals c.Id into cJoin
    from c in cJoin.DefaultIfEmpty()

   

    select new
    {
        e.UniversityId,
        UniversityType = u != null ? u.UniversityName : null,
        e.UniversityName,
        e.ResearchExp,
        e.ThesisTitle,
        e.CollegeId,

        CollegeName = !string.IsNullOrEmpty(e.CollegeName)
            ? e.CollegeName
            : c != null ? c.CollegeName : null,

        e.AreaOfSpec,
        e.SupervisorName,
        e.DeptEst,
        e.Description,
        e.PhdSubject,
        e.MonthAndYear,
        e.PhdUniversity,

      
    }
).ToList(),


                        // Research List (LEFT JOIN)
                        Research = _context.SupervisorResearches
                        .Where(r => r.SupId == pers.SupId)
                        .Select(r => new
                        {
                            r.TitleOfPaper,
                            r.JournalName,
                            r.AuthorName,
                            r.Page,
                            r.PubYear,
                            r.Citations,
                            r.ImpactFactor,
                            r.Volume,
                            r.ListedIn,
                            r.IssNo,
                            r.WebUrl,
                            r.UGCListNo,
                            r.UploadPaper
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

                if (result == null)
                    return NotFound("No data found");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }



        [HttpGet("AllSelected")]
        public async Task<ActionResult> GetAllSelected(int id)
        {
            try
            {
                // 1️⃣ Get supervisor base data
                var result = await _context.SupervisorPersonal
                    .Where(p => p.SupId == id)
                    .Select(pers => new
                    {
                        pers.SupId,
                        pers.Designation,
                        pers.OfficialAddress,
                        pers.PrimarySuperviseSubject,
                        ShodhnikId = _context.SupervisorAuths
                        .Where(d=>d.SupId== pers.SupId)
                        .Select(s=>s.PermUserName)
                        .FirstOrDefault(),
                        Subject = _context.Departments
                            .Where(d => d.DepartmentID == pers.PrimarySuperviseSubject)
                            .Select(t => t.Subject)
                            .FirstOrDefault(),

                        DesignationName = _context.Designations
                            .Where(d => d.DesignationID == pers.Designation)
                            .Select(d => d.DesignationName)
                            .FirstOrDefault(),

                        Registration = _context.SupervisorRegistrations
                            .Where(r => r.SupId == pers.SupId)
                            .Select(r => new
                            {
                                r.Title,
                                r.MobileNo,
                                r.Email,
                                r.FullName,
                                r.FatherName,
                                r.ApplicationNumber
                            })
                            .FirstOrDefault(),

                        Education = _context.SupervisorEducations
                            .Where(s => s.SupId == pers.SupId)
                            .FirstOrDefault(),

                        Qualification = _context.SupervisorQualifications
                            .Where(t => t.SupId == pers.SupId)
                            .ToList(),

                        Experience = _context.SupervisorExperiences
                            .Where(t => t.SupId == pers.SupId)
                            .ToList(),

                        SupUploads = _context.SupervisorUploads
                            .Where(u => u.SupId == pers.SupId)
                            .Select(u => new { u.Photo, u.Sign })
                            .FirstOrDefault(),

                        Categories = _context.SupervisorCategories
                            .Where(e => e.SupId == pers.SupId)
                            .Select(e => new
                            {
                                e.CategoryId,
                                e.ActivityType,
                                e.ApplicationName,
                                e.NameAndAddress,
                                e.NameOfProject,
                                e.ApplicationNumber,
                                e.Date,
                                e.DetailsOfEvent,
                                e.DOINumber,
                                e.AcademicName,
                                e.Category,
                                e.FundingAgency,
                                e.Citations,
                                e.Institution,
                                e.MemberType,
                                e.Organization,
                                e.ImpactFactor,
                                e.ISBN,
                                e.IssnNo,
                                e.Amount,
                                e.NameOfAuthor,
                                e.NameOfJournal,
                                e.NameOfBook,
                                e.TitleOfChapter,
                                e.TitleOfPaper,
                                CategoryName = _context.Categories
                                    .Where(c => c.Id == e.CategoryId)
                                    .Select(r => r.Name)
                                    .FirstOrDefault()
                            })
                            .ToList(),

                        Awards = _context.SupervisorAwards
                            .Where(a => a.SupId == pers.SupId)
                            .ToList(),

                        Research = _context.SupervisorResearch
                            .Where(r => r.SupId == pers.SupId)
                            .ToList()
                    })
                    .FirstOrDefaultAsync();

                if (result == null)
                    return NotFound("No data found");

                // 2️⃣ Get category counts
                var supervisorCounts = await _context.SupervisorCategories
                    .Where(sc => sc.SupId == id)
                    .GroupBy(sc => sc.CategoryId)
                    .Select(g => new
                    {
                        CategoryId = g.Key,
                        Count = g.Count()
                    })
                    .ToListAsync();

                var categories = await _context.Categories
                    .Select(c => new { c.Id, c.Name })
                    .ToListAsync();

                var categoryCounts = categories
                    .Select(c => new SupervisorCategoryCountDto
                    {
                        CategoryId = c.Id,
                        CategoryName = c.Name,
                        Count = supervisorCounts
                            .Where(sc => sc.CategoryId == c.Id)
                            .Select(sc => sc.Count)
                            .FirstOrDefault()
                    })
                    .ToList();

                // 3️⃣ Attach to SAME result object
                var finalResult = new
                {
                    result.SupId,
                    result.Designation,
                    result.OfficialAddress,
                    result.PrimarySuperviseSubject,
                    result.Subject,
                    result.DesignationName,
                    result.Registration,
                    result.Education,
                    result.Qualification,
                    result.Experience,
                    result.SupUploads,
                    result.Categories,
                    result.Awards,
                    result.Research,
                    result.ShodhnikId,
                    // 👇 INCLUDED HERE (not separate)
                    CategoryCounts = categoryCounts
                };

                return Ok(finalResult);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Internal server error",
                    error = ex.Message
                });
            }
        }


        // GET: api/SupervisorPersonals/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorPersonal>> GetSupervisorPersonal(int id)
        {
            var supervisorPersonal = await _context.SupervisorPersonal.FindAsync(id);

            if (supervisorPersonal == null)
            {
                return NotFound();
            }

            return supervisorPersonal;
        }

        // PUT: api/SupervisorPersonals/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorPersonal(int id, SupervisorPersonal supervisorPersonal)
        {
            if (id != supervisorPersonal.SupId)
            {
                return BadRequest();
            }

            _context.Entry(supervisorPersonal).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupervisorPersonalExists(id))
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

        // POST: api/SupervisorPersonals
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorPersonal>> PostSupervisorPersonal(SupervisorPersonal supervisorPersonal)
        {
            // ===== REMOVE EXISTING PERSONAL RECORDS =====
            var existingList = await _context.SupervisorPersonal
                .Where(s => s.SupId == supervisorPersonal.SupId)
                .ToListAsync();

            if (existingList.Any())
            {
                _context.SupervisorPersonal.RemoveRange(existingList);
            }

            // Add new personal record
            _context.SupervisorPersonal.Add(supervisorPersonal);

            // ===== HANDLE STATUS =====
            var existingStatus = await _context.SupervisorApplicationStatuses
                .FirstOrDefaultAsync(s => s.SupId == supervisorPersonal.SupId);

            bool wasStep1AlreadyTrue = false;

            if (existingStatus == null)
            {
                // Create new status record
                existingStatus = new SuplicationApplicationStatus
                {
                    SupId = supervisorPersonal.SupId,
                    RegAt = DateTime.UtcNow,
                    Step_1 = true,
                    Step_1At = DateTime.UtcNow
                };
                _context.SupervisorApplicationStatuses.Add(existingStatus);
            }
            else
            {
                // Check if Step_1 was already true
                wasStep1AlreadyTrue = existingStatus.Step_1;

                // Update Step_1
                existingStatus.Step_1 = true;
                existingStatus.Step_1At = DateTime.UtcNow;
                _context.SupervisorApplicationStatuses.Update(existingStatus);
            }

            // ===== RESET SCREENING STATUS IF STEP_1 WAS ALREADY TRUE =====
            if (wasStep1AlreadyTrue)
            {
                var screeningStatus = await _context.SupervisorScreenings
                    .FirstOrDefaultAsync(s => s.SupId == supervisorPersonal.SupId);

                if (screeningStatus != null)
                {
                    screeningStatus.Screening1Status = 0;
                    screeningStatus.Screening2Status = 0;
                    screeningStatus.Screening3Status = 0;
                    screeningStatus.Screening4Status = 0;
                    screeningStatus.Screening5Status = 0;
                    screeningStatus.Screening6Status = 0;

                    _context.SupervisorScreenings.Update(screeningStatus);
                }
            }

            // ===== SAVE ALL CHANGES AT ONCE =====
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSupervisorPersonal", new { id = supervisorPersonal.SupId }, supervisorPersonal);
        }

        // DELETE: api/SupervisorPersonals/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorPersonal(int id)
        {
            var supervisorPersonal = await _context.SupervisorPersonal.FindAsync(id);
            if (supervisorPersonal == null)
            {
                return NotFound();
            }

            _context.SupervisorPersonal.Remove(supervisorPersonal);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorPersonalExists(int id)
        {
            return _context.SupervisorPersonal.Any(e => e.SupId == id);
        }
    }
}
