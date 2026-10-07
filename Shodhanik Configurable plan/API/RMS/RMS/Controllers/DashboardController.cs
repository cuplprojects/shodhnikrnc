/*using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using System.Security.Claims;

//namespace RMS.Controllers
//{
//    [Route("api/[controller]")]
//    [ApiController]
//    [Authorize]
//    public class DashboardController : ControllerBase
//    {
//        private readonly RMSDbContext _context;

//        public DashboardController(RMSDbContext context)
//        {
//            _context = context;
//        }

//        [HttpGet("admin")]
//        public async Task<IActionResult> GetAdminDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetAdminStats();
//                var config = GetAdminDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "Admin" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("supervisor")]
//        public async Task<IActionResult> GetSupervisorDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetSupervisorStats();
//                var config = GetSupervisorDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "Supervisor" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("scholar")]
//        public async Task<IActionResult> GetScholarDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetScholarStats(userId.Value);
//                var config = GetScholarDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "Scholar" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("registrar")]
//        public async Task<IActionResult> GetRegistrarDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetRegistrarStats();
//                var config = GetRegistrarDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "Registrar" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("vcoffice")]
//        public async Task<IActionResult> GetVCOfficeDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetVCOfficeStats();
//                var config = GetVCOfficeDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "VCOffice" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("office")]
//        public async Task<IActionResult> GetOfficeDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetOfficeStats();
//                var config = GetOfficeDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "Office" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("superadmin")]
//        public async Task<IActionResult> GetSuperAdminDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetSuperAdminStats();
//                var config = GetSuperAdminDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "SuperAdmin" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("supervisorcell")]
//        public async Task<IActionResult> GetSupervisorCellDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetSupervisorCellStats();
//                var config = GetSupervisorCellDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "SupervisorCell" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        [HttpGet("externalconfidential")]
//        public async Task<IActionResult> GetExternalConfidentialDashboard()
//        {
//            try
//            {
//                var userId = GetUserIdFromToken();
//                if (userId == null)
//                    return Unauthorized("Invalid token");

//                var stats = await GetExternalConfidentialStats();
//                var config = GetExternalConfidentialDashboardConfig();

//                var response = new
//                {
//                    userId = userId,
//                    roleNames = new[] { "ExternalConfidential" },
//                    stats = stats,
//                    config = config
//                };

//                return Ok(response);
//            }
//            catch (Exception ex)
//            {
//                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
//            }
//        }

//        private int? GetUserIdFromToken()
//        {
//            var userIdClaim = HttpContext.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name);
//            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
//            {
//                return null;
//            }
//            return userId;
//        }

//        //private async Task<Dictionary<string, object>> GetAdminStats()
//        //{
//        //    var stats = new Dictionary<string, object>();

//        //    // Common stats
//        //    stats["totalScholars"] = await _context.Scholars.CountAsync();
//        //    stats["totalSupervisors"] = await _context.SupervisorRegistrations.CountAsync();

//        //    // Admin specific stats
//        //    stats["pendingScholarApplications"] = await _context.Scholars
//        //        .Where(s => s.Decision == null || s.Decision == 0)
//        //        .CountAsync();
            
//        //    stats["approvedScholars"] = await _context.Scholars
//        //        .Where(s => s.Decision == 1)
//        //        .CountAsync();
            
//        //    stats["rejectedScholars"] = await _context.Scholars
//        //        .Where(s => s.Decision == 2)
//        //        .CountAsync();
            
//        //    stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//        //        .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//        //        .CountAsync();
            
//        //    stats["approvedSupervisors"] = await _context.SupervisorRegistrations
//        //        .Where(s => s.IsAccepted == 1)
//        //        .CountAsync();
            
//        //    stats["rejectedSupervisors"] = await _context.SupervisorRegistrations
//        //        .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//        //                   (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//        //        .CountAsync();
            
//        //    stats["reappliedSupervisors"] = await _context.SupervisorRegistrations
//        //        .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//        //        .CountAsync();

//        //    // Recent applications (current year)
//        //    var currentYear = DateTime.Now.Year.ToString();
//        //    stats["recentScholarApplications"] = await _context.Scholars
//        //        .Where(s => s.Year == currentYear)
//        //        .CountAsync();
            
//        //    stats["recentSupervisorApplications"] = await _context.SupervisorRegistrations
//        //        .Where(s => s.Year == currentYear)
//        //        .CountAsync();

//        //    return stats;
//        //}

//        private async Task<Dictionary<string, object>> GetSupervisorStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // Supervisor Cell specific stats
//            stats["totalSupervisorApplications"] = await _context.SupervisorRegistrations.CountAsync();
            
//            stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//                .CountAsync();
            
//            stats["approvedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 1)
//                .CountAsync();
            
//            stats["rejectedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//                           (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//                .CountAsync();
            
//            stats["reappliedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//                .CountAsync();

//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetScholarStats(int userId)
//        {
//            var stats = new Dictionary<string, object>();

//            // Get scholar's application status
//            var scholar = await _context.Scholars.FirstOrDefaultAsync(s => s.SID == userId);
            
//            if (scholar != null)
//            {
//                stats["myApplicationStatus"] = scholar.Decision switch
//                {
//                    1 => "Approved",
//                    2 => "Rejected",
//                    _ => "Pending"
//                };
//            }
//            else
//            {
//                stats["myApplicationStatus"] = "Not Applied";
//            }

//            // Count documents (this would need to be implemented based on your document structure)
//            stats["documentsUploaded"] = 0; // Implement based on your document upload system
//            stats["documentsRequired"] = 5; // Set based on your requirements

//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetRegistrarStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // Registrar gets blank/empty stats as requested
//            // No data should be shown for registrar role
            
//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetVCOfficeStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // VCOffice specific stats - Both scholar and supervisor data (like admin but may have different focus)
//            stats["totalScholars"] = await _context.Scholars.CountAsync();
//            stats["totalSupervisors"] = await _context.SupervisorRegistrations.CountAsync();

//            stats["pendingScholarApplications"] = await _context.Scholars
//                .Where(s => s.Decision == null || s.Decision == 0)
//                .CountAsync();
            
//            stats["approvedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 1)
//                .CountAsync();
            
//            stats["rejectedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 2)
//                .CountAsync();
            
//            stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//                .CountAsync();
            
//            stats["approvedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 1)
//                .CountAsync();
            
//            stats["rejectedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//                           (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//                .CountAsync();
            
//            stats["reappliedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//                .CountAsync();

//            // Recent applications (current year)
//            var currentYear = DateTime.Now.Year.ToString();
//            stats["recentScholarApplications"] = await _context.Scholars
//                .Where(s => s.Year == currentYear)
//                .CountAsync();
            
//            stats["recentSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.Year == currentYear)
//                .CountAsync();

//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetOfficeStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // Office gets blank/empty stats as requested (same as registrar)
//            // No data should be shown for office role
            
//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetSuperAdminStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // SuperAdmin gets full admin data
//            stats["totalScholars"] = await _context.Scholars.CountAsync();
//            stats["totalSupervisors"] = await _context.SupervisorRegistrations.CountAsync();

//            stats["pendingScholarApplications"] = await _context.Scholars
//                .Where(s => s.Decision == null || s.Decision == 0)
//                .CountAsync();
            
//            stats["approvedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 1)
//                .CountAsync();
            
//            stats["rejectedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 2)
//                .CountAsync();
            
//            stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//                .CountAsync();
            
//            stats["approvedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 1)
//                .CountAsync();
            
//            stats["rejectedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//                           (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//                .CountAsync();
            
//            stats["reappliedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//                .CountAsync();

//            var currentYear = DateTime.Now.Year.ToString();
//            stats["recentScholarApplications"] = await _context.Scholars
//                .Where(s => s.Year == currentYear)
//                .CountAsync();
            
//            stats["recentSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.Year == currentYear)
//                .CountAsync();

//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetSupervisorCellStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // SupervisorCell gets only supervisor data
//            stats["totalSupervisorApplications"] = await _context.SupervisorRegistrations.CountAsync();
            
//            stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//                .CountAsync();
            
//            stats["approvedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 1)
//                .CountAsync();
            
//            stats["rejectedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//                           (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//                .CountAsync();
            
//            stats["reappliedSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//                .CountAsync();

//            return stats;
//        }

//        private async Task<Dictionary<string, object>> GetExternalConfidentialStats()
//        {
//            var stats = new Dictionary<string, object>();

//            // ExternalConfidential gets full admin data (same as SuperAdmin)
//            stats["totalScholars"] = await _context.Scholars.CountAsync();
//            stats["totalSupervisors"] = await _context.SupervisorRegistrations.CountAsync();

//            stats["pendingScholarApplications"] = await _context.Scholars
//                .Where(s => s.Decision == null || s.Decision == 0)
//                .CountAsync();
            
//            stats["approvedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 1)
//                .CountAsync();
            
//            stats["rejectedScholars"] = await _context.Scholars
//                .Where(s => s.Decision == 2)
//                .CountAsync();
            
//            stats["pendingSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && (s.RejectReason == null || s.RejectReason == ""))
//                .CountAsync();
            
//            stats["approvedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 1)
//                .CountAsync();
            
//            stats["rejectedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => (s.IsAccepted == 2 && !string.IsNullOrEmpty(s.RejectReason)) || 
//                           (s.IsAccepted == 3 && !string.IsNullOrEmpty(s.RejectReason)))
//                .CountAsync();
            
//            stats["reappliedSupervisors"] = await _context.SupervisorRegistrations
//                .Where(s => s.IsAccepted == 0 && !string.IsNullOrEmpty(s.RejectReason))
//                .CountAsync();

//            var currentYear = DateTime.Now.Year.ToString();
//            stats["recentScholarApplications"] = await _context.Scholars
//                .Where(s => s.Year == currentYear)
//                .CountAsync();
            
//            stats["recentSupervisorApplications"] = await _context.SupervisorRegistrations
//                .Where(s => s.Year == currentYear)
//                .CountAsync();

//            return stats;
//        }

//        private object GetAdminDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalScholars", title = "Total Scholars", subtitle = "All registered scholars" },
//                    new { key = "pendingScholarApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedScholars", title = "Approved Scholars", subtitle = "Successfully approved" },
//                    new { key = "rejectedScholars", title = "Rejected Applications", subtitle = "Applications rejected" },
//                    new { key = "totalSupervisors", title = "Total Supervisors", subtitle = "All registered supervisors" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Supervisor Applications", subtitle = "Awaiting approval" },
//                    new { key = "approvedSupervisors", title = "Approved Supervisors", subtitle = "Active supervisors" },
//                    new { key = "rejectedSupervisors", title = "Rejected Supervisor Applications", subtitle = "Applications rejected" },
//                    new { key = "reappliedSupervisors", title = "Reapplied Supervisors", subtitle = "Reapplied after rejection" },
//                    new { key = "recentScholarApplications", title = "Recent Scholar Applications", subtitle = "Current year" },
//                    new { key = "recentSupervisorApplications", title = "Recent Supervisor Applications", subtitle = "Current year" }
//                }
//            };
//        }

//        private object GetSupervisorDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalSupervisorApplications", title = "Total Supervisor Applications", subtitle = "All applications" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedSupervisorApplications", title = "Approved Applications", subtitle = "Approved" },
//                    new { key = "rejectedSupervisorApplications", title = "Rejected Applications", subtitle = "Rejected" },
//                    new { key = "reappliedSupervisorApplications", title = "Reapplied Applications", subtitle = "Reapplied after rejection" }
//                }
//            };
//        }

//        private object GetScholarDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "myApplicationStatus", title = "Application Status", subtitle = "Current status" },
//                    new { key = "documentsUploaded", title = "Documents Uploaded", subtitle = "Files uploaded" },
//                    new { key = "documentsRequired", title = "Documents Required", subtitle = "Still needed" }
//                }
//            };
//        }

//        private object GetRegistrarDashboardConfig()
//        {
//            return new
//            {
//                sections = new object[] { }
//            };
//        }

//        private object GetOfficeDashboardConfig()
//        {
//            return new
//            {
//                sections = new object[] { }
//            };
//        }

//        private object GetSuperAdminDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalScholars", title = "Total Scholars", subtitle = "All registered scholars" },
//                    new { key = "pendingScholarApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedScholars", title = "Approved Scholars", subtitle = "Successfully approved" },
//                    new { key = "rejectedScholars", title = "Rejected Applications", subtitle = "Applications rejected" },
//                    new { key = "totalSupervisors", title = "Total Supervisors", subtitle = "All registered supervisors" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Supervisor Applications", subtitle = "Awaiting approval" },
//                    new { key = "approvedSupervisors", title = "Approved Supervisors", subtitle = "Active supervisors" },
//                    new { key = "rejectedSupervisors", title = "Rejected Supervisor Applications", subtitle = "Applications rejected" },
//                    new { key = "reappliedSupervisors", title = "Reapplied Supervisors", subtitle = "Reapplied after rejection" },
//                    new { key = "recentScholarApplications", title = "Recent Scholar Applications", subtitle = "Current year" },
//                    new { key = "recentSupervisorApplications", title = "Recent Supervisor Applications", subtitle = "Current year" }
//                }
//            };
//        }

//        private object GetSupervisorCellDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalSupervisorApplications", title = "Total Supervisor Applications", subtitle = "All applications" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedSupervisorApplications", title = "Approved Applications", subtitle = "Approved" },
//                    new { key = "rejectedSupervisorApplications", title = "Rejected Applications", subtitle = "Rejected" },
//                    new { key = "reappliedSupervisorApplications", title = "Reapplied Applications", subtitle = "Reapplied after rejection" }
//                }
//            };
//        }

//        private object GetExternalConfidentialDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalScholars", title = "Total Scholars", subtitle = "All registered scholars" },
//                    new { key = "pendingScholarApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedScholars", title = "Approved Scholars", subtitle = "Successfully approved" },
//                    new { key = "rejectedScholars", title = "Rejected Applications", subtitle = "Applications rejected" },
//                    new { key = "totalSupervisors", title = "Total Supervisors", subtitle = "All registered supervisors" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Supervisor Applications", subtitle = "Awaiting approval" },
//                    new { key = "approvedSupervisors", title = "Approved Supervisors", subtitle = "Active supervisors" },
//                    new { key = "rejectedSupervisors", title = "Rejected Supervisor Applications", subtitle = "Applications rejected" },
//                    new { key = "reappliedSupervisors", title = "Reapplied Supervisors", subtitle = "Reapplied after rejection" },
//                    new { key = "recentScholarApplications", title = "Recent Scholar Applications", subtitle = "Current year" },
//                    new { key = "recentSupervisorApplications", title = "Recent Supervisor Applications", subtitle = "Current year" }
//                }
//            };
//        }

//        private object GetVCOfficeDashboardConfig()
//        {
//            return new
//            {
//                cards = new object[]
//                {
//                    new { key = "totalScholars", title = "Total Scholars", subtitle = "All registered scholars" },
//                    new { key = "pendingScholarApplications", title = "Pending Applications", subtitle = "Awaiting review" },
//                    new { key = "approvedScholars", title = "Approved Scholars", subtitle = "Successfully approved" },
//                    new { key = "rejectedScholars", title = "Rejected Applications", subtitle = "Applications rejected" },
//                    new { key = "totalSupervisors", title = "Total Supervisors", subtitle = "All registered supervisors" },
//                    new { key = "pendingSupervisorApplications", title = "Pending Supervisor Applications", subtitle = "Awaiting approval" },
//                    new { key = "approvedSupervisors", title = "Approved Supervisors", subtitle = "Active supervisors" },
//                    new { key = "rejectedSupervisors", title = "Rejected Supervisor Applications", subtitle = "Applications rejected" },
//                    new { key = "reappliedSupervisors", title = "Reapplied Supervisors", subtitle = "Reapplied after rejection" },
//                    new { key = "recentScholarApplications", title = "Recent Scholar Applications", subtitle = "Current year" },
//                    new { key = "recentSupervisorApplications", title = "Recent Supervisor Applications", subtitle = "Current year" }
//                }
//            };
//        }
//    }
//}
        private object GetVCOfficeDashboardConfig()
        {
            return new
            {
                cards = new object[]
                {
                    new { key = "totalScholars", title = "Total Scholars", subtitle = "All registered scholars" },
                    new { key = "pendingScholarApplications", title = "Pending Applications", subtitle = "Awaiting review" },
                    new { key = "approvedScholars", title = "Approved Scholars", subtitle = "Successfully approved" },
                    new { key = "rejectedScholars", title = "Rejected Applications", subtitle = "Applications rejected" },
                    new { key = "totalSupervisors", title = "Total Supervisors", subtitle = "All registered supervisors" },
                    new { key = "pendingSupervisorApplications", title = "Pending Supervisor Applications", subtitle = "Awaiting approval" },
                    new { key = "approvedSupervisors", title = "Approved Supervisors", subtitle = "Active supervisors" },
                    new { key = "rejectedSupervisors", title = "Rejected Supervisor Applications", subtitle = "Applications rejected" },
                    new { key = "reappliedSupervisors", title = "Reapplied Supervisors", subtitle = "Reapplied after rejection" },
                    new { key = "recentScholarApplications", title = "Recent Scholar Applications", subtitle = "Current year" },
                    new { key = "recentSupervisorApplications", title = "Recent Supervisor Applications", subtitle = "Current year" }
                }
            };
        }
    }
}*/
