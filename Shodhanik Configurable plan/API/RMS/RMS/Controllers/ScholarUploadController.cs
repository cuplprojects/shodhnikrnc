using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using RMS.Models.Enums;
using System.Threading.Tasks.Dataflow;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarUploadController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileService _fileService;
        private readonly IConfiguration _configuration;
        private readonly IFileStorageService _fileStorageService;

        public ScholarUploadController(RMSDbContext context, IFileService fileService, IConfiguration configuration, IFileStorageService fileStorageService)
        {
            _context = context;
            _fileService = fileService;
            _configuration = configuration;
            _fileStorageService = fileStorageService;
        }

        // =====================================================
        // POST or UPDATE (UPSERT)
        // =====================================================
        [HttpPost("Upsert")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpsertScholarUpload([FromForm] ScholarUploadDto input)
        {
            try
            {
                if (input.SID <= 0)
                    return BadRequest("SID is required.");

                if (input.DocumentMasterID <= 0)
                    return BadRequest("DocumentMasterID is required.");

                if (input.File == null || input.File.Length == 0)
                    return BadRequest("File is required.");

                var existing = await _context.ScholarUploads
                    .FirstOrDefaultAsync(x =>
                        x.SID == input.SID &&
                        x.DocumentMasterID == input.DocumentMasterID);

                // Folder: ScholarFiles/{SID}
                var subFolder = Path.Combine(
                    "ScholarFiles",
                    input.SID.ToString()
                );

                // ===============================
                // CREATE
                // ===============================
                if (existing == null)
                {
                    var savedPath = await _fileStorageService.SaveAsync(
                        input.File,
                        subFolder,
                        "SCHOLAR_DOC"
                    );

                    var entity = new ScholarUpload
                    {
                        SID = input.SID,
                        DocumentMasterID = input.DocumentMasterID,
                        Path = savedPath,
                    };

                    _context.ScholarUploads.Add(entity);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        Message = "Document created successfully.",
                        entity
                    });
                }
                else
                {
                    // ===============================
                    // UPDATE
                    // ===============================
                    if (!string.IsNullOrEmpty(existing.Path))
                    {
                        await _fileStorageService.OverwriteAsync(
                            input.File,
                            existing.Path
                        );
                    }
                    else
                    {
                        existing.Path = await _fileStorageService.SaveAsync(
                            input.File,
                            subFolder,
                            "SCHOLAR_DOC"
                        );
                    }

                    _context.ScholarUploads.Update(existing);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        Message = "Document updated successfully.",
                        existing
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "ERROR: " + ex.InnerException?.Message);
            }
        }


        [HttpPatch("{scholarUploadId}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> PatchScholarUpload(
      int scholarUploadId,
      [FromForm] ScholarUploadPatchRequest request)
        {
            var upload = await _context.ScholarUploads.FindAsync(scholarUploadId);

            if (upload == null)
                return NotFound();

            if (request.DocumentMasterID.HasValue)
                upload.DocumentMasterID = request.DocumentMasterID.Value;

            if (request.DecisionStatus.HasValue)
                upload.DecisionStatus = request.DecisionStatus.Value;

            if (!string.IsNullOrWhiteSpace(request.Remarks))
                upload.Remarks = request.Remarks;

            // ======================
            // File Upload Handling
            // ======================
            if (request.Document != null && request.Document.Length > 0)
            {
                var subFolder = Path.Combine(
                    "ScholarFiles",
                    upload.SID.ToString()
                );

                var savedPath = await _fileStorageService.SaveAsync(
                    request.Document,
                    subFolder,
                    "SCHOLAR_DOC"
                );

                upload.Path = savedPath;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }




        [HttpGet("counselling-documents/{sid}")]
        public async Task<IActionResult> GetCounsellingDocuments(int sid)
        {
            // ✅ Check payment condition first
            var paymentExists = await _context.ScholarPayments
                .AsNoTracking()
                .AnyAsync(p =>
                    p.SID == sid &&
                    p.PaymentCategory == (PaymentCategory)2
                );

            if (!paymentExists)
                return BadRequest("Payment not completed for counselling stage.");

            // ✅ Fetch documents
            var documents = await (
                from su in _context.ScholarUploads.AsNoTracking()
                join dm in _context.DocumentMasters.AsNoTracking()
                    on su.DocumentMasterID equals dm.DocumentMasterID
                where su.SID == sid
                      && dm.Stage.ToLower() == "counselling"
                select new
                {
                    su.ScholarUploadID,
                    su.DocumentMasterID,
                    dm.DocumentName,
                    dm.DocType,
                    su.Path,
                    su.DecisionStatus
                }
            ).ToListAsync();

            return Ok(documents);
        }





        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarUpload(int id, [FromForm] ScholarUploadDto input)
        {
            try
            {
                var scholar = await _context.ScholarUploads.FindAsync(id);

                if (scholar == null)
                    return NotFound($"ScholarUpload with ID {id} not found.");

                if (input.SID > 0)
                    scholar.SID = input.SID;

                if (input.DocumentMasterID > 0)
                    scholar.DocumentMasterID = input.DocumentMasterID;

                string rootPath = _fileService.GetUploadPath("ScholarFiles");

                if (!Directory.Exists(rootPath))
                    Directory.CreateDirectory(rootPath);

                // ===============================
                // Update File
                // ===============================
                if (input.File != null && input.File.Length > 0)
                {
                    if (!string.IsNullOrEmpty(scholar.Path))
                    {
                        string oldPath = Path.Combine(rootPath, scholar.Path);
                        if (System.IO.File.Exists(oldPath))
                            System.IO.File.Delete(oldPath);
                    }

                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(input.File.FileName);
                    string extension = Path.GetExtension(input.File.FileName);

                    string finalFileName = $"{fileNameWithoutExt}_{scholar.SID}{extension}";
                    string fullPath = Path.Combine(rootPath, finalFileName);

                    using (var stream = new FileStream(fullPath, FileMode.Create))
                    {
                        await input.File.CopyToAsync(stream);
                    }

                    scholar.Path = finalFileName;
                }

                _context.ScholarUploads.Update(scholar);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Document updated successfully.",
                    scholar
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }


        // =====================================================
        // GET ALL DOCUMENTS OF A STUDENT (SID)
        // =====================================================
        [HttpGet("GetBySID")]
        public async Task<IActionResult> GetBySID(int sid)
        {
            if (sid <= 0)
                return BadRequest("SID is invalid.");

            var uploads = await (
    from su in _context.ScholarUploads
    join dms in _context.DocumentMasters
        on su.DocumentMasterID equals dms.DocumentMasterID
    where su.SID == sid
    select new
    {
        su.DocumentMasterID,
        su.SID,
        su.ScholarUploadID,
        su.Path,
        su.DecisionStatus,
        dms.DocumentName
    }
).ToListAsync();

            if (!uploads.Any())
                return NotFound("No documents found for this SID.");

            return Ok(uploads);
        }

        // =====================================================
        // GET A SINGLE DOCUMENT BY ID
        // =====================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var upload = await _context.ScholarUploads.FindAsync(id);

            if (upload == null)
                return NotFound("Document not found.");

            return Ok(upload);
        }

        // =====================================================
        // GET BY SID & DOCUMENT MASTER ID
        // =====================================================
        [HttpGet("GetBySIDAndDoc")]
        public async Task<IActionResult> GetBySIDAndDoc(int sid, int docId)
        {
            var result = await _context.ScholarUploads
                .FirstOrDefaultAsync(x =>
                    x.SID == sid &&
                    x.DocumentMasterID == docId);

            if (result == null)
                return NotFound("Document not found.");

            return Ok(GetBySIDAndDoc);
        }



        public class ScholarUploadDto
        {
            public int SID { get; set; }
            public int DocumentMasterID { get; set; }
            public IFormFile? File { get; set; }

            public IFormFile? Photograph { get; set; }
            public IFormFile? Signature { get; set; }
            public IFormFile? PgOrEquivalentMarksheet { get; set; }
        }



    }

    public class ScholarUploadPatchRequest
    {
        public int? DocumentMasterID { get; set; }
        public UploadDecisionStatus? DecisionStatus { get; set; }
        public string? Remarks { get; set; }

        // For file upload
        public IFormFile? Document { get; set; }
    }
}
