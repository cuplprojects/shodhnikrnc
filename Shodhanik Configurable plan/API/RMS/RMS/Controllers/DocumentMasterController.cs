using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DocumentMasterController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public DocumentMasterController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/DocumentMaster
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DocumentMaster>>> GetDocumentMasters()
        {
            return await _context.DocumentMasters.ToListAsync();
        }

        // GET: api/DocumentMaster/5
        [HttpGet("{id}")]
        public async Task<ActionResult<DocumentMaster>> GetDocumentMaster(int id)
        {
            var documentMaster = await _context.DocumentMasters.FindAsync(id);

            if (documentMaster == null)
            {
                return NotFound();
            }

            return documentMaster;
        }

        // PUT: api/DocumentMaster/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutDocumentMaster(int id, DocumentMaster documentMaster)
        {
            if (id != documentMaster.DocumentMasterID)
            {
                return BadRequest();
            }

            _context.Entry(documentMaster).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!DocumentMasterExists(id))
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

        // POST: api/DocumentMaster
        [HttpPost]
        public async Task<ActionResult<DocumentMaster>> PostDocumentMaster(DocumentMaster documentMaster)
        {
            _context.DocumentMasters.Add(documentMaster);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetDocumentMaster",
                                   new { id = documentMaster.DocumentMasterID },
                                   documentMaster);
        }

        // DELETE: api/DocumentMaster/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocumentMaster(int id)
        {
            var documentMaster = await _context.DocumentMasters.FindAsync(id);
            if (documentMaster == null)
            {
                return NotFound();
            }

            _context.DocumentMasters.Remove(documentMaster);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("GetRequiredDocumentsforID/{id}")]
        public async Task<IActionResult> GetRequiredDocumentsforID(int id)
        {
            // 1️⃣ Check scholar existence
            bool scholarExists = await _context.Scholars
                .AsNoTracking()
                .AnyAsync(s => s.SID == id);

            if (!scholarExists)
                return NotFound("Scholar not found");

            // 2️⃣ Fetch required personal details
            var personalDetail = await _context.ScholarPersonalDetails
                .AsNoTracking()
                .Where(s => s.SID == id)
                .Select(s => new
                {
                    s.IdentityProof,
                    s.IsWorking,
                    s.Country
                })
                .FirstOrDefaultAsync();

            if (personalDetail == null || string.IsNullOrWhiteSpace(personalDetail.IdentityProof))
                return NotFound("Scholar personal details not found");

            // 3️⃣ Base required document IDs
            var requiredDocumentIds = new List<int> { 1, 2, 4 };

            // 4️⃣ If scholar is working → add working document
            if (personalDetail.IsWorking == true)
            {
                requiredDocumentIds.Add(16);
            }

            // 5️⃣ If Country is India → APAAR ID compulsory
            if (!string.IsNullOrWhiteSpace(personalDetail.Country) &&
                personalDetail.Country.Trim().ToLower() == "india")
            {
                var apaarDoc = await _context.DocumentMasters
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d =>
                        d.DocumentName.ToLower().Contains("apaar"));

                if (apaarDoc == null)
                {
                    return StatusCode(500, "APAAR ID document is not configured in Document Master.");
                }

                requiredDocumentIds.Add(apaarDoc.DocumentMasterID);
            }

            // 6️⃣ Fetch required documents
            var documents = await _context.DocumentMasters
                .AsNoTracking()
                .Where(d =>
                    requiredDocumentIds.Contains(d.DocumentMasterID) ||
                    d.DocumentName == personalDetail.IdentityProof
                )
                .Distinct()
                .ToListAsync();

            return Ok(documents);
        }




        [HttpGet("GetDocuments")]
        public async Task<IActionResult> GetDocuments(
      [FromQuery] string docType,
      [FromQuery] string? NRI,
      [FromQuery] string? stage   // ✅ string, optional
  )
        {
            var query = _context.DocumentMasters.AsQueryable();

            // Filter by DocType ONLY if provided
            if (!string.IsNullOrWhiteSpace(docType))
            {
                query = query.Where(x => x.DocType == docType);
            }

            // Apply Stage filter ONLY if provided
            if (!string.IsNullOrWhiteSpace(stage))
            {
                query = query.Where(x => x.Stage == stage);
            }

            // Apply NRI rule ONLY when user actually enters "nri"
            if (!string.IsNullOrWhiteSpace(NRI) && NRI.Trim().ToLower() == "nri")
            {
                query = query.Where(x => x.DocumentName.ToLower() != "passport");
            }

            var data = await query.ToListAsync();

            if (!data.Any())
                return NotFound(new { Message = "No documents found." });

            return Ok(data);
        }


        private bool DocumentMasterExists(int id)
        {
            return _context.DocumentMasters.Any(e => e.DocumentMasterID == id);
        }
    }
}
