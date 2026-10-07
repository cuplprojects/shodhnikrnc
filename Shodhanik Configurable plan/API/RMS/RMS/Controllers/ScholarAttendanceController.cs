using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System.ComponentModel.DataAnnotations;
using ClosedXML.Excel;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarAttendanceController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly ILogger<ScholarAttendanceController> _logger;

        public ScholarAttendanceController(RMSDbContext context, ILogger<ScholarAttendanceController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/ScholarAttendance
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarAttendance>>> GetScholarAttendances()
        {
            return await _context.ScholarAttendances.ToListAsync();
        }

        // GET: api/ScholarAttendance/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarAttendance>> GetScholarAttendance(int id)
        {
            var scholarAttendance = await _context.ScholarAttendances.FindAsync(id);

            if (scholarAttendance == null)
            {
                return NotFound();
            }

            return scholarAttendance;
        }

        // GET: api/ScholarAttendance/by-username/{username}
        [HttpGet("by-username/{username}")]
        public async Task<ActionResult<IEnumerable<ScholarAttendance>>> GetScholarAttendanceByUsername(string username)
        {
            var attendances = await _context.ScholarAttendances
                .Where(sa => sa.PermUserName == username)
                .ToListAsync();

            return attendances;
        }

        // GET: api/ScholarAttendance/by-year/{year}
        [HttpGet("by-year/{year}")]
        public async Task<ActionResult<IEnumerable<ScholarAttendance>>> GetScholarAttendanceByYear(string year)
        {
            var attendances = await _context.ScholarAttendances
                .Where(sa => sa.Year == year)
                .ToListAsync();

            return attendances;
        }

        // POST: api/ScholarAttendance
        [HttpPost]
        public async Task<ActionResult<ScholarAttendance>> PostScholarAttendance(ScholarAttendanceDto attendanceDto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var scholarAttendance = new ScholarAttendance
                {
                    PermUserName = attendanceDto.PermUserName,
                    TotalDays = attendanceDto.TotalDays,
                    WorkingDays = attendanceDto.WorkingDays,
                    NoOfDaysPresent = attendanceDto.NoOfDaysPresent,
                    Month = attendanceDto.Month,
                    Year = attendanceDto.Year
                };

                _context.ScholarAttendances.Add(scholarAttendance);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Scholar attendance created for user: {Username}", attendanceDto.PermUserName);

                return CreatedAtAction("GetScholarAttendance", new { id = scholarAttendance.ScholarAttenId }, scholarAttendance);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating scholar attendance for user: {Username}", attendanceDto.PermUserName);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // PUT: api/ScholarAttendance/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarAttendance(int id, ScholarAttendanceDto attendanceDto)
        {
            try
            {
                var scholarAttendance = await _context.ScholarAttendances.FindAsync(id);
                if (scholarAttendance == null)
                {
                    return NotFound();
                }

                scholarAttendance.PermUserName = attendanceDto.PermUserName;
                scholarAttendance.TotalDays = attendanceDto.TotalDays;
                scholarAttendance.WorkingDays = attendanceDto.WorkingDays;
                scholarAttendance.NoOfDaysPresent = attendanceDto.NoOfDaysPresent;
                scholarAttendance.Month = attendanceDto.Month;
                scholarAttendance.Year = attendanceDto.Year;

                _context.Entry(scholarAttendance).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Scholar attendance updated for ID: {Id}", id);

                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarAttendanceExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating scholar attendance with ID: {Id}", id);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // DELETE: api/ScholarAttendance/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarAttendance(int id)
        {
            try
            {
                var scholarAttendance = await _context.ScholarAttendances.FindAsync(id);
                if (scholarAttendance == null)
                {
                    return NotFound();
                }

                _context.ScholarAttendances.Remove(scholarAttendance);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Scholar attendance deleted for ID: {Id}", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting scholar attendance with ID: {Id}", id);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // GET: api/ScholarAttendance/attendance-summary/{username}
        [HttpGet("attendance-summary/{username}")]
        public async Task<ActionResult<object>> GetAttendanceSummary(string username)
        {
            try
            {
                var attendances = await _context.ScholarAttendances
                    .Where(sa => sa.PermUserName == username)
                    .ToListAsync();

                if (!attendances.Any())
                {
                    return NotFound($"No attendance records found for user: {username}");
                }

                var summary = new
                {
                    Username = username,
                    TotalRecords = attendances.Count,
                    TotalWorkingDays = attendances.Sum(a => a.WorkingDays ?? 0),
                    TotalPresentDays = attendances.Sum(a => a.NoOfDaysPresent ?? 0),
                    AttendancePercentage = attendances.Sum(a => a.WorkingDays ?? 0) > 0 
                        ? Math.Round((double)(attendances.Sum(a => a.NoOfDaysPresent ?? 0) * 100) / attendances.Sum(a => a.WorkingDays ?? 0), 2)
                        : 0,
                    Records = attendances
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting attendance summary for user: {Username}", username);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // GET: api/ScholarAttendance/scholars-by-year-subject?year={year}&subjectId={subjectId}
        [HttpGet("scholars-by-year-subject")]
        public async Task<ActionResult<IEnumerable<object>>> GetScholarsByYearAndSubject([FromQuery] string year, [FromQuery] int? subjectId = null)
        {
            try
            {
                if (string.IsNullOrEmpty(year))
                {
                    return BadRequest("Year parameter is required");
                }

                var query = from s in _context.Scholars
                           join sa in _context.ScholarAuths on s.SID equals sa.SID
                           where s.Year == year && sa.PermUserName != null
                           select new
                           {
                               
                               Name = s.Name,
                            
                               PermUserName = sa.PermUserName,
                               
                               Subject_ID = s.Subject_ID,
                               
                           };

                // Apply subject filter only if subjectId is provided
                if (subjectId.HasValue)
                {
                    query = query.Where(x => x.Subject_ID == subjectId.Value);
                }

                var scholars = await query.ToListAsync();

                if (!scholars.Any())
                {
                    string message = subjectId.HasValue 
                        ? $"No scholars found for year: {year} and subject ID: {subjectId}" 
                        : $"No scholars found for year: {year}";
                    return NotFound(message);
                }

                return Ok(scholars);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting scholars by year: {Year} and subject ID: {SubjectId}", year, subjectId);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        // GET: api/ScholarAttendance/download-template?year={year}&months={months}&subjectId={subjectId}
        [HttpGet("download-template")]
        public async Task<IActionResult> DownloadAttendanceTemplate([FromQuery] string year, [FromQuery] string[] months, [FromQuery] int? subjectId = null)
        {
            try
            {
                if (string.IsNullOrEmpty(year))
                {
                    return BadRequest("Year parameter is required");
                }

                if (months == null || months.Length == 0)
                {
                    return BadRequest("At least one month is required");
                }

                // Get scholars based on year and optional subjectId
                var query = from s in _context.Scholars
                           join sa in _context.ScholarAuths on s.SID equals sa.SID
                           where s.Year == year && sa.PermUserName != null
                           select new
                           {
                               PermUserName = sa.PermUserName,
                               Name = s.Name,
                               Subject_ID = s.Subject_ID
                           };

                if (subjectId.HasValue)
                {
                    query = query.Where(x => x.Subject_ID == subjectId.Value);
                }

                var scholars = await query.ToListAsync();

                if (!scholars.Any())
                {
                    string message = subjectId.HasValue 
                        ? $"No scholars found for year: {year} and subject ID: {subjectId}" 
                        : $"No scholars found for year: {year}";
                    return NotFound(message);
                }

                // Calculate total days for the selected months
                // Extract the first year from academic year format (e.g., "2026-2027" -> 2026)
                int yearInt;
                if (year.Contains("-"))
                {
                    // Handle academic year format like "2026-2027"
                    string firstYear = year.Split('-')[0];
                    if (!int.TryParse(firstYear, out yearInt))
                    {
                        return BadRequest("Invalid year format");
                    }
                }
                else
                {
                    // Handle simple year format like "2026"
                    if (!int.TryParse(year, out yearInt))
                    {
                        return BadRequest("Invalid year format");
                    }
                }
                
                int totalDays = CalculateTotalDaysForMonths(months, yearInt);
                string monthsString = string.Join(", ", months);

                // Create Excel file using ClosedXML
                using (var workbook = new XLWorkbook())
                {
                    var worksheet = workbook.Worksheets.Add("Attendance Template");

                    // Set headers
                    worksheet.Cell(1, 1).Value = "ShodhnikId";
                    worksheet.Cell(1, 2).Value = "NoOfDays";
                    worksheet.Cell(1, 3).Value = "Total Working Days";
                    worksheet.Cell(1, 4).Value = "No Of Days Scholar Present";
                    worksheet.Cell(1, 5).Value = "Month";
                    worksheet.Cell(1, 6).Value = "Year";

                    // Style headers
                    var headerRange = worksheet.Range(1, 1, 1, 6);
                    headerRange.Style.Font.Bold = true;
                    headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
                    headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    headerRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                    // Fill data for each scholar
                    int row = 2;
                    foreach (var scholar in scholars)
                    {
                        worksheet.Cell(row, 1).Value = scholar.PermUserName; // ShodhnikId
                        worksheet.Cell(row, 2).Value = totalDays; // NoOfDays (auto-calculated)
                        worksheet.Cell(row, 3).Value = ""; // Total Working Days (to be filled)
                        worksheet.Cell(row, 4).Value = ""; // No Of Days Scholar Present (to be filled)
                        worksheet.Cell(row, 5).Value = monthsString; // Month
                        worksheet.Cell(row, 6).Value = year; // Year
                        row++;
                    }

                    // Auto-fit columns
                    worksheet.ColumnsUsed().AdjustToContents();

                    // Add borders to all data
                    var dataRange = worksheet.Range(1, 1, row - 1, 6);
                    dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                    // Convert to byte array
                    using (var stream = new MemoryStream())
                    {
                        workbook.SaveAs(stream);
                        var fileBytes = stream.ToArray();
                        
                        string fileName = subjectId.HasValue 
                            ? $"Attendance_Template_{year}_{string.Join("_", months)}_Subject_{subjectId}.xlsx"
                            : $"Attendance_Template_{year}_{string.Join("_", months)}.xlsx";

                        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating attendance template for year: {Year}, months: {Months}, subject ID: {SubjectId}. Error details: {ErrorMessage}", 
                    year, string.Join(",", months ?? new string[0]), subjectId, ex.Message);
                return StatusCode(500, new { success = false, message = "Internal server error", details = ex.Message });
            }
        }

        private int CalculateTotalDaysForMonths(string[] months, int year)
        {
            int totalDays = 0;
            
            foreach (string month in months)
            {
                try
                {
                    // Try parsing as month name (January, February, etc.)
                    if (DateTime.TryParseExact($"1 {month} {year}", "d MMMM yyyy", null, System.Globalization.DateTimeStyles.None, out DateTime date))
                    {
                        totalDays += DateTime.DaysInMonth(year, date.Month);
                    }
                    // Try parsing as month number (1, 2, 3, etc.)
                    else if (int.TryParse(month, out int monthNumber) && monthNumber >= 1 && monthNumber <= 12)
                    {
                        totalDays += DateTime.DaysInMonth(year, monthNumber);
                    }
                    // Try parsing short month names (Jan, Feb, etc.)
                    else if (DateTime.TryParseExact($"1 {month} {year}", "d MMM yyyy", null, System.Globalization.DateTimeStyles.None, out DateTime shortDate))
                    {
                        totalDays += DateTime.DaysInMonth(year, shortDate.Month);
                    }
                    else
                    {
                        // Default to 30 days if month format is not recognized
                        totalDays += 30;
                    }
                }
                catch
                {
                    // If any parsing fails, default to 30 days
                    totalDays += 30;
                }
            }
            
            return totalDays;
        }

        // POST: api/ScholarAttendance/bulk-create
        [HttpPost("bulk-create")]
        public async Task<ActionResult<object>> BulkCreateScholarAttendance([FromBody] List<ScholarAttendanceDto> attendanceDtos)
        {
            try
            {
                if (attendanceDtos == null || !attendanceDtos.Any())
                {
                    return BadRequest(new { success = false, message = "Attendance data array is required and cannot be empty" });
                }

                var results = new List<object>();
                var successCount = 0;
                var errorCount = 0;

                foreach (var attendanceDto in attendanceDtos)
                {
                    try
                    {
                        // Validate individual record
                        if (string.IsNullOrEmpty(attendanceDto.PermUserName))
                        {
                            results.Add(new
                            {
                                permUserName = attendanceDto.PermUserName,
                                success = false,
                                message = "PermUserName is required"
                            });
                            errorCount++;
                            continue;
                        }

                        var scholarAttendance = new ScholarAttendance
                        {
                            PermUserName = attendanceDto.PermUserName,
                            TotalDays = attendanceDto.TotalDays,
                            WorkingDays = attendanceDto.WorkingDays,
                            NoOfDaysPresent = attendanceDto.NoOfDaysPresent,
                            Month = attendanceDto.Month,
                            Year = attendanceDto.Year
                        };

                        _context.ScholarAttendances.Add(scholarAttendance);
                        await _context.SaveChangesAsync();

                        results.Add(new
                        {
                            permUserName = attendanceDto.PermUserName,
                            success = true,
                            message = "Attendance record created successfully",
                            id = scholarAttendance.ScholarAttenId
                        });
                        successCount++;

                        _logger.LogInformation("Bulk attendance created for user: {Username}", attendanceDto.PermUserName);
                    }
                    catch (Exception ex)
                    {
                        results.Add(new
                        {
                            permUserName = attendanceDto.PermUserName,
                            success = false,
                            message = ex.Message
                        });
                        errorCount++;
                        _logger.LogError(ex, "Error creating bulk attendance for user: {Username}", attendanceDto.PermUserName);
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = $"Bulk operation completed. {successCount} successful, {errorCount} failed.",
                    totalRecords = attendanceDtos.Count,
                    successCount = successCount,
                    errorCount = errorCount,
                    results = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in bulk create scholar attendance");
                return StatusCode(500, new { success = false, message = "Internal server error", details = ex.Message });
            }
        }

        // POST: api/ScholarAttendance/bulk-update
        [HttpPost("bulk-update")]
        public async Task<ActionResult<object>> BulkUpdateScholarAttendance([FromBody] List<BulkUpdateAttendanceDto> attendanceDtos)
        {
            try
            {
                if (attendanceDtos == null || !attendanceDtos.Any())
                {
                    return BadRequest(new { success = false, message = "Attendance data array is required and cannot be empty" });
                }

                var results = new List<object>();
                var successCount = 0;
                var errorCount = 0;

                foreach (var attendanceDto in attendanceDtos)
                {
                    try
                    {
                        var scholarAttendance = await _context.ScholarAttendances.FindAsync(attendanceDto.Id);
                        if (scholarAttendance == null)
                        {
                            results.Add(new
                            {
                                id = attendanceDto.Id,
                                success = false,
                                message = "Attendance record not found"
                            });
                            errorCount++;
                            continue;
                        }

                        // Update fields
                        scholarAttendance.PermUserName = attendanceDto.PermUserName ?? scholarAttendance.PermUserName;
                        scholarAttendance.TotalDays = attendanceDto.TotalDays ?? scholarAttendance.TotalDays;
                        scholarAttendance.WorkingDays = attendanceDto.WorkingDays ?? scholarAttendance.WorkingDays;
                        scholarAttendance.NoOfDaysPresent = attendanceDto.NoOfDaysPresent ?? scholarAttendance.NoOfDaysPresent;
                        scholarAttendance.Month = attendanceDto.Month ?? scholarAttendance.Month;
                        scholarAttendance.Year = attendanceDto.Year ?? scholarAttendance.Year;

                        _context.Entry(scholarAttendance).State = EntityState.Modified;
                        await _context.SaveChangesAsync();

                        results.Add(new
                        {
                            id = attendanceDto.Id,
                            success = true,
                            message = "Attendance record updated successfully"
                        });
                        successCount++;

                        _logger.LogInformation("Bulk attendance updated for ID: {Id}", attendanceDto.Id);
                    }
                    catch (Exception ex)
                    {
                        results.Add(new
                        {
                            id = attendanceDto.Id,
                            success = false,
                            message = ex.Message
                        });
                        errorCount++;
                        _logger.LogError(ex, "Error updating bulk attendance for ID: {Id}", attendanceDto.Id);
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = $"Bulk update completed. {successCount} successful, {errorCount} failed.",
                    totalRecords = attendanceDtos.Count,
                    successCount = successCount,
                    errorCount = errorCount,
                    results = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in bulk update scholar attendance");
                return StatusCode(500, new { success = false, message = "Internal server error", details = ex.Message });
            }
        }


        [HttpGet("attendance/percentage/{permUserName}")]
        public async Task<IActionResult> GetAttendancePercentage(string permUserName)
        {
            if (string.IsNullOrWhiteSpace(permUserName))
                return BadRequest("PermUserName is required.");

            var attendance = await _context.ScholarAttendances
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.PermUserName == permUserName);

            if (attendance == null)
                return NotFound("Attendance record not found.");

            if (attendance.WorkingDays == null || attendance.WorkingDays == 0)
                return BadRequest("Working days are not available or zero.");

            if (attendance.NoOfDaysPresent == null)
                return BadRequest("NoOfDaysPresent is not available.");

            var attendancePercentage =
                Math.Round(
                    ((double)attendance.NoOfDaysPresent.Value / attendance.WorkingDays.Value) * 100,
                    2
                );

            return Ok(new
            {
                permUserName = attendance.PermUserName,
                totalDays = attendance.TotalDays,
                workingDays = attendance.WorkingDays,
                daysPresent = attendance.NoOfDaysPresent,
                attendancePercentage
            });
        }


        private bool ScholarAttendanceExists(int id)
        {
            return _context.ScholarAttendances.Any(e => e.ScholarAttenId == id);
        }
    }

    // DTO for creating/updating scholar attendance
    public class ScholarAttendanceDto
    {
        public string? PermUserName { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Total days must be a positive number")]
        public int? TotalDays { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Working days must be a positive number")]
        public int? WorkingDays { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Present days must be a positive number")]
        public int? NoOfDaysPresent { get; set; }
        
        public List<string>? Month { get; set; }
        
        public string? Year { get; set; }
    }

    // DTO for bulk update operations
    public class BulkUpdateAttendanceDto
    {
        [Required]
        public int Id { get; set; }
        
        public string? PermUserName { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Total days must be a positive number")]
        public int? TotalDays { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Working days must be a positive number")]
        public int? WorkingDays { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Present days must be a positive number")]
        public int? NoOfDaysPresent { get; set; }
        
        public List<string>? Month { get; set; }
        
        public string? Year { get; set; }
    }
}