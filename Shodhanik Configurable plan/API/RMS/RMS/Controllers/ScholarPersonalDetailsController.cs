using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarPersonalDetailsController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public ScholarPersonalDetailsController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/ScholarPersonalDetails
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ScholarPersonalDetail>>> GetScholarPersonalDetails()
        {
            return await _context.ScholarPersonalDetails.ToListAsync();
        }

        // GET: api/ScholarPersonalDetails/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ScholarPersonalDetail>> GetScholarPersonalDetail(int id)
        {
            var scholarPersonalDetail = await _context.ScholarPersonalDetails.FindAsync(id);

            if (scholarPersonalDetail == null)
            {
                return NotFound();
            }

            return scholarPersonalDetail;
        }

        // PUT: api/ScholarPersonalDetails/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutScholarPersonalDetail(int id, ScholarPersonalDetail scholarPersonalDetail)
        {
            if (id != scholarPersonalDetail.SPDID)
            {
                return BadRequest();
            }

            _context.Entry(scholarPersonalDetail).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScholarPersonalDetailExists(id))
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

        // POST: api/ScholarPersonalDetails
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ScholarPersonalDetail>> PostScholarPersonalDetail(ScholarPersonalDetail scholarPersonalDetail)
        {
            // Check if SID already exists
            bool sidExists = await _context.ScholarPersonalDetails
                .AnyAsync(x => x.SID == scholarPersonalDetail.SID);

            if (sidExists)
            {
                return BadRequest(new
                {
                    Message = "SID already exists. Duplicate entries are not allowed."
                });
            }

            _context.ScholarPersonalDetails.Add(scholarPersonalDetail);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetScholarPersonalDetail",
                new { id = scholarPersonalDetail.SPDID },
                scholarPersonalDetail);
        }


        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchScholarPersonalDetail(int id, [FromBody] JsonElement updates)
        {
            var scholar = await _context.ScholarPersonalDetails.FindAsync(id);
            if (scholar == null)
            {
                return NotFound(new { message = "Scholar personal detail not found." });
            }

            // Convert existing entity to dictionary for dynamic update
            var scholarDict = scholar.GetType()
                .GetProperties()
                .ToDictionary(p => p.Name, p => p.GetValue(scholar));

            // Apply incoming JSON updates dynamically
            foreach (var prop in updates.EnumerateObject())
            {
                var property = scholar.GetType().GetProperty(prop.Name,
                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.IgnoreCase | System.Reflection.BindingFlags.Instance);

                if (property != null && property.CanWrite)
                {
                    object? convertedValue = null;
                    try
                    {
                        convertedValue = Convert.ChangeType(prop.Value.ToString(), property.PropertyType);
                    }
                    catch
                    {
                        // Handle special cases like DateTime
                        if (property.PropertyType == typeof(DateTime))
                        {
                            if (DateTime.TryParse(prop.Value.ToString(), out DateTime dt))
                                convertedValue = dt;
                        }
                        else if (Nullable.GetUnderlyingType(property.PropertyType) != null)
                        {
                            convertedValue = Convert.ChangeType(prop.Value.ToString(), Nullable.GetUnderlyingType(property.PropertyType));
                        }
                    }

                    property.SetValue(scholar, convertedValue);
                }
            }

            _context.Entry(scholar).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Scholar personal detail updated successfully.", scholar });
        }

        // DELETE: api/ScholarPersonalDetails/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScholarPersonalDetail(int id)
        {
            var scholarPersonalDetail = await _context.ScholarPersonalDetails.FindAsync(id);
            if (scholarPersonalDetail == null)
            {
                return NotFound();
            }

            _context.ScholarPersonalDetails.Remove(scholarPersonalDetail);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        [HttpGet("GetPersonalDetailBySID")]
        public async Task<IActionResult> GetPersonalDetailBySID([FromQuery] int sid)
        {
            if (sid <= 0)
            {
                return BadRequest(new { Message = "Please provide a valid SID." });
            }

            var data = await _context.ScholarPersonalDetails
                .FirstOrDefaultAsync(x => x.SID == sid);

            if (data == null)
            {
                return NotFound(new { Message = "No personal details found for this SID." });
            }

            return Ok(data);
        }

        [HttpGet("GetCountryAndIdentityProofBySID")]
        public async Task<IActionResult> GetCountryAndIdentityProofBySID([FromQuery] int sid)
        {
            if (sid <= 0)
            {
                return BadRequest(new { Message = "Please provide a valid SID." });
            }

            var data = await _context.ScholarPersonalDetails
                .Where(x => x.SID == sid)
                .Select(x => new
                {
                    x.Country,
                    x.IdentityProof
                })
                .FirstOrDefaultAsync();

            if (data == null)
            {
                return NotFound(new { Message = "No record found for the entered SID." });
            }

            return Ok(data);
        }


        //[HttpGet("GetScholarBasicDetailBySID")]
        //public async Task<IActionResult> GetScholarBasicDetailBySID([FromQuery] int sid)
        //{
        //    if (sid <= 0)
        //        return BadRequest(new { Message = "Please provide a valid SID." });

        //    var data = await (
        //        from s in _context.Scholars
        //        join spd in _context.ScholarPersonalDetails
        //            on s.SID equals spd.SID
        //        join sa in _context.ScholarAuths on s.SID equals sa.SID
        //        join dpt in _context.Departments on s.Subject_ID equals dpt.DepartmentID
        //        join su in _context.ScholarUploads
        //            .Where(x => x.DocumentMasterID == 1)
        //            on s.SID equals su.SID into uploadGroup
        //        from su in uploadGroup.DefaultIfEmpty()
        //        where s.SID == sid
        //        select new 
        //        {
        //            ShodhanikID = sa.PermUserName,
        //            Year = s.Year,
        //            Subject_ID = s.Subject_ID,
        //            Subject = dpt.Subject,
        //            Name = s.Name,
        //            Email = s.Email,
        //            PhoneNumber = s.PhoneNumber,
        //            PermanentAddress = spd.PermanentAddress,
        //            CorrespondenceAddress = spd.CorrespondenceAddress,
        //            DocumentPath = su != null ? su.Path : null
        //        }
        //    ).FirstOrDefaultAsync();

        //    if (data == null)
        //        return NotFound(new { Message = "Scholar data not found for given SID." });

        //    return Ok(data);
        //}

        [HttpGet("GetScholarBasicDetailBySID")]
        public async Task<IActionResult> GetScholarBasicDetailBySID([FromQuery] int sid)
        {
            if (sid <= 0)
                return BadRequest(new { Message = "Please provide a valid SID." });

            var data = await (
                from s in _context.Scholars
                join spd in _context.ScholarPersonalDetails
                    on s.SID equals spd.SID
                join sa in _context.ScholarAuths
                    on s.SID equals sa.SID
                join dpt in _context.Departments
                    on s.Subject_ID equals dpt.DepartmentID

                // Photograph (DocumentMasterID = 1)
                join su in _context.ScholarUploads
                    .Where(x => x.DocumentMasterID == 1)
                    on s.SID equals su.SID into photoGroup
                from su in photoGroup.DefaultIfEmpty()

                    // Signature (DocumentMasterID = 2)
                join sig in _context.ScholarUploads
                    .Where(x => x.DocumentMasterID == 2)
                    on s.SID equals sig.SID into signGroup
                from sig in signGroup.DefaultIfEmpty()

                where s.SID == sid
                select new
                {
                    ShodhanikID = sa.PermUserName,
                    Year = s.Year,
                    Subject_ID = s.Subject_ID,
                    Subject = dpt.Subject,
                    Name = s.Name,
                    Email = s.Email,
                    PhoneNumber = s.PhoneNumber,
                    Category = spd.Category,
                    PermanentAddress = spd.PermanentAddress,
                    CorrespondenceAddress = spd.CorrespondenceAddress,

                    // ❌ DO NOT TOUCH
                    DocumentPath = su != null ? su.Path : null,

                    // ✅ NEW FIELD ONLY
                    SignaturePath = sig != null ? sig.Path : null
                }
            ).FirstOrDefaultAsync();

            if (data == null)
                return NotFound(new { Message = "Scholar data not found for given SID." });

            return Ok(data);
        }


        [HttpGet("GetScholarSummaryBySID")]
        public async Task<IActionResult> GetScholarSummaryBySID([FromQuery] int sid)
        {
            if (sid <= 0)
                return BadRequest(new { Message = "Please provide a valid SID." });

            var data = await (
                from s in _context.Scholars
                join spd in _context.ScholarPersonalDetails
                    on s.SID equals spd.SID
                join sa in _context.ScholarAuths on s.SID equals sa.SID
                join dpt in _context.Departments on s.Subject_ID equals dpt.DepartmentID
                join su in _context.ScholarUploads
                    .Where(x => x.DocumentMasterID == 1)
                    on s.SID equals su.SID into uploadGroup
                from su in uploadGroup.DefaultIfEmpty()
                where s.SID == sid
                select new
                {
                    ShodhanikID = sa.PermUserName,
                    Year = s.Year,
                    Subject_ID = s.Subject_ID,
                    Subject = dpt.Subject,
                    Name = s.Name,
                    Email = s.Email,
                    PhoneNumber = s.PhoneNumber,
                    PermanentAddress = spd.PermanentAddress,
                    CorrespondenceAddress = spd.CorrespondenceAddress,
                    DocumentPath = su != null ? su.Path : null
                }
            ).FirstOrDefaultAsync();

            if (data == null)
                return NotFound(new { Message = "Scholar data not found for given SID." });

            return Ok(data);
        }

        public class ScholarBasicDetailDto
        {
            public string Year { get; set; }
            public int Subject_ID { get; set; }
            public string Subject { get; set; }
            public string Name { get; set; }
            public string Email { get; set; }
            public string PhoneNumber { get; set; }
            public string PermanentAddress { get; set; }
            public string CorrespondenceAddress { get; set; }
            public string? DocumentPath { get; set; }
            public string? GuardianName { get; set; }
        }


        private bool ScholarPersonalDetailExists(int id)
        {
            return _context.ScholarPersonalDetails.Any(e => e.SPDID == id);
        }
    }
}
