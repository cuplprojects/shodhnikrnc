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
    public class SupervisorUploadsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;

        public SupervisorUploadsController(RMSDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // GET: api/SupUploads
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupervisorUpload>>> GetSupUploads()
        {
            return await _context.SupervisorUploads.ToListAsync();
        }

        // GET: api/SupUploads/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupervisorUpload>> GetSupUpload(int id)
        {
            var supUpload = await _context.SupervisorUploads.FirstOrDefaultAsync(i=>i.SupId==id);

            if (supUpload == null)
            {
                return NotFound();
            }

            return supUpload;
        }

        // PUT: api/SupUploads/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupUpload(int id, SupervisorUpload supUpload)
        {
            if (id != supUpload.Id)
            {
                return BadRequest();
            }

            _context.Entry(supUpload).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SupUploadExists(id))
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

        public class UploadDocumentsDto
        {
            public int SupId { get; set; }

            public IFormFile? Photo { get; set; }
            public IFormFile? Signature { get; set; }
            public IFormFile? AppLetter { get; set; }
            public IFormFile? IdentityProof { get; set; }
            public IFormFile? ApaarId { get; set; }
        }

        [HttpPost("UploadDocuments")]
        public async Task<IActionResult> UploadDocuments(
      [FromForm] UploadDocumentsDto dto,
      [FromServices] IFileStorageService fileStorageService)
        {
            // 1️⃣ Get existing uploads
            var existingList = await _context.SupervisorUploads
                .Where(s => s.SupId == dto.SupId)
                .ToListAsync();

            // 2️⃣ Delete old files + DB records
            if (existingList.Any())
            {
                foreach (var item in existingList)
                {
                    foreach (var path in new[]
                    {
                item.Photo,
                item.Sign,
                item.AppLetter,
                item.IdentityProof,
                item.ApaarId
            })
                    {
                        if (!string.IsNullOrWhiteSpace(path))
                        {
                            await fileStorageService.DeleteAsync(path);
                        }
                    }
                }

                _context.SupervisorUploads.RemoveRange(existingList);
                await _context.SaveChangesAsync();
            }

            // 3️⃣ Create new upload record
            var doc = new SupervisorUpload
            {
                SupId = dto.SupId
            };

            // 4️⃣ Save files (same pattern as experience)
            if (dto.Photo != null)
            {
                doc.Photo = await fileStorageService.SaveAsync(
                    dto.Photo,
                    subFolder: "supervisor/photos",
                    filePrefix: $"SUP_{dto.SupId}_PHOTO_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.Signature != null)
            {
                doc.Sign = await fileStorageService.SaveAsync(
                    dto.Signature,
                    subFolder: "supervisor/signatures",
                    filePrefix: $"SUP_{dto.SupId}_SIGN_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.AppLetter != null)
            {
                doc.AppLetter = await fileStorageService.SaveAsync(
                    dto.AppLetter,
                    subFolder: "supervisor/app-letter",
                    filePrefix: $"SUP_{dto.SupId}_APP_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.IdentityProof != null)
            {
                doc.IdentityProof = await fileStorageService.SaveAsync(
                    dto.IdentityProof,
                    subFolder: "supervisor/identity-proof",
                    filePrefix: $"SUP_{dto.SupId}_ID_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.ApaarId != null)
            {
                doc.ApaarId = await fileStorageService.SaveAsync(
                    dto.ApaarId,
                    subFolder: "supervisor/apaar",
                    filePrefix: $"SUP_{dto.SupId}_APAAR_{DateTime.UtcNow.Ticks}"
                );
            }

            _context.SupervisorUploads.Add(doc);

            // 5️⃣ Update application status
            var existingStatus = await _context.SupervisorApplicationStatuses
                .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

            if (existingStatus != null)
            {
                bool wasStep5AlreadyTrue = existingStatus.Step_5;

                existingStatus.Step_5 = true;
                existingStatus.Step_5At = DateTime.UtcNow;

                _context.SupervisorApplicationStatuses.Update(existingStatus);

                // 6️⃣ Reset screening if re-upload
                if (wasStep5AlreadyTrue)
                {
                    var screeningStatus = await _context.SupervisorScreenings
                        .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

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
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Documents uploaded successfully!",
                doc
            });
        }


        [HttpPut("UpdateDocuments")]
        public async Task<IActionResult> UpdateDocuments(
       [FromForm] UploadDocumentsDto dto,
       [FromServices] IFileStorageService fileStorageService)
        {
            var existingDoc = await _context.SupervisorUploads
                .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

            if (existingDoc == null)
                return NotFound(new { message = "No documents found for this supervisor." });

            // 🔁 Helper: delete old file + save new
            async Task<string> ReplaceFile(
                IFormFile newFile,
                string? oldPath,
                string subFolder,
                string prefix)
            {
                if (!string.IsNullOrWhiteSpace(oldPath))
                {
                    await fileStorageService.DeleteAsync(oldPath);
                }

                return await fileStorageService.SaveAsync(
                    newFile,
                    subFolder: subFolder,
                    filePrefix: prefix
                );
            }

            // 🔹 Update only changed files
            if (dto.Photo != null)
            {
                existingDoc.Photo = await ReplaceFile(
                    dto.Photo,
                    existingDoc.Photo,
                    "supervisor/photos",
                    $"SUP_{dto.SupId}_PHOTO_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.Signature != null)
            {
                existingDoc.Sign = await ReplaceFile(
                    dto.Signature,
                    existingDoc.Sign,
                    "supervisor/signatures",
                    $"SUP_{dto.SupId}_SIGN_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.AppLetter != null)
            {
                existingDoc.AppLetter = await ReplaceFile(
                    dto.AppLetter,
                    existingDoc.AppLetter,
                    "supervisor/app-letter",
                    $"SUP_{dto.SupId}_APP_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.IdentityProof != null)
            {
                existingDoc.IdentityProof = await ReplaceFile(
                    dto.IdentityProof,
                    existingDoc.IdentityProof,
                    "supervisor/identity-proof",
                    $"SUP_{dto.SupId}_ID_{DateTime.UtcNow.Ticks}"
                );
            }

            if (dto.ApaarId != null)
            {
                existingDoc.ApaarId = await ReplaceFile(
                    dto.ApaarId,
                    existingDoc.ApaarId,
                    "supervisor/apaar",
                    $"SUP_{dto.SupId}_APAAR_{DateTime.UtcNow.Ticks}"
                );
            }

            _context.SupervisorUploads.Update(existingDoc);

            // 🔄 Step 5 status + screening reset logic
            var existingStatus = await _context.SupervisorApplicationStatuses
                .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

            if (existingStatus != null)
            {
                bool wasStep5AlreadyTrue = existingStatus.Step_5;

                existingStatus.Step_5 = true;
                existingStatus.Step_5At = DateTime.UtcNow;

                _context.SupervisorApplicationStatuses.Update(existingStatus);

                if (wasStep5AlreadyTrue)
                {
                    var screeningStatus = await _context.SupervisorScreenings
                        .FirstOrDefaultAsync(s => s.SupId == dto.SupId);

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
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Documents updated successfully!",
                documents = existingDoc
            });
        }

        // DELETE: api/SupUploads/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupUpload(int id)
        {
            var supUpload = await _context.SupervisorUploads.FindAsync(id);
            if (supUpload == null)
            {
                return NotFound();
            }

            _context.SupervisorUploads.Remove(supUpload);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SupUploadExists(int id)
        {
            return _context.SupervisorUploads.Any(e => e.Id == id);
        }
    }
}
