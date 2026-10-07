using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models.WebsiteSettings;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResearchPoliciesController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorageService;

        public ResearchPoliciesController(RMSDbContext context, IFileStorageService fileStorageService)
        {
            _context = context;
            _fileStorageService = fileStorageService;
        }

        // GET: api/ResearchPolicies
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResearchPolicy>>> GetResearchPolicies()
        {
            return await _context.ResearchPolicies.ToListAsync();
        }

        // GET: api/ResearchPolicies/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ResearchPolicy>> GetResearchPolicy(int id)
        {
            var policy = await _context.ResearchPolicies.FindAsync(id);

            if (policy == null)
            {
                return NotFound();
            }

            return policy;
        }

        // POST: api/ResearchPolicies
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<ResearchPolicy>> PostResearchPolicy([FromForm] ResearchPolicyDto policyDto)
        {
            if (policyDto.PolicyFile == null || policyDto.PolicyFile.Length == 0)
                return BadRequest("File is required.");

            var subFolder = "ResearchPolicies";

            var savedPath = await _fileStorageService.SaveAsync(
                policyDto.PolicyFile,
                subFolder,
                "POLICY"
            );

            var policy = new ResearchPolicy
            {
                PolicyTitle = policyDto.PolicyTitle,
                FilePath = savedPath
            };

            _context.ResearchPolicies.Add(policy);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetResearchPolicy", new { id = policy.Id }, policy);
        }

        // PUT: api/ResearchPolicies/5
        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> PutResearchPolicy(int id, [FromForm] ResearchPolicyDto policyDto)
        {
            var policy = await _context.ResearchPolicies.FindAsync(id);
            if (policy == null)
            {
                return NotFound();
            }

            policy.PolicyTitle = policyDto.PolicyTitle;

            if (policyDto.PolicyFile != null && policyDto.PolicyFile.Length > 0)
            {
                var subFolder = "ResearchPolicies";

                if (!string.IsNullOrEmpty(policy.FilePath))
                {
                    await _fileStorageService.OverwriteAsync(
                        policyDto.PolicyFile,
                        policy.FilePath
                    );
                }
                else
                {
                    var savedPath = await _fileStorageService.SaveAsync(
                        policyDto.PolicyFile,
                        subFolder,
                        "POLICY"
                    );
                    policy.FilePath = savedPath;
                }
            }

            _context.ResearchPolicies.Update(policy);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/ResearchPolicies/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteResearchPolicy(int id)
        {
            var policy = await _context.ResearchPolicies.FindAsync(id);
            if (policy == null)
            {
                return NotFound();
            }

            _context.ResearchPolicies.Remove(policy);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/ResearchPolicies/download/5
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadResearchPolicy(int id)
        {
            var policy = await _context.ResearchPolicies.FindAsync(id);
            if (policy == null || string.IsNullOrEmpty(policy.FilePath))
            {
                return NotFound("Policy or file not found");
            }

            try
            {
                var fileBytes = await _fileStorageService.GetFileAsync(policy.FilePath);
                var fileName = Path.GetFileName(policy.FilePath);
                var fileExtension = Path.GetExtension(fileName).ToLower();
                
                // Determine content type based on file extension
                var contentType = fileExtension switch
                {
                    ".pdf" => "application/pdf",
                    ".doc" => "application/msword",
                    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    _ => "application/octet-stream"
                };

                // Return with inline disposition for viewing, not attachment for download
                Response.Headers.Add("Content-Disposition", $"inline; filename=\"{fileName}\"");
                return File(fileBytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound("File not found on server");
            }
        }

        // GET: api/ResearchPolicies/view/5 (for iframe viewing)
        [HttpGet("view/{id}")]
        public async Task<IActionResult> ViewResearchPolicy(int id)
        {
            var policy = await _context.ResearchPolicies.FindAsync(id);
            if (policy == null || string.IsNullOrEmpty(policy.FilePath))
            {
                return NotFound("Policy or file not found");
            }

            try
            {
                var fileBytes = await _fileStorageService.GetFileAsync(policy.FilePath);
                var fileName = Path.GetFileName(policy.FilePath);
                var fileExtension = Path.GetExtension(fileName).ToLower();
                
                // Determine content type based on file extension
                var contentType = fileExtension switch
                {
                    ".pdf" => "application/pdf",
                    ".doc" => "application/msword",
                    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    _ => "application/octet-stream"
                };

                // Return with inline disposition for viewing in iframe
                return File(fileBytes, contentType);
            }
            catch (FileNotFoundException)
            {
                return NotFound("File not found on server");
            }
        }

        private bool ResearchPolicyExists(int id)
        {
            return _context.ResearchPolicies.Any(e => e.Id == id);
        }
    }

    public class ResearchPolicyDto
    {
        public string PolicyTitle { get; set; }
        public IFormFile PolicyFile { get; set; }
    }
}
