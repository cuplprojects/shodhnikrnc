using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Services;
using System.ComponentModel.DataAnnotations;
using System.Text;
using ClosedXML.Excel;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeritListDocsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IFileStorageService _fileStorageService;
        private readonly ILogger<MeritListDocsController> _logger;
        private readonly IConfiguration _configuration;

        public MeritListDocsController(
            RMSDbContext context,
            IFileStorageService fileStorageService,
            ILogger<MeritListDocsController> logger,
            IConfiguration configuration)
        {
            _context = context;
            _fileStorageService = fileStorageService;
            _logger = logger;
            _configuration = configuration;
        }

        // POST: api/MeritListDocs/upload
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadMeritList([FromForm] MeritListUploadDto input)
        {
            try
            {
                if (input.File == null || input.File.Length == 0)
                    return BadRequest("File is required.");

                if (string.IsNullOrEmpty(input.Session))
                    return BadRequest("Session is required.");

                // Validate file type (Excel files only)
                var allowedExtensions = new[] { ".xlsx", ".xls" };
                var fileExtension = Path.GetExtension(input.File.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest("Only Excel files (.xlsx, .xls) are allowed.");
                }

                // Create "meritlist" folder
                var subFolder = "meritlist";

                // Save file using FileStorageService
                var savedPath = await _fileStorageService.SaveAsync(
                    input.File,
                    subFolder,
                    "MERIT_LIST"
                );

                // Create database record
                var meritListDoc = new MeritListDoc
                {
                    path = savedPath,
                    Session = input.Session
                };

                _context.MeritListDocs.Add(meritListDoc);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Merit list document uploaded successfully: {FileName} for session: {Session}", input.File.FileName, input.Session);

                return Ok(new
                {
                    success = true,
                    message = "Merit list document uploaded successfully.",
                    data = new
                    {
                        id = meritListDoc.MLDID,
                        path = meritListDoc.path,
                        session = meritListDoc.Session,
                        fileName = input.File.FileName
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading merit list document: {FileName}", input.File?.FileName);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // GET: api/MeritListDocs/template-download/{year}
        [HttpGet("template-download/{year}")]
        public async Task<IActionResult> MeritListTemplateDownload(string year)
        {
            try
            {
                if (string.IsNullOrEmpty(year))
                {
                    return BadRequest("Year parameter is required.");
                }

                // Query scholars with interview marks and their personal details
                var scholarData = await (from scholar in _context.Scholars
                                        join personalDetail in _context.ScholarPersonalDetails
                                        on scholar.SID equals personalDetail.SID into pd
                                        from personalDetail in pd.DefaultIfEmpty()
                                        where scholar.Year == year && scholar.InterviewMarks != null
                                        orderby scholar.InterviewMarks descending
                                        select new
                                        {
                                            ApplicationNo = scholar.ApplicationNo ?? "",
                                            Name = scholar.Name ?? "",
                                            FName = scholar.FName ?? "",
                                            InterviewMarks = scholar.InterviewMarks ?? 0,
                                            Category = personalDetail != null ? personalDetail.Category ?? "" : "",
                                            SubCategory = personalDetail != null ? personalDetail.SubCategory ?? "" : "",
                                            Result = "" // Blank field as requested
                                        }).ToListAsync();

                if (!scholarData.Any())
                {
                    return NotFound($"No scholars found with interview marks for year {year}.");
                }

                // Create Excel file using ClosedXML
                using (var workbook = new XLWorkbook())
                {
                    var worksheet = workbook.Worksheets.Add("Merit List");
                    
                    // Add headers
                    worksheet.Cell(1, 1).Value = "Application No";
                    worksheet.Cell(1, 2).Value = "Name";
                    worksheet.Cell(1, 3).Value = "Father Name";
                    worksheet.Cell(1, 4).Value = "Interview Marks";
                    worksheet.Cell(1, 5).Value = "Category";
                    worksheet.Cell(1, 6).Value = "Sub Category";
                    worksheet.Cell(1, 7).Value = "Result";

                    // Style headers
                    var headerRange = worksheet.Range(1, 1, 1, 7);
                    headerRange.Style.Font.Bold = true;
                    headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
                    headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    headerRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                    // Add data rows
                    int row = 2;
                    foreach (var scholar in scholarData)
                    {
                        worksheet.Cell(row, 1).Value = scholar.ApplicationNo;
                        worksheet.Cell(row, 2).Value = scholar.Name;
                        worksheet.Cell(row, 3).Value = scholar.FName;
                        worksheet.Cell(row, 4).Value = scholar.InterviewMarks;
                        worksheet.Cell(row, 5).Value = scholar.Category;
                        worksheet.Cell(row, 6).Value = scholar.SubCategory;
                        worksheet.Cell(row, 7).Value = scholar.Result;
                        row++;
                    }

                    // Auto-fit columns
                    worksheet.Columns().AdjustToContents();

                    // Add borders to data
                    var dataRange = worksheet.Range(1, 1, scholarData.Count + 1, 7);
                    dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                    // Generate filename
                    var fileName = $"Merit_List_Template_{year}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                    // Save to memory stream
                    using (var stream = new MemoryStream())
                    {
                        workbook.SaveAs(stream);
                        var bytes = stream.ToArray();

                        _logger.LogInformation("Merit list Excel template downloaded for year: {Year}, Records: {Count}", year, scholarData.Count);

                        // Return Excel file
                        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating merit list Excel template for year: {Year}", year);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // PATCH: api/MeritListDocs/process-interview-results/{session}
        [HttpPatch("process-interview-results/{session}")]
        public async Task<IActionResult> ProcessInterviewResults(string session)
        {
            try
            {
                if (string.IsNullOrEmpty(session))
                {
                    return BadRequest("Session parameter is required.");
                }

                // Find the merit list document for the given session
                var meritListDoc = await _context.MeritListDocs
                    .Where(m => m.Session == session)
                    .OrderByDescending(m => m.MLDID)
                    .FirstOrDefaultAsync();

                if (meritListDoc == null)
                {
                    return NotFound($"No merit list document found for session: {session}");
                }

                // Get the full file path
                var rootFolder = _configuration["FilePath"]
                    ?? throw new InvalidOperationException("FilePath not configured");

                var filePath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    rootFolder,
                    meritListDoc.path.Replace("/", Path.DirectorySeparatorChar.ToString())
                );
                
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound("Merit list file not found on disk.");
                }

                var processedCount = 0;
                var errorMessages = new List<string>();

                // Read Excel file using ClosedXML
                using (var workbook = new XLWorkbook(filePath))
                {
                    var worksheet = workbook.Worksheet(1); // Get first worksheet
                    var rows = worksheet.RangeUsed().RowsUsed().Skip(1); // Skip header row

                    foreach (var row in rows)
                    {
                        try
                        {
                            // Assuming columns: Application No (A), Name (B), Father Name (C), Interview Marks (D), Category (E), Sub Category (F), Result/Remark (G)
                            var applicationNo = row.Cell(1).GetString().Trim();
                            var remark = row.Cell(7).GetString().Trim().ToLowerInvariant();

                            if (string.IsNullOrEmpty(applicationNo))
                            {
                                continue; // Skip empty rows
                            }

                            // Find scholar by application number
                            var scholar = await _context.Scholars
                                .FirstOrDefaultAsync(s => s.ApplicationNo == applicationNo);

                            if (scholar == null)
                            {
                                errorMessages.Add($"Scholar not found for Application No: {applicationNo}");
                                continue;
                            }

                            // Update decision status based on remark
                            DecisionStatus newStatus;
                            if (remark == "pass" || remark == "passed")
                            {
                                newStatus = DecisionStatus.InterviewApproved; // 6
                            }
                            else if (remark == "fail" || remark == "failed" || remark == "reject" || remark == "rejected")
                            {
                                newStatus = DecisionStatus.InterviewRejected; // 5
                            }
                            else
                            {
                                errorMessages.Add($"Invalid remark '{remark}' for Application No: {applicationNo}. Expected 'pass' or 'fail'.");
                                continue;
                            }

                            // Update scholar's decision status
                            scholar.DecisionStatus = newStatus;
                            scholar.DecisionUpdateTime = DateTime.UtcNow;

                            processedCount++;
                        }
                        catch (Exception ex)
                        {
                            errorMessages.Add($"Error processing row {row.RowNumber()}: {ex.Message}");
                        }
                    }
                }

                // Save all changes to database
                await _context.SaveChangesAsync();

                _logger.LogInformation("Interview results processed for session: {Session}. Processed: {ProcessedCount}, Errors: {ErrorCount}", 
                    session, processedCount, errorMessages.Count);

                return Ok(new
                {
                    success = true,
                    message = "Interview results processed successfully.",
                    data = new
                    {
                        session = session,
                        processedCount = processedCount,
                        errorCount = errorMessages.Count,
                        errors = errorMessages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing interview results for session: {Session}", session);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // POST: api/MeritListDocs/upload-and-process
        [HttpPost("upload-and-process")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadAndProcessMeritList([FromForm] MeritListUploadDto input)
        {
            try
            {
                if (input.File == null || input.File.Length == 0)
                    return BadRequest("File is required.");

                if (string.IsNullOrEmpty(input.Session))
                    return BadRequest("Session is required.");

                var allowedExtensions = new[] { ".xlsx", ".xls" };
                var fileExtension = Path.GetExtension(input.File.FileName).ToLowerInvariant();

                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest("Only Excel files (.xlsx, .xls) are allowed.");

                var processedCount = 0;
                var errorMessages = new List<string>();
                var validationErrors = new List<string>();

                // ================= FIRST PASS : VALIDATION =================
                using (var memoryStream = new MemoryStream())
                {
                    await input.File.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;

                    using var workbook = new XLWorkbook(memoryStream);
                    var worksheet = workbook.Worksheet(1);
                    var rows = worksheet.RangeUsed().RowsUsed().Skip(1);

                    foreach (var row in rows)
                    {
                        var applicationNo = row.Cell(1).GetString().Trim();
                        var remarkRaw = row.Cell(7).GetString();
                        var remark = remarkRaw?.Trim().ToLowerInvariant();

                        if (string.IsNullOrEmpty(applicationNo))
                            continue;

                        var scholarExists = await _context.Scholars
                            .AnyAsync(s => s.ApplicationNo == applicationNo);

                        if (!scholarExists)
                        {
                            validationErrors.Add(
                                $"Invalid Application No: {applicationNo} at row {row.RowNumber()}.");
                        }

                        // ❌ BLANK REMARK NOT ALLOWED
                        if (string.IsNullOrWhiteSpace(remark))
                        {
                            validationErrors.Add(
                                $"Blank remark is not allowed for Application No: {applicationNo} at row {row.RowNumber()}.");
                            continue;
                        }

                        if (remark != "pass" && remark != "passed" &&
                            remark != "fail" && remark != "failed" &&
                            remark != "reject" && remark != "rejected")
                        {
                            validationErrors.Add(
                                $"Invalid remark '{remarkRaw}' for Application No: {applicationNo} at row {row.RowNumber()}.");
                        }
                    }
                }

                if (validationErrors.Any())
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Excel file validation failed.",
                        errors = validationErrors
                    });
                }

                // ================= FILE UPLOAD =================
                var savedPath = await _fileStorageService.SaveAsync(
                    input.File,
                    "meritlist",
                    "MERIT_LIST"
                );

                var meritListDoc = new MeritListDoc
                {
                    path = savedPath,
                    Session = input.Session
                };

                _context.MeritListDocs.Add(meritListDoc);
                await _context.SaveChangesAsync();

                // ================= SECOND PASS : PROCESSING =================
                using (var memoryStream = new MemoryStream())
                {
                    await input.File.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;

                    using var workbook = new XLWorkbook(memoryStream);
                    var worksheet = workbook.Worksheet(1);
                    var rows = worksheet.RangeUsed().RowsUsed().Skip(1);

                    foreach (var row in rows)
                    {
                        try
                        {
                            var applicationNo = row.Cell(1).GetString().Trim();
                            var remarkRaw = row.Cell(7).GetString();
                            var remark = remarkRaw?.Trim().ToLowerInvariant();

                            if (string.IsNullOrEmpty(applicationNo))
                                continue;

                            // ❌ STRICT BLANK CHECK
                            if (string.IsNullOrWhiteSpace(remark))
                            {
                                errorMessages.Add(
                                    $"Blank remark is not allowed for Application No: {applicationNo} at row {row.RowNumber()}.");
                                continue;
                            }

                            var scholar = await _context.Scholars
                                .FirstOrDefaultAsync(s => s.ApplicationNo == applicationNo);

                            if (scholar == null)
                            {
                                errorMessages.Add($"Scholar not found for Application No: {applicationNo}");
                                continue;
                            }

                            if (remark == "pass" || remark == "passed")
                            {
                                scholar.DecisionStatus = DecisionStatus.InterviewApproved;
                                scholar.DecisionUpdateTime = DateTime.UtcNow;

                                var appStatus = await _context.ScholarApplicationStatuses
                                    .FirstOrDefaultAsync(x => x.SID == scholar.SID);

                                if (appStatus != null)
                                {
                                    appStatus.Step_7 = true;
                                    appStatus.Step_7At = DateTime.UtcNow;
                                }
                            }
                            else if (remark == "fail" || remark == "failed" ||
                                     remark == "reject" || remark == "rejected")
                            {
                                scholar.DecisionStatus = DecisionStatus.InterviewRejected;
                                scholar.DecisionUpdateTime = DateTime.UtcNow;
                            }
                            else
                            {
                                errorMessages.Add(
                                    $"Invalid remark '{remarkRaw}' for Application No: {applicationNo} at row {row.RowNumber()}.");
                                continue;
                            }

                            processedCount++;
                        }
                        catch (Exception ex)
                        {
                            errorMessages.Add($"Error processing row {row.RowNumber()}: {ex.Message}");
                        }
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Merit list uploaded and processed successfully.",
                    data = new
                    {
                        id = meritListDoc.MLDID,
                        path = savedPath,
                        session = input.Session,
                        fileName = input.File.FileName,
                        processedCount,
                        errorCount = errorMessages.Count,
                        errors = errorMessages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Merit list processing failed");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error",
                    details = ex.Message
                });
            }
        }



        // PATCH: api/MeritListDocs/process-interview-results-file]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ProcessInterviewResultsFromFile([FromForm] InterviewResultsUploadDto input)
        {
            try
            {
                if (input.File == null || input.File.Length == 0)
                    return BadRequest("Excel file is required.");

                if (string.IsNullOrEmpty(input.Session))
                    return BadRequest("Session is required.");

                var allowedExtensions = new[] { ".xlsx", ".xls" };
                var fileExtension = Path.GetExtension(input.File.FileName).ToLowerInvariant();

                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest("Only Excel files (.xlsx, .xls) are allowed.");

                var processedCount = 0;
                var errorMessages = new List<string>();

                using (var memoryStream = new MemoryStream())
                {
                    await input.File.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;

                    using var workbook = new XLWorkbook(memoryStream);
                    var worksheet = workbook.Worksheet(1);
                    var rows = worksheet.RangeUsed().RowsUsed().Skip(1);

                    foreach (var row in rows)
                    {
                        try
                        {
                            var applicationNo = row.Cell(1).GetString().Trim();
                            var remarkRaw = row.Cell(7).GetString();
                            var remark = remarkRaw?.Trim().ToLowerInvariant();

                            if (string.IsNullOrEmpty(applicationNo))
                                continue;

                            // ❌ BLANK NOT ALLOWED
                            if (string.IsNullOrWhiteSpace(remark))
                            {
                                errorMessages.Add(
                                    $"Blank remark is not allowed for Application No: {applicationNo} at row {row.RowNumber()}.");
                                continue;
                            }

                            var scholar = await _context.Scholars
                                .FirstOrDefaultAsync(s => s.ApplicationNo == applicationNo);

                            if (scholar == null)
                            {
                                errorMessages.Add($"Scholar not found for Application No: {applicationNo}");
                                continue;
                            }

                            DecisionStatus newStatus;

                            if (remark == "pass" || remark == "passed")
                                newStatus = DecisionStatus.InterviewApproved;
                            else if (remark == "fail" || remark == "failed" ||
                                     remark == "reject" || remark == "rejected")
                                newStatus = DecisionStatus.InterviewRejected;
                            else
                            {
                                errorMessages.Add(
                                    $"Invalid remark '{remarkRaw}' for Application No: {applicationNo} at row {row.RowNumber()}.");
                                continue;
                            }

                            scholar.DecisionStatus = newStatus;
                            scholar.DecisionUpdateTime = DateTime.UtcNow;

                            processedCount++;
                        }
                        catch (Exception ex)
                        {
                            errorMessages.Add($"Error processing row {row.RowNumber()}: {ex.Message}");
                        }
                    }
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Interview results processed for session {Session}. Processed: {Processed}, Errors: {Errors}",
                    input.Session, processedCount, errorMessages.Count);

                return Ok(new
                {
                    success = true,
                    message = "Interview results processed successfully from uploaded file.",
                    data = new
                    {
                        session = input.Session,
                        fileName = input.File.FileName,
                        processedCount,
                        errorCount = errorMessages.Count,
                        errors = errorMessages
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error processing interview results from uploaded file for session: {Session}",
                    input.Session);

                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error"
                });
            }
        }

    }

    // DTO for file upload
    public class MeritListUploadDto
    {
        public IFormFile File { get; set; } = null!;
        [Required]
        public string Session { get; set; } = string.Empty;
    }

    // DTO for interview results upload
    public class InterviewResultsUploadDto
    {
        public IFormFile File { get; set; } = null!;
        [Required]
        public string Session { get; set; } = string.Empty;
    }
}