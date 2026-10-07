using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CampusController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public CampusController(RMSDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Get all departments with their campus scholars
        /// Returns all departments with scholars data (empty if no scholars)
        /// </summary>
        [HttpGet("ScholarsByDepartment")]
        public async Task<ActionResult<object>> GetScholarsByDepartment()
        {
            try
            {
                // Get all departments
                var allDepartments = await _context.Departments
                    .Where(d => d.Status == "Y")
                    .OrderBy(d => d.Subject)
                    .ToListAsync();

                // Get scholars with their details
                var scholarsData = await (
                    from s in _context.Scholars
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join ss in _context.ScholarSupervisors on s.SID equals ss.SID
                    join sr in _context.SupervisorRegistrations on ss.SUPID1 equals sr.SupId
                    join se in _context.SupervisorEducations on sr.SupId equals se.SupId
                    join sa in _context.SupervisorAuths on sr.SupId equals sa.SupId into saGroup
                    from sa in saGroup.DefaultIfEmpty()
                    join sauth in _context.ScholarAuths on s.SID equals sauth.SID into sauthGroup
                    from sauth in sauthGroup.DefaultIfEmpty()
                    select new
                    {
                        DepartmentId = d.DepartmentID,
                        DepartmentName = d.Subject,
                        ScholarName = s.Name,
                        ScholarShodhanikId = sauth != null ? sauth.PermUserName : s.SID.ToString(),
                        SupervisorName = sr.FullName,
                        SupervisorShodhanikId = sa != null ? sa.PermUserName : sr.SupId.ToString(),
                        College = se.CollegeName
                    }
                )
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.ScholarName)
                .ToListAsync();

                // Group by department and include all departments
                var result = allDepartments.Select(dept => new
                {
                    DepartmentId = dept.DepartmentID,
                    DepartmentName = dept.Subject,
                    Scholars = scholarsData
                        .Where(s => s.DepartmentId == dept.DepartmentID)
                        .Select(s => new
                        {
                            s.ScholarName,
                            s.ScholarShodhanikId,
                            s.SupervisorName,
                            s.SupervisorShodhanikId,
                            s.College
                        })
                        .ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Error fetching scholars by department",
                    Error = ex.Message
                });
            }
        }

        /// <summary>
        /// Get all departments with their affiliated college scholars
        /// Returns all departments with scholars data from affiliated colleges (empty if no scholars)
        /// </summary>
        [HttpGet("AffiliatedCollegeScholarsByDepartment")]
        public async Task<ActionResult<object>> GetAffiliatedCollegeScholarsByDepartment()
        {
            try
            {
                // Get all departments
                var allDepartments = await _context.Departments
                    .Where(d => d.Status == "Y")
                    .OrderBy(d => d.Subject)
                    .ToListAsync();

                // Get scholars with their details from affiliated colleges
                var scholarsData = await (
                    from s in _context.Scholars
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join ss in _context.ScholarSupervisors on s.SID equals ss.SID
                    join sr in _context.SupervisorRegistrations on ss.SUPID1 equals sr.SupId
                    join se in _context.SupervisorEducations on sr.SupId equals se.SupId
                    join sa in _context.SupervisorAuths on sr.SupId equals sa.SupId into saGroup
                    from sa in saGroup.DefaultIfEmpty()
                    join sauth in _context.ScholarAuths on s.SID equals sauth.SID into sauthGroup
                    from sauth in sauthGroup.DefaultIfEmpty()
                    where !string.IsNullOrEmpty(se.CollegeName) && se.CollegeName != "M. J. P. Rohilkhand University Campus"
                    select new
                    {
                        DepartmentId = d.DepartmentID,
                        DepartmentName = d.Subject,
                        ScholarName = s.Name,
                        ScholarShodhanikId = sauth != null ? sauth.PermUserName : s.SID.ToString(),
                        SupervisorName = sr.FullName,
                        SupervisorShodhanikId = sa != null ? sa.PermUserName : sr.SupId.ToString(),
                        College = se.CollegeName
                    }
                )
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.ScholarName)
                .ToListAsync();

                // Group by department and include all departments
                var result = allDepartments.Select(dept => new
                {
                    DepartmentId = dept.DepartmentID,
                    DepartmentName = dept.Subject,
                    Scholars = scholarsData
                        .Where(s => s.DepartmentId == dept.DepartmentID)
                        .Select(s => new
                        {
                            s.ScholarName,
                            s.ScholarShodhanikId,
                            s.SupervisorName,
                            s.SupervisorShodhanikId,
                            s.College
                        })
                        .ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Error fetching affiliated college scholars by department",
                    Error = ex.Message
                });
            }
        }

        /// <summary>
        /// Get all departments with their foreign nationality scholars
        /// Returns all departments with scholars data for foreign nationals (empty if no scholars)
        /// </summary>
        [HttpGet("ForeignScholarsByDepartment")]
        public async Task<ActionResult<object>> GetForeignScholarsByDepartment()
        {
            try
            {
                // Get all departments
                var allDepartments = await _context.Departments
                    .Where(d => d.Status == "Y")
                    .OrderBy(d => d.Subject)
                    .ToListAsync();

                // Get scholars with their details - foreign nationals only
                var scholarsData = await (
                    from s in _context.Scholars
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join ss in _context.ScholarSupervisors on s.SID equals ss.SID
                    join sr in _context.SupervisorRegistrations on ss.SUPID1 equals sr.SupId
                    join se in _context.SupervisorEducations on sr.SupId equals se.SupId
                    join sa in _context.SupervisorAuths on sr.SupId equals sa.SupId into saGroup
                    from sa in saGroup.DefaultIfEmpty()
                    join sauth in _context.ScholarAuths on s.SID equals sauth.SID into sauthGroup
                    from sauth in sauthGroup.DefaultIfEmpty()
                    join spd in _context.ScholarPersonalDetails on s.SID equals spd.SID into spdGroup
                    from spd in spdGroup.DefaultIfEmpty()
                    where spd != null && spd.Country != "India" && !string.IsNullOrEmpty(spd.Country)
                    select new
                    {
                        DepartmentId = d.DepartmentID,
                        DepartmentName = d.Subject,
                        ScholarName = s.Name,
                        ScholarShodhanikId = sauth != null ? sauth.PermUserName : s.SID.ToString(),
                        SupervisorName = sr.FullName,
                        SupervisorShodhanikId = sa != null ? sa.PermUserName : sr.SupId.ToString(),
                        College = se.CollegeName,
                        Country = spd.Country
                    }
                )
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.ScholarName)
                .ToListAsync();

                // Group by department and include all departments
                var result = allDepartments.Select(dept => new
                {
                    DepartmentId = dept.DepartmentID,
                    DepartmentName = dept.Subject,
                    Scholars = scholarsData
                        .Where(s => s.DepartmentId == dept.DepartmentID)
                        .Select(s => new
                        {
                            s.ScholarName,
                            s.ScholarShodhanikId,
                            s.SupervisorName,
                            s.SupervisorShodhanikId,
                            s.College,
                            s.Country
                        })
                        .ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Error fetching foreign scholars by department",
                    Error = ex.Message
                });
            }
        }

        /// <summary>
        /// Get all departments with their part-time scholars
        /// Returns all departments with scholars data for part-time scholars (empty if no scholars)
        /// </summary>
        [HttpGet("PartTimeScholarsByDepartment")]
        public async Task<ActionResult<object>> GetPartTimeScholarsByDepartment()
        {
            try
            {
                // Get all departments
                var allDepartments = await _context.Departments
                    .Where(d => d.Status == "Y")
                    .OrderBy(d => d.Subject)
                    .ToListAsync();

                // Get scholars with their details - part-time scholars only
                var scholarsData = await (
                    from s in _context.Scholars
                    join d in _context.Departments on s.Subject_ID equals d.DepartmentID
                    join ss in _context.ScholarSupervisors on s.SID equals ss.SID
                    join sr in _context.SupervisorRegistrations on ss.SUPID1 equals sr.SupId
                    join se in _context.SupervisorEducations on sr.SupId equals se.SupId
                    join sa in _context.SupervisorAuths on sr.SupId equals sa.SupId into saGroup
                    from sa in saGroup.DefaultIfEmpty()
                    join sauth in _context.ScholarAuths on s.SID equals sauth.SID into sauthGroup
                    from sauth in sauthGroup.DefaultIfEmpty()
                    where s.isPartTime == true
                    select new
                    {
                        DepartmentId = d.DepartmentID,
                        DepartmentName = d.Subject,
                        ScholarName = s.Name,
                        ScholarShodhanikId = sauth != null ? sauth.PermUserName : s.SID.ToString(),
                        SupervisorName = sr.FullName,
                        SupervisorShodhanikId = sa != null ? sa.PermUserName : sr.SupId.ToString(),
                        College = se.CollegeName
                    }
                )
                .OrderBy(x => x.DepartmentName)
                .ThenBy(x => x.ScholarName)
                .ToListAsync();

                // Group by department and include all departments
                var result = allDepartments.Select(dept => new
                {
                    DepartmentId = dept.DepartmentID,
                    DepartmentName = dept.Subject,
                    Scholars = scholarsData
                        .Where(s => s.DepartmentId == dept.DepartmentID)
                        .Select(s => new
                        {
                            s.ScholarName,
                            s.ScholarShodhanikId,
                            s.SupervisorName,
                            s.SupervisorShodhanikId,
                            s.College
                        })
                        .ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    Message = "Error fetching part-time scholars by department",
                    Error = ex.Message
                });
            }
        }
    }
}
