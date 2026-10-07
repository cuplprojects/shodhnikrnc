using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    public class SupervisorExperienceController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public SupervisorExperienceController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/SupervisorExperience
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorExperience>>> GetSupervisorExperiences()
        {
            return await _context.SupervisorExperiences.ToListAsync();
        }

        // GET: api/SupervisorExperience/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorExperience>> GetSupervisorExperience(int id)
        {
            var supervisorExperience = await _context.SupervisorExperiences.FindAsync(id);

            if (supervisorExperience == null)
            {
                return NotFound();
            }

            return supervisorExperience;
        }

        // PUT: api/SupervisorExperience/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupervisorExperience(
       int id,
       [FromForm] SupervisorExperience experience,
       IFormFile? experienceDoc,
       [FromServices] IFileStorageService fileStorageService)
        {
            try
            {
                var existing = await _context.SupervisorExperiences
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (existing == null)
                    return NotFound(new { message = "Experience not found" });

                // Update normal fields
                existing.OrganizationName = experience.OrganizationName;
                existing.Designation = experience.Designation;
                existing.DateFrom = experience.DateFrom;
                existing.DateTo = experience.DateTo;
                existing.NatureOfDuties = experience.NatureOfDuties;
                existing.ResExperience = experience.ResExperience;
                existing.Category = experience.Category;
                existing.AreaOfSpec = experience.AreaOfSpec;

                // File handling
                if (experienceDoc != null)
                {
                    if (!string.IsNullOrEmpty(existing.Doc))
                    {
                        // Delete old file first
                        await fileStorageService.DeleteAsync(existing.Doc);
                    }
                    
                    // Save new file
                    existing.Doc = await fileStorageService.SaveAsync(
                        experienceDoc,
                        subFolder: "supervisor-experience",
                        filePrefix: $"SUP_{existing.SupId}_{DateTime.UtcNow.Ticks}"
                    );
                }

                var existingStatus = await _context.SupervisorApplicationStatuses
               .FirstOrDefaultAsync(s => s.SupId == experience.SupId);
                var reg = await _context.SupervisorRegistrations
               .FirstOrDefaultAsync(s => s.SupId == experience.SupId);
                if (existingStatus != null && reg.IsAccepted==0)
                {
                    bool wasStep2AlreadyTrue = existingStatus.Step_3;

                    // Always update Step_2
                    existingStatus.Step_3 = true;
                    existingStatus.Step_3At = DateTime.UtcNow;

                    _context.SupervisorApplicationStatuses.Update(existingStatus);

                    // If Step_2 was already true, reset screening status
                    if (wasStep2AlreadyTrue)
                    {
                        var screeningStatus = await _context.SupervisorScreenings
                            .FirstOrDefaultAsync(s => s.SupId == experience.SupId);

                        if (screeningStatus != null)
                        {
                            screeningStatus.Screening1Status = 0; // reset only
                            screeningStatus.Screening2Status = 0;
                            screeningStatus.Screening3Status = 0;
                            screeningStatus.Screening4Status = 0;
                            screeningStatus.Screening5Status = 0;
                            screeningStatus.Screening6Status = 0;
                            _context.SupervisorScreenings.Update(screeningStatus);
                        }
                    }
                }
                await _context.SaveChangesAsync();

                return Ok(existing);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Error updating supervisor experience",
                    error = ex.Message
                });
            }
        }


        [HttpGet("BySupervisor")]
        public async Task<IActionResult> GetSupervisorAllExperiences(int supid)
        {
            var experiences = await _context.SupervisorExperiences
                .Where(x => x.SupId == supid)
                .ToListAsync();

            if (experiences == null || experiences.Count == 0)
            {
                return Ok(new
                {
                    Experiences = new List<SupervisorExperience>(),
                    TotalExperience = "0 years 0 months 0 days"
                });
            }

            int totalYears = 0;
            int totalMonths = 0;
            int totalDays = 0;

            foreach (var exp in experiences)
            {
                if (string.IsNullOrWhiteSpace(exp.ResExperience))
                    continue;

                var parts = exp.ResExperience.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                for (int i = 0; i < parts.Length - 1; i++)
                {
                    if (!int.TryParse(parts[i], out int value))
                        continue;

                    var unit = parts[i + 1].ToLower();

                    if (unit.StartsWith("year"))
                        totalYears += value;
                    else if (unit.StartsWith("month"))
                        totalMonths += value;
                    else if (unit.StartsWith("day"))
                        totalDays += value;
                }
            }

            // Normalize days → months (30 days = 1 month)
            totalMonths += totalDays / 30;
            totalDays = totalDays % 30;

            // Normalize months → years (12 months = 1 year)
            totalYears += totalMonths / 12;
            totalMonths = totalMonths % 12;

            return Ok(new
            {
                Experiences = experiences,
                TotalExperience = $"{totalYears} years {totalMonths} months {totalDays} days"
            });
        }


        // POST: api/SupervisorExperience
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorExperience>> PostSupervisorExperience(
     [FromForm] SupervisorExperience supervisorExperience,
     IFormFile? experienceDoc,
     [FromServices] IFileStorageService fileStorageService)
        {
            try
            {

                var newFrom = supervisorExperience.DateFrom;
                var newTo = supervisorExperience.DateTo ?? DateTime.MaxValue;

                bool isOverlapping = await _context.SupervisorExperiences
                    .AnyAsync(e =>
                        e.SupId == supervisorExperience.SupId &&
                        e.DateFrom <= newTo &&
                        (e.DateTo ?? DateTime.MaxValue) >= newFrom
                    );

                if (isOverlapping)
                {
                    return BadRequest(new
                    {
                        message = "Supervisor experience tenure overlaps with existing records."
                    });
                }
                // Handle file upload
                if (experienceDoc != null)
                {
                    supervisorExperience.Doc =
                        await fileStorageService.SaveAsync(
                            experienceDoc,
                            subFolder: "supervisor-experience",
                            filePrefix: $"SUP_{supervisorExperience.SupId}_{DateTime.UtcNow.Ticks}"
                        );
                }

                _context.SupervisorExperiences.Add(supervisorExperience);
                var existingStatus = await _context.SupervisorApplicationStatuses
           .FirstOrDefaultAsync(s => s.SupId == supervisorExperience.SupId);
                var reg = await _context.SupervisorRegistrations
               .FirstOrDefaultAsync(s => s.SupId == supervisorExperience.SupId);
                if (existingStatus != null && reg.IsAccepted == 0)
                {
                    bool wasStep2AlreadyTrue = existingStatus.Step_3;

                    // Always update Step_2
                    existingStatus.Step_3 = true;
                    existingStatus.Step_3At = DateTime.UtcNow;

                    _context.SupervisorApplicationStatuses.Update(existingStatus);

                    // If Step_2 was already true, reset screening status
                    if (wasStep2AlreadyTrue)
                    {
                        var screeningStatus = await _context.SupervisorScreenings
                            .FirstOrDefaultAsync(s => s.SupId == supervisorExperience.SupId);

                        if (screeningStatus != null)
                        {
                            screeningStatus.Screening1Status = 0; // reset only
                            screeningStatus.Screening2Status = 0;
                            screeningStatus.Screening3Status = 0;
                            screeningStatus.Screening4Status = 0;
                            screeningStatus.Screening5Status = 0;
                            screeningStatus.Screening6Status = 0;
                            _context.SupervisorScreenings.Update(screeningStatus);
                        }
                    }
                }
                await _context.SaveChangesAsync();

                return CreatedAtAction(
                    nameof(GetSupervisorAllExperiences),
                    new { supid = supervisorExperience.SupId },
                    supervisorExperience
                );
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Error saving supervisor experience",
                    error = ex.Message
                });
            }
        }


        // DELETE: api/SupervisorExperience/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupervisorExperience(int id)
        {
            var supervisorExperience = await _context.SupervisorExperiences.FindAsync(id);
            if (supervisorExperience == null)
            {
                return NotFound();
            }

            _context.SupervisorExperiences.Remove(supervisorExperience);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupervisorExperienceExists(int id)
        {
            return _context.SupervisorExperiences.Any(e => e.Id == id);
        }
    }
}
