using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AffiliatedCollegeSupervisorDetailsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public AffiliatedCollegeSupervisorDetailsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/FacultiesWithSubjects
        [HttpGet("FacultiesWithSubjects")]
        public async Task<ActionResult<object>> GetFacultiesWithSubjects()
        {
            try
            {
                // Get all supervisor data for affiliated colleges
                var supervisorData = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    where sr.Active == true && sr.IsAccepted == 1 && !string.IsNullOrEmpty(se.CollegeName)
                    select new
                    {
                        PrimarySubjectId = sp.PrimarySuperviseSubject,
                        SecSubject1Id = sp.SecSuperviseSubject1,
                        SecSubject2Id = sp.SecSuperviseSubject2
                    }
                ).ToListAsync();

                // Get all subject IDs from affiliated college supervisors
                var allSubjectIds = supervisorData
                    .SelectMany(s => new[] { s.PrimarySubjectId, s.SecSubject1Id, s.SecSubject2Id })
                    .Where(id => id.HasValue)
                    .Select(id => id.Value)
                    .Distinct()
                    .ToList();

                // Get faculties with their subjects
                var facultiesWithSubjects = await _context.Departments
                    .Where(d => d.Status == "Y" && allSubjectIds.Contains(d.DepartmentID))
                    .GroupBy(d => d.Faculity)
                    .Select(g => new
                    {
                        Faculty = g.Key,
                        Subjects = g.Select(d => new
                        {
                            SubjectId = d.DepartmentID,
                            SubjectName = d.Subject
                        }).ToList()
                    })
                    .OrderBy(f => f.Faculty)
                    .ToListAsync();

                return Ok(facultiesWithSubjects);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching faculties with subjects: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/SubjectSupervisors/{subjectId}
        [HttpGet("SubjectSupervisors/{subjectId}")]
        public async Task<ActionResult<object>> GetSubjectSupervisors(int subjectId)
        {
            try
            {
                // Get subject details
                var subject = await _context.Departments
                    .Where(d => d.DepartmentID == subjectId)
                    .Select(d => new
                    {
                        SubjectId = d.DepartmentID,
                        SubjectName = d.Subject,
                        Faculty = d.Faculity
                    })
                    .FirstOrDefaultAsync();

                if (subject == null)
                {
                    return NotFound("Subject not found");
                }

                // Get supervisors from affiliated colleges for this subject
                var supervisorDetails = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    from sa in auths.DefaultIfEmpty()
                    where (sp.PrimarySuperviseSubject == subjectId || 
                          sp.SecSuperviseSubject1 == subjectId || 
                          sp.SecSuperviseSubject2 == subjectId) &&
                          sr.Active == true && sr.IsAccepted == 1 &&
                          !string.IsNullOrEmpty(se.CollegeName)
                    select new
                    {
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        CollegeName = se.CollegeName,
                        DepartmentInfo = subject.SubjectName + " / " + subject.Faculty
                    }
                ).OrderBy(x => x.FullName).ToListAsync();

                return Ok(new
                {
                    Subject = subject,
                    Supervisors = supervisorDetails
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching subject supervisors: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/SupervisorProfile/{supervisorId}
        [HttpGet("SupervisorProfile/{supervisorId}")]
        public async Task<ActionResult<object>> GetSupervisorProfile(int supervisorId)
        {
            try
            {
                // Get university name from HeaderSettings
                var headerSettings = await _context.HeaderSettings
                    .Where(h => h.IsActive == true)
                    .FirstOrDefaultAsync();

                var supervisorProfile = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                    from d1 in dept1.DefaultIfEmpty()
                    join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                    from d2 in dept2.DefaultIfEmpty()
                    join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                    from d3 in dept3.DefaultIfEmpty()
                    join su in _context.SupervisorUploads on sp.SupId equals su.SupId into uploads
                    from su in uploads.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where sp.SupId == supervisorId && !string.IsNullOrEmpty(se.CollegeName)
                    select new
                    {
                        // Basic Information
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        FatherName = sr.FatherName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        AlternateMobileNo = sp.AlternateMobileNo,
                        Year = sr.Year,
                        
                        // Photo Information
                        PhotoPath = su != null ? su.Photo : null,
                        
                        // University Information
                        UniversityName = headerSettings != null ? headerSettings.UniversityFullNameEnglish ?? headerSettings.UniversityNameEnglish : "University Name Not Set",
                        UniversityNameHindi = headerSettings != null ? headerSettings.UniversityFullNameHindi ?? headerSettings.UniversityNameHindi : null,
                        UniversityLogo = headerSettings != null ? headerSettings.Logo : null,
                        
                        // Personal Details
                        DateOfBirth = sp.DateOfBirth,
                        RetirementDate = sp.RetirementDate,
                        Gender = sp.Gender,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Nationality = sp.Nationality,
                        IdentityProofType = sp.IdentityProofType,
                        IdentityProofNo = sp.IdentityProofNo,
                        
                        // Address Information
                        CorrespondenceAddress = new
                        {
                            Address = sp.CoAddress,
                            State = sp.CoState,
                            District = sp.CoDistrict,
                            PinCode = sp.CoPinCode
                        },
                        PermanentAddress = new
                        {
                            Address = sp.PeAddress,
                            State = sp.PeState,
                            District = sp.PeDistrict,
                            PinCode = sp.PePinCode
                        },
                        OfficialAddress = sp.OfficialAddress,
                        
                        // Academic Information
                        CollegeName = se.CollegeName,
                        PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                        SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                        SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null,
                        
                        // Contact Information
                        UniversityDomainEmail = sp.UniversityDomainEmail,
                        LinkedinID = sp.LinkedinID,
                        
                        // Status
                        IsAccepted = sr.IsAccepted,
                        Active = sr.Active
                    }
                ).FirstOrDefaultAsync();

                if (supervisorProfile == null)
                {
                    return NotFound("Affiliated college supervisor not found");
                }

                // Get Educational Qualifications
                var qualifications = await _context.SupervisorQualifications
                    .Where(q => q.SupId == supervisorId)
                    .Select(q => new
                    {
                        Course = q.Course,
                        Year = q.Year,
                        Institution = q.Institution,
                        Details = q.Details
                    })
                    .OrderBy(q => q.Year)
                    .ToListAsync();

                // Get Experience
                var experience = await _context.SupervisorExperiences
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        OrganizationName = e.OrganizationName,
                        Designation = e.Designation,
                        DateFrom = e.DateFrom,
                        DateTo = e.DateTo,
                        NatureOfDuties = e.NatureOfDuties
                    })
                    .OrderBy(e => e.DateFrom)
                    .ToListAsync();

                // Get Awards and Fellowships
                var awards = await _context.SupervisorAwards
                    .Where(a => a.SupId == supervisorId)
                    .Select(a => new
                    {
                        Fellowship = a.Fellowship,
                        Agency = a.Agency,
                        Year = a.Year
                    })
                    .OrderBy(a => a.Year)
                    .ToListAsync();

                // Get Research Publications (from SupervisorResearch table)
                var publications = await _context.SupervisorResearches
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        TitleOfPaper = r.TitleOfPaper,
                        JournalName = r.JournalName,
                        AuthorName = r.AuthorName,
                        PubYear = r.PubYear,
                        IssNo = r.IssNo,
                        Volume = r.Volume,
                        Page = r.Page,
                        Citations = r.Citations,
                        ImpactFactor = r.ImpactFactor,
                        WebUrl = r.WebUrl,
                        ListedIn = r.ListedIn,
                        UGCListNo = r.UGCListNo
                    })
                    .OrderBy(r => r.PubYear)
                    .ToListAsync();

                // Get Research Details and Scholar Guidance (from SupervisorResearches table)
                var researchDetails = await _context.SupervisorResearch
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        ResearchArea = r.ResearchArea,
                        ResearchYear = r.ResearchYear,
                        PhdAwarded = r.Phd_Awarded ?? 0,
                        MPhilAwarded = r.MPhil_Awarded ?? 0,
                        Dissertation = r.Dissertation ?? 0,
                        PhdUnderSupervision = r.Phd_UnderSupervision ?? 0,
                        MPhilUnderSupervision = r.MPhil_UnderSupervision ?? 0,
                        DissertationUnderSupervision = r.DissertationUnderSupervision ?? 0,
                        Scopus = r.Scopus,
                        Orchid = r.Orchid,
                        PublOns = r.PublOns,
                        Vidwan = r.Vidwan,
                        GoogleScholar = r.GoogleScholar
                    })
                    .FirstOrDefaultAsync();

                // Get PhD Education Details
                var educationDetails = await _context.SupervisorEducations
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        UniversityName = e.UniversityName,
                        CollegeName = e.CollegeName,
                        PhdSubject = e.PhdSubject,
                        MonthAndYear = e.MonthAndYear,
                        SupervisorName = e.SupervisorName,
                        AreaOfSpec = e.AreaOfSpec,
                        ThesisTitle = e.ThesisTitle,
                        ResearchExp = e.ResearchExp,
                        PhdUniversity = e.PhdUniversity
                    })
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    Profile = supervisorProfile,
                    Qualifications = qualifications,
                    Experience = experience,
                    Awards = awards,
                    Publications = publications,
                    ResearchDetails = researchDetails,
                    EducationDetails = educationDetails
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching supervisor profile: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/FacultiesWithSubjects
        [HttpGet("ExternalSupervisors/FacultiesWithSubjects")]
        public async Task<ActionResult<object>> GetExternalSupervisorsFacultiesWithSubjects()
        {
            try
            {
                // Get all supervisor data for external supervisors (those without CollegeName or with specific external designation)
                var supervisorData = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    where sr.Active == true && sr.IsAccepted == 1 && 
                          (string.IsNullOrEmpty(se.CollegeName) || se.CollegeName.ToLower().Contains("external") || 
                           se.CollegeName.ToLower().Contains("guest") || se.CollegeName.ToLower().Contains("visiting"))
                    select new
                    {
                        PrimarySubjectId = sp.PrimarySuperviseSubject,
                        SecSubject1Id = sp.SecSuperviseSubject1,
                        SecSubject2Id = sp.SecSuperviseSubject2
                    }
                ).ToListAsync();

                // Get all subject IDs from external supervisors
                var allSubjectIds = supervisorData
                    .SelectMany(s => new[] { s.PrimarySubjectId, s.SecSubject1Id, s.SecSubject2Id })
                    .Where(id => id.HasValue)
                    .Select(id => id.Value)
                    .Distinct()
                    .ToList();

                // Get faculties with their subjects
                var facultiesWithSubjects = await _context.Departments
                    .Where(d => d.Status == "Y" && allSubjectIds.Contains(d.DepartmentID))
                    .GroupBy(d => d.Faculity)
                    .Select(g => new
                    {
                        Faculty = g.Key,
                        Subjects = g.Select(d => new
                        {
                            SubjectId = d.DepartmentID,
                            SubjectName = d.Subject
                        }).ToList()
                    })
                    .OrderBy(f => f.Faculty)
                    .ToListAsync();

                return Ok(facultiesWithSubjects);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching external supervisors faculties with subjects: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/SubjectSupervisors/{subjectId}
        [HttpGet("ExternalSupervisors/SubjectSupervisors/{subjectId}")]
        public async Task<ActionResult<object>> GetExternalSubjectSupervisors(int subjectId)
        {
            try
            {
                // Get subject details
                var subject = await _context.Departments
                    .Where(d => d.DepartmentID == subjectId)
                    .Select(d => new
                    {
                        SubjectId = d.DepartmentID,
                        SubjectName = d.Subject,
                        Faculty = d.Faculity
                    })
                    .FirstOrDefaultAsync();

                if (subject == null)
                {
                    return NotFound("Subject not found");
                }

                // Get external supervisors for this subject
                var supervisorDetails = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where (sp.PrimarySuperviseSubject == subjectId || 
                          sp.SecSuperviseSubject1 == subjectId || 
                          sp.SecSuperviseSubject2 == subjectId) &&
                          sr.Active == true && sr.IsAccepted == 1 &&
                          (string.IsNullOrEmpty(se.CollegeName) || se.CollegeName.ToLower().Contains("external") || 
                           se.CollegeName.ToLower().Contains("guest") || se.CollegeName.ToLower().Contains("visiting"))
                    select new
                    {
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Organization = se.CollegeName ?? "External Organization",
                        DepartmentInfo = subject.SubjectName + " / " + subject.Faculty
                    }
                ).OrderBy(x => x.FullName).ToListAsync();

                return Ok(new
                {
                    Subject = subject,
                    Supervisors = supervisorDetails
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching external subject supervisors: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/AllExternalSupervisors
        [HttpGet("ExternalSupervisors/AllExternalSupervisors")]
        public async Task<ActionResult<object>> GetAllExternalSupervisors()
        {
            try
            {
                var externalSupervisors = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                    from d1 in dept1.DefaultIfEmpty()
                    join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                    from d2 in dept2.DefaultIfEmpty()
                    join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                    from d3 in dept3.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where sr.Active == true && sr.IsAccepted == 1 &&
                          (string.IsNullOrEmpty(se.CollegeName) || se.CollegeName.ToLower().Contains("external") || 
                           se.CollegeName.ToLower().Contains("guest") || se.CollegeName.ToLower().Contains("visiting"))
                    select new
                    {
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        AlternateMobileNo = sp.AlternateMobileNo,
                        Year = sr.Year,
                        DateOfBirth = sp.DateOfBirth,
                        RetirementDate = sp.RetirementDate,
                        Gender = sp.Gender,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Nationality = sp.Nationality,
                        Organization = se.CollegeName ?? "External Organization",
                        OfficialAddress = sp.OfficialAddress,
                        UniversityDomainEmail = sp.UniversityDomainEmail,
                        LinkedinID = sp.LinkedinID,
                        PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                        SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                        SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null
                    }
                ).OrderBy(x => x.FullName).ToListAsync();

                return Ok(externalSupervisors);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching external supervisors: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/ExternalSupervisors/SupervisorProfile/{supervisorId}
        [HttpGet("ExternalSupervisors/SupervisorProfile/{supervisorId}")]
        public async Task<ActionResult<object>> GetExternalSupervisorProfile(int supervisorId)
        {
            try
            {
                // Get university name from HeaderSettings
                var headerSettings = await _context.HeaderSettings
                    .Where(h => h.IsActive == true)
                    .FirstOrDefaultAsync();

                var supervisorProfile = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                    from d1 in dept1.DefaultIfEmpty()
                    join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                    from d2 in dept2.DefaultIfEmpty()
                    join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                    from d3 in dept3.DefaultIfEmpty()
                    join su in _context.SupervisorUploads on sp.SupId equals su.SupId into uploads
                    from su in uploads.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where sp.SupId == supervisorId && 
                          (string.IsNullOrEmpty(se.CollegeName) || se.CollegeName.ToLower().Contains("external") || 
                           se.CollegeName.ToLower().Contains("guest") || se.CollegeName.ToLower().Contains("visiting"))
                    select new
                    {
                        // Basic Information
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        FatherName = sr.FatherName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        AlternateMobileNo = sp.AlternateMobileNo,
                        Year = sr.Year,
                        
                        // Photo Information
                        PhotoPath = su != null ? su.Photo : null,
                        
                        // University Information
                        UniversityName = headerSettings != null ? headerSettings.UniversityFullNameEnglish ?? headerSettings.UniversityNameEnglish : "University Name Not Set",
                        UniversityNameHindi = headerSettings != null ? headerSettings.UniversityFullNameHindi ?? headerSettings.UniversityNameHindi : null,
                        UniversityLogo = headerSettings != null ? headerSettings.Logo : null,
                        
                        // Personal Details
                        DateOfBirth = sp.DateOfBirth,
                        RetirementDate = sp.RetirementDate,
                        Gender = sp.Gender,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Nationality = sp.Nationality,
                        IdentityProofType = sp.IdentityProofType,
                        IdentityProofNo = sp.IdentityProofNo,
                        
                        // Address Information
                        CorrespondenceAddress = new
                        {
                            Address = sp.CoAddress,
                            State = sp.CoState,
                            District = sp.CoDistrict,
                            PinCode = sp.CoPinCode
                        },
                        PermanentAddress = new
                        {
                            Address = sp.PeAddress,
                            State = sp.PeState,
                            District = sp.PeDistrict,
                            PinCode = sp.PePinCode
                        },
                        OfficialAddress = sp.OfficialAddress,
                        
                        // Academic Information
                        Organization = se.CollegeName ?? "External Organization",
                        PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                        SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                        SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null,
                        
                        // Contact Information
                        UniversityDomainEmail = sp.UniversityDomainEmail,
                        LinkedinID = sp.LinkedinID,
                        
                        // Status
                        IsAccepted = sr.IsAccepted,
                        Active = sr.Active
                    }
                ).FirstOrDefaultAsync();

                if (supervisorProfile == null)
                {
                    return NotFound("External supervisor not found");
                }

                // Get Educational Qualifications
                var qualifications = await _context.SupervisorQualifications
                    .Where(q => q.SupId == supervisorId)
                    .Select(q => new
                    {
                        Course = q.Course,
                        Year = q.Year,
                        Institution = q.Institution,
                        Details = q.Details
                    })
                    .OrderBy(q => q.Year)
                    .ToListAsync();

                // Get Experience
                var experience = await _context.SupervisorExperiences
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        OrganizationName = e.OrganizationName,
                        Designation = e.Designation,
                        DateFrom = e.DateFrom,
                        DateTo = e.DateTo,
                        NatureOfDuties = e.NatureOfDuties
                    })
                    .OrderBy(e => e.DateFrom)
                    .ToListAsync();

                // Get Awards and Fellowships
                var awards = await _context.SupervisorAwards
                    .Where(a => a.SupId == supervisorId)
                    .Select(a => new
                    {
                        Fellowship = a.Fellowship,
                        Agency = a.Agency,
                        Year = a.Year
                    })
                    .OrderBy(a => a.Year)
                    .ToListAsync();

                // Get Research Publications (from SupervisorResearch table)
                var publications = await _context.SupervisorResearches
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        TitleOfPaper = r.TitleOfPaper,
                        JournalName = r.JournalName,
                        AuthorName = r.AuthorName,
                        PubYear = r.PubYear,
                        IssNo = r.IssNo,
                        Volume = r.Volume,
                        Page = r.Page,
                        Citations = r.Citations,
                        ImpactFactor = r.ImpactFactor,
                        WebUrl = r.WebUrl,
                        ListedIn = r.ListedIn,
                        UGCListNo = r.UGCListNo
                    })
                    .OrderBy(r => r.PubYear)
                    .ToListAsync();

                // Get Research Details and Scholar Guidance (from SupervisorResearches table)
                var researchDetails = await _context.SupervisorResearch
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        ResearchArea = r.ResearchArea,
                        ResearchYear = r.ResearchYear,
                        PhdAwarded = r.Phd_Awarded ?? 0,
                        MPhilAwarded = r.MPhil_Awarded ?? 0,
                        Dissertation = r.Dissertation ?? 0,
                        PhdUnderSupervision = r.Phd_UnderSupervision ?? 0,
                        MPhilUnderSupervision = r.MPhil_UnderSupervision ?? 0,
                        DissertationUnderSupervision = r.DissertationUnderSupervision ?? 0,
                        Scopus = r.Scopus,
                        Orchid = r.Orchid,
                        PublOns = r.PublOns,
                        Vidwan = r.Vidwan,
                        GoogleScholar = r.GoogleScholar
                    })
                    .FirstOrDefaultAsync();

                // Get PhD Education Details
                var educationDetails = await _context.SupervisorEducations
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        UniversityName = e.UniversityName,
                        CollegeName = e.CollegeName,
                        PhdSubject = e.PhdSubject,
                        MonthAndYear = e.MonthAndYear,
                        SupervisorName = e.SupervisorName,
                        AreaOfSpec = e.AreaOfSpec,
                        ThesisTitle = e.ThesisTitle,
                        ResearchExp = e.ResearchExp,
                        PhdUniversity = e.PhdUniversity
                    })
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    Profile = supervisorProfile,
                    Qualifications = qualifications,
                    Experience = experience,
                    Awards = awards,
                    Publications = publications,
                    ResearchDetails = researchDetails,
                    EducationDetails = educationDetails
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching external supervisor profile: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/CoSupervisors/AllCoSupervisors
        [HttpGet("CoSupervisors/AllCoSupervisors")]
        public async Task<ActionResult<object>> GetAllCoSupervisors()
        {
            try
            {
                // Get all co-supervisor IDs from ScholarSupervisor table
                var coSupervisorIds = await _context.ScholarSupervisors
                    .Where(ss => ss.COSUPID.HasValue)
                    .Select(ss => ss.COSUPID.Value)
                    .Distinct()
                    .ToListAsync();

                var coSupervisors = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                    from d1 in dept1.DefaultIfEmpty()
                    join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                    from d2 in dept2.DefaultIfEmpty()
                    join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                    from d3 in dept3.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where sr.Active == true && sr.IsAccepted == 1 &&
                          coSupervisorIds.Contains(sp.SupId)
                    select new
                    {
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        AlternateMobileNo = sp.AlternateMobileNo,
                        Year = sr.Year,
                        DateOfBirth = sp.DateOfBirth,
                        RetirementDate = sp.RetirementDate,
                        Gender = sp.Gender,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Nationality = sp.Nationality,
                        CollegeName = se.CollegeName,
                        OfficialAddress = sp.OfficialAddress,
                        UniversityDomainEmail = sp.UniversityDomainEmail,
                        LinkedinID = sp.LinkedinID,
                        PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                        SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                        SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null
                    }
                ).OrderBy(x => x.FullName).ToListAsync();

                return Ok(coSupervisors);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching co-supervisors: {ex.Message}");
            }
        }

        // GET: api/AffiliatedCollegeSupervisorDetails/CoSupervisors/SupervisorProfile/{supervisorId}
        [HttpGet("CoSupervisors/SupervisorProfile/{supervisorId}")]
        public async Task<ActionResult<object>> GetCoSupervisorProfile(int supervisorId)
        {
            try
            {
                // First check if this supervisor is actually a co-supervisor
                var isCoSupervisor = await _context.ScholarSupervisors
                    .AnyAsync(ss => ss.COSUPID == supervisorId);

                if (!isCoSupervisor)
                {
                    return NotFound("This supervisor is not registered as a co-supervisor");
                }

                // Get university name from HeaderSettings
                var headerSettings = await _context.HeaderSettings
                    .Where(h => h.IsActive == true)
                    .FirstOrDefaultAsync();

                var supervisorProfile = await (
                    from sp in _context.SupervisorPersonal
                    join sr in _context.SupervisorRegistrations on sp.SupId equals sr.SupId
                    join se in _context.SupervisorEducations on sp.SupId equals se.SupId
                    join d in _context.Designations on sp.Designation equals d.DesignationID into designations
                    from d in designations.DefaultIfEmpty()
                    join d1 in _context.Departments on sp.PrimarySuperviseSubject equals d1.DepartmentID into dept1
                    from d1 in dept1.DefaultIfEmpty()
                    join d2 in _context.Departments on sp.SecSuperviseSubject1 equals d2.DepartmentID into dept2
                    from d2 in dept2.DefaultIfEmpty()
                    join d3 in _context.Departments on sp.SecSuperviseSubject2 equals d3.DepartmentID into dept3
                    from d3 in dept3.DefaultIfEmpty()
                    join su in _context.SupervisorUploads on sp.SupId equals su.SupId into uploads
                    from su in uploads.DefaultIfEmpty()
                    join sa in _context.SupervisorAuths on sp.SupId equals sa.SupId into auths
                    from sa in auths.DefaultIfEmpty()
                    where sp.SupId == supervisorId
                    select new
                    {
                        // Basic Information
                        SupervisorId = sp.SupId,
                        ShodhanikId = sa != null ? sa.PermUserName : sp.SupId.ToString(),
                        ApplicationNumber = sr.ApplicationNumber,
                        Title = sr.Title,
                        FullName = sr.FullName,
                        FatherName = sr.FatherName,
                        Email = sr.Email,
                        MobileNo = sr.MobileNo,
                        AlternateMobileNo = sp.AlternateMobileNo,
                        Year = sr.Year,
                        
                        // Photo Information
                        PhotoPath = su != null ? su.Photo : null,
                        
                        // University Information
                        UniversityName = headerSettings != null ? headerSettings.UniversityFullNameEnglish ?? headerSettings.UniversityNameEnglish : "University Name Not Set",
                        UniversityNameHindi = headerSettings != null ? headerSettings.UniversityFullNameHindi ?? headerSettings.UniversityNameHindi : null,
                        UniversityLogo = headerSettings != null ? headerSettings.Logo : null,
                        
                        // Personal Details
                        DateOfBirth = sp.DateOfBirth,
                        RetirementDate = sp.RetirementDate,
                        Gender = sp.Gender,
                        Designation = d != null ? d.DesignationName : "Not specified",
                        Nationality = sp.Nationality,
                        IdentityProofType = sp.IdentityProofType,
                        IdentityProofNo = sp.IdentityProofNo,
                        
                        // Address Information
                        CorrespondenceAddress = new
                        {
                            Address = sp.CoAddress,
                            State = sp.CoState,
                            District = sp.CoDistrict,
                            PinCode = sp.CoPinCode
                        },
                        PermanentAddress = new
                        {
                            Address = sp.PeAddress,
                            State = sp.PeState,
                            District = sp.PeDistrict,
                            PinCode = sp.PePinCode
                        },
                        OfficialAddress = sp.OfficialAddress,
                        
                        // Academic Information
                        CollegeName = se.CollegeName,
                        PrimarySubject = d1 != null ? new { Id = d1.DepartmentID, Name = d1.Subject, Faculty = d1.Faculity } : null,
                        SecondarySubject1 = d2 != null ? new { Id = d2.DepartmentID, Name = d2.Subject, Faculty = d2.Faculity } : null,
                        SecondarySubject2 = d3 != null ? new { Id = d3.DepartmentID, Name = d3.Subject, Faculty = d3.Faculity } : null,
                        
                        // Contact Information
                        UniversityDomainEmail = sp.UniversityDomainEmail,
                        LinkedinID = sp.LinkedinID,
                        
                        // Status
                        IsAccepted = sr.IsAccepted,
                        Active = sr.Active
                    }
                ).FirstOrDefaultAsync();

                if (supervisorProfile == null)
                {
                    return NotFound("Co-supervisor not found");
                }

                // Get Educational Qualifications
                var qualifications = await _context.SupervisorQualifications
                    .Where(q => q.SupId == supervisorId)
                    .Select(q => new
                    {
                        Course = q.Course,
                        Year = q.Year,
                        Institution = q.Institution,
                        Details = q.Details
                    })
                    .OrderBy(q => q.Year)
                    .ToListAsync();

                // Get Experience
                var experience = await _context.SupervisorExperiences
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        OrganizationName = e.OrganizationName,
                        Designation = e.Designation,
                        DateFrom = e.DateFrom,
                        DateTo = e.DateTo,
                        NatureOfDuties = e.NatureOfDuties
                    })
                    .OrderBy(e => e.DateFrom)
                    .ToListAsync();

                // Get Awards and Fellowships
                var awards = await _context.SupervisorAwards
                    .Where(a => a.SupId == supervisorId)
                    .Select(a => new
                    {
                        Fellowship = a.Fellowship,
                        Agency = a.Agency,
                        Year = a.Year
                    })
                    .OrderBy(a => a.Year)
                    .ToListAsync();

                // Get Research Publications (from SupervisorResearch table)
                var publications = await _context.SupervisorResearches
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        TitleOfPaper = r.TitleOfPaper,
                        JournalName = r.JournalName,
                        AuthorName = r.AuthorName,
                        PubYear = r.PubYear,
                        IssNo = r.IssNo,
                        Volume = r.Volume,
                        Page = r.Page,
                        Citations = r.Citations,
                        ImpactFactor = r.ImpactFactor,
                        WebUrl = r.WebUrl,
                        ListedIn = r.ListedIn,
                        UGCListNo = r.UGCListNo
                    })
                    .OrderBy(r => r.PubYear)
                    .ToListAsync();

                // Get Research Details and Scholar Guidance (from SupervisorResearches table)
                var researchDetails = await _context.SupervisorResearch
                    .Where(r => r.SupId == supervisorId)
                    .Select(r => new
                    {
                        ResearchArea = r.ResearchArea,
                        ResearchYear = r.ResearchYear,
                        PhdAwarded = r.Phd_Awarded ?? 0,
                        MPhilAwarded = r.MPhil_Awarded ?? 0,
                        Dissertation = r.Dissertation ?? 0,
                        PhdUnderSupervision = r.Phd_UnderSupervision ?? 0,
                        MPhilUnderSupervision = r.MPhil_UnderSupervision ?? 0,
                        DissertationUnderSupervision = r.DissertationUnderSupervision ?? 0,
                        Scopus = r.Scopus,
                        Orchid = r.Orchid,
                        PublOns = r.PublOns,
                        Vidwan = r.Vidwan,
                        GoogleScholar = r.GoogleScholar
                    })
                    .FirstOrDefaultAsync();

                // Get PhD Education Details
                var educationDetails = await _context.SupervisorEducations
                    .Where(e => e.SupId == supervisorId)
                    .Select(e => new
                    {
                        UniversityName = e.UniversityName,
                        CollegeName = e.CollegeName,
                        PhdSubject = e.PhdSubject,
                        MonthAndYear = e.MonthAndYear,
                        SupervisorName = e.SupervisorName,
                        AreaOfSpec = e.AreaOfSpec,
                        ThesisTitle = e.ThesisTitle,
                        ResearchExp = e.ResearchExp,
                        PhdUniversity = e.PhdUniversity
                    })
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    Profile = supervisorProfile,
                    Qualifications = qualifications,
                    Experience = experience,
                    Awards = awards,
                    Publications = publications,
                    ResearchDetails = researchDetails,
                    EducationDetails = educationDetails
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error fetching co-supervisor profile: {ex.Message}");
            }
        }
    }
}