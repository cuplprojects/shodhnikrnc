using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DorWebsiteController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public DorWebsiteController(RMSDbContext context)
        {
            _context = context;
        }
        [HttpGet("ExistingSupervisor")]
        public async Task<ActionResult> GetExistingSupervisor()
        {
            var supervisors = await (
                from sp in _context.SupervisorPersonal
                join sr in _context.SupervisorRegistrations
                    on sp.SupId equals sr.SupId
                join sa in _context.SupervisorAuths
                    on sp.SupId equals sa.SupId   // Auth table join
                where sr.IsAccepted == 1
                      && sr.Active == true
                select new
                {
                    // Supervisor Personal
                    sp.SupId,
                    sr.FullName,
                    sp.Designation,
                    sp.PrimarySuperviseSubject,
                    // Registration
                    sr.MobileNo,
                    sr.Email,
                    sa.PermUserName,
                }
            ).ToListAsync();

            if (!supervisors.Any())
            {
                return NotFound("No supervisors found");
            }

            return Ok(supervisors);
        }
    }
}
