using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SupervisorResearchController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public SupervisorResearchController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // GET: api/SupRes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorResearch>>> GetSupRes()
        {
            return await _context.SupervisorResearches.ToListAsync();
        }

        [HttpGet("Supervisor")]
        public async Task<ActionResult<IEnumerable<SupervisorResearch>>> GetResearchBysupId(int supId)
        {
            return await _context.SupervisorResearches.Where(s=>s.SupId == supId).ToListAsync();
        }


        // GET: api/SupRes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorResearch>> GetSupRes(int id)
        {
            var supRes = await _context.SupervisorResearches.FindAsync(id);

            if (supRes == null)
            {
                return NotFound();
            }

            return supRes;
        }

        // PUT: api/SupRes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupRes(
     int id,
     [FromForm] SupervisorResearch supRes,
     IFormFile uploadPaper)
        {
            if (id != supRes.Id)
            {
                return BadRequest();
            }
            bool exists = await _context.SupervisorResearches
          .AnyAsync(s => (s.SupId == supRes.SupId && s.IssNo == supRes.IssNo) ||
                      (s.SupId == supRes.SupId && s.WebUrl == supRes.WebUrl));

            if (exists)
            {
                return Conflict(new
                {
                    message = "A record with the same Supervisor ID and Issue Number or WebUrl already exists."
                });
            }

            // Get existing record
            var existingSupRes = await _context.SupervisorResearches
                                               .AsNoTracking()
                                               .FirstOrDefaultAsync(x => x.Id == id);

            if (existingSupRes == null)
            {
                return NotFound();
            }

            // Handle file upload (only if a new file is provided)
            if (uploadPaper != null)
            {
                var folderPath = _fileService.GetUploadPath("Supervisor");

                if (!Directory.Exists(folderPath))
                    Directory.CreateDirectory(folderPath);

                var supFolder = Path.Combine(folderPath, supRes.SupId.ToString());

                if (!Directory.Exists(supFolder))
                    Directory.CreateDirectory(supFolder);

                if (!string.IsNullOrEmpty(existingSupRes.UploadPaper))
                {
                    var oldFilePath = Path.Combine(
                        existingSupRes.UploadPaper.Replace("/", Path.DirectorySeparatorChar.ToString())
                    );

                    if (System.IO.File.Exists(oldFilePath))
                    {
                        System.IO.File.Delete(oldFilePath);
                    }
                }

                var filePath = Path.Combine(supFolder, uploadPaper.FileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await uploadPaper.CopyToAsync(stream);
                }

                // Save relative path in DB
                supRes.UploadPaper = Path.Combine(
                    "Supervisor",
                    supRes.SupId.ToString(),
                    uploadPaper.FileName
                ).Replace("\\", "/");
            }
            else
            {
                // Keep existing file if no new upload
                supRes.UploadPaper = existingSupRes.UploadPaper;
            }

            _context.Entry(supRes).State = EntityState.Modified;
            var existingStatus = await _context.SupervisorApplicationStatuses
                .FirstOrDefaultAsync(s => s.SupId == supRes.SupId);
            if (existingStatus.Step_4 == true)
            {
                var screeningStatus = await _context.SupervisorScreenings
                    .FirstOrDefaultAsync(s => s.SupId == supRes.SupId);

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

            try
            {
                await _context.SaveChangesAsync();
              
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupResExists(id))
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




        // POST: api/SupRes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<SupervisorResearch>> PostSupRes([FromForm] SupervisorResearch supRes, IFormFile uploadPaper)
        {
            bool exists = await _context.SupervisorResearches
         .AnyAsync(s => (s.SupId == supRes.SupId && s.IssNo == supRes.IssNo) ||
                      (s.SupId == supRes.SupId && s.WebUrl == supRes.WebUrl));

            if (exists)
            {
                return Conflict(new
                {
                    message = "A record with the same Issue Number or WebUrl already exists."
                });
            }
            if (uploadPaper != null)
            {
                var folderPath = _fileService.GetUploadPath("Supervisor");

                if (!Directory.Exists(folderPath))
                    Directory.CreateDirectory(folderPath);
                var supFolder = Path.Combine(folderPath, supRes.SupId.ToString());

                if (!Directory.Exists(supFolder))
                    Directory.CreateDirectory(supFolder);

                var filePath = Path.Combine(supFolder, uploadPaper.FileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await uploadPaper.CopyToAsync(stream);
                }

                // Save relative path in DB
                supRes.UploadPaper = Path.Combine(
                    "Supervisor",
              supRes.SupId.ToString(),
              uploadPaper.FileName
             ).Replace("\\", "/");
            }

            _context.SupervisorResearches.Add(supRes);
            var existingStatus = await _context.SupervisorApplicationStatuses
                                .FirstOrDefaultAsync(s => s.SupId == supRes.SupId);

            if (existingStatus != null)
            {
                bool wasStep2AlreadyTrue = existingStatus.Step_4;

                // Always update Step_2
                existingStatus.Step_4 = true;
                existingStatus.Step_4At = DateTime.UtcNow;

                _context.SupervisorApplicationStatuses.Update(existingStatus);

                // If Step_2 was already true, reset screening status
                if (wasStep2AlreadyTrue)
                {
                    var screeningStatus = await _context.SupervisorScreenings
                        .FirstOrDefaultAsync(s => s.SupId == supRes.SupId);

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

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // This is extra safety in case unique index triggers
                return Conflict(new { message = "Duplicate record detected.", details = ex.Message });
            }

            return CreatedAtAction("GetSupRes", new { id = supRes.Id }, supRes);

        }

        // DELETE: api/SupRes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupRes(int id)
        {
            var supRes = await _context.SupervisorResearches.FindAsync(id);
            if (supRes == null)
            {
                return NotFound();
            }

            _context.SupervisorResearches.Remove(supRes);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupResExists(int id)
        {
            return _context.SupervisorResearches.Any(e => e.Id == id);
        }
    }
}
