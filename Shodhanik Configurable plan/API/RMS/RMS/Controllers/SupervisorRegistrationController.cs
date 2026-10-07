using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mysqlx.Datatypes;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorRegistrationController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;
        private readonly IWorkflowService _workflowService;

        public SupervisorRegistrationController(RMSDbContext context, IConfiguration configuration, IEmailService emailService, IEmailTemplateService emailTemplateService, IWorkflowService workflowService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _emailTemplateService = emailTemplateService;
            _workflowService = workflowService;
        }

        // GET: api/SupRegs
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorRegistration>>> GetSupReg()
        {
            return await _context.SupervisorRegistrations.ToListAsync();
        }

        // GET: api/SupRegs/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorRegistration>> GetSupReg(int id)
        {
            var supReg = await _context.SupervisorRegistrations.FindAsync(id);

            if (supReg == null)
            {
                return NotFound();
            }

            return supReg;
        }

        [HttpGet("SupervisorforScholarSelect/{id}")]
        public async Task<ActionResult> GetSupervisorForScholarSelect(int id)
        {
            // 1. Get scholar
            var scholar = await _context.Scholars.FindAsync(id);
            if (scholar == null)
            {
                return NotFound("Scholar not found");
            }

            int subjectId = scholar.Subject_ID;

            // 2. Join SupervisorPersonal + SupervisorReg
            var supervisors = await (
                from sp in _context.SupervisorPersonal
                join sr in _context.SupervisorRegistrations
                    on sp.SupId equals sr.SupId
                where sr.IsAccepted == 1
                      && (
                            sp.PrimarySuperviseSubject == subjectId
                         || sp.SecSuperviseSubject1 == subjectId
                         || sp.SecSuperviseSubject2 == subjectId
                      )
                select new
                {
                    // Supervisor Personal
                    sp.SupId,
                    sr.FullName
                    //sr.Email,
                    //sr.MobileNo,
                    //sp.PrimarySuperviseSubject,
                    //sp.SecSuperviseSubject1,
                    //sp.SecSuperviseSubject2,

                    //// Supervisor Registration
                    //sr.IsAccepted,
                    //sr.ApplicationNumber
                }
            ).ToListAsync();

            return Ok(supervisors);
        }



        // PUT: api/SupRegs/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupReg(int id, SupervisorRegistration supReg)
        {
            if (id != supReg.SupId)
            {
                return BadRequest();
            }

            _context.Entry(supReg).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupRegExists(id))
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


        [HttpPost]
        public async Task<ActionResult<SupervisorRegistration>> PostSupReg([FromBody] SupervisorRegistration supReg)
        {
            if (supReg == null)
            {
                return BadRequest("Supervisor data is null.");
            }
            try {
                bool exists = await _context.SupervisorRegistrations
           .AnyAsync(s => (s.SupId == supReg.SupId && s.MobileNo == supReg.MobileNo) ||
                          (s.SupId == supReg.SupId && s.Email == supReg.Email));

                if (exists)
                {
                    return Conflict(new
                    {
                        message = "A record with the same MobileNo or Email already exists."
                    });
                }
                var verification = await _context.VerificationRequests
                 .FirstOrDefaultAsync(v =>
                v.Email == supReg.Email &&
                 v.MobileNo == supReg.MobileNo &&
              v.IsVerified == true);

                if (verification == null)
                {
                    return BadRequest("Email and phone not verified.");
                }

                var supervisor = await _context.SupervisorRegistrations
                 .FirstOrDefaultAsync(s => s.SupId == supReg.SupId);

                bool emailExists = await _context.SupervisorRegistrations
                                        .AnyAsync(s => s.Email == supReg.Email && s.Year == supReg.Year);

                if (emailExists)
                    return BadRequest("Email is already registered.");

                // 2. Check if Phone already exists
                bool phoneExists = await _context.SupervisorRegistrations
                                                 .AnyAsync(s => s.MobileNo == supReg.MobileNo && s.Year == supReg.Year);

                if (phoneExists)
                    return BadRequest("Phone number is already registered.");

                _context.SupervisorRegistrations.Add(supReg);
                await _context.SaveChangesAsync();
                var yearPrefix = DateTime.Now.ToString("yy"); // "25" for 2025
                int id = supReg.SupId; // or your record ID

                int currentYear = DateTime.Now.Year;
                string yearRange = $"{currentYear}-{currentYear + 1}";
                supReg.Year = yearRange;
                // Format: 25 + zero padding (to make total 8 digits before ID)
                var applicationNumber = $"{yearPrefix}{id.ToString("D6")}";
                supReg.ApplicationNumber = applicationNumber;
                await _context.SaveChangesAsync();
                string password = Passwordgen.GeneratePassword();
                var supervisorAuth = new SupervisorAuth
                {
                    SupId = supReg.SupId,
                    TempPassword = password,// In a real application, ensure to hash passwords and use a secure method for setting them.
                    isTempAutoGen = true,
                };
                _context.SupervisorAuths.Add(supervisorAuth);
                _context.VerificationRequests.Remove(verification);
                await _context.SaveChangesAsync();

                var tokens = new Dictionary<string, string>
             {
              { "name", supReg.FullName },
              { "regno", supReg.ApplicationNumber },
               { "pwd", password }
             };
                var (subject, body) = await _emailTemplateService.RenderAsync(1008, tokens);
                string result = _emailService.SendEmail(supReg.Email, "CCSU", body);

                return CreatedAtAction("GetSupReg", new { id = supReg.SupId }, supReg);
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
       

        public class UpdateSupervisorContactDto
        {
            public string? Email { get; set; }
            public string? MobileNo { get; set; }
        }


     

        // DELETE: api/SupRegs/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupReg(int id)
        {
            var supReg = await _context.SupervisorRegistrations.FindAsync(id);
            if (supReg == null)
            {
                return NotFound();
            }

            _context.SupervisorRegistrations.Remove(supReg);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupRegExists(int id)
        {
            return _context.SupervisorRegistrations.Any(e => e.SupId == id);
        }
    }
}
