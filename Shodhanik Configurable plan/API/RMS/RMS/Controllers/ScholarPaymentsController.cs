using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScholarPaymentsController : ControllerBase
    {
        private readonly RMSDbContext _context;
        private readonly IWorkflowService _workflowService;

        public ScholarPaymentsController(RMSDbContext context, IWorkflowService workflowService)
        {
            _context = context;
            _workflowService = workflowService;
        }

        // =====================================================
        // GET: api/ScholarPayments
        // =====================================================
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _context.ScholarPayments.ToListAsync());
        }

        // =====================================================
        // GET: api/ScholarPayments/5
        // =====================================================
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var payment = await _context.ScholarPayments.FindAsync(id);

            if (payment == null)
                return NotFound("Payment record not found.");

            return Ok(payment);
        }

        // =====================================================
        // GET: api/ScholarPayments/by-sid/10
        // =====================================================
        [HttpGet("by-sid/{sid:int}")]
        public async Task<IActionResult> GetBySID(int sid)
        {
            var payments = await (
                from sp in _context.ScholarPayments
                join fc in _context.FeeCategories
                    on (int?)sp.PaymentCategory equals fc.FCID into fcJoin
                from fc in fcJoin.DefaultIfEmpty() // LEFT JOIN
                where sp.SID == sid
                orderby sp.SPID
                select new
                {
                    sp.SPID,
                    sp.SID,
                    sp.Token,
                    sp.TransactionID,
                    sp.PaymentStatus,
                    sp.PaymentCategory,

                    FeeCategoryName = fc != null ? fc.CategoryName : null,
                    FeeAmount = fc != null ? fc.Amount : (decimal?)null,

                    sp.HashReturn,
                    sp.Discription,
                    sp.PaymentDate,
                    sp.IPAddress,
                    sp.Created,
                    sp.Modified,
                    sp.Remark,
                    sp.Transfer,
                    sp.Category
                }
            ).ToListAsync();

            return Ok(payments);
        }


        // =====================================================
        // POST: api/ScholarPayments
        // =====================================================
        [HttpPost]
        public async Task<IActionResult> Create(ScholarPayment model)
        {
            model.Created = DateTime.Now;

            _context.ScholarPayments.Add(model);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById),
                new { id = model.SPID }, model);
        }

        // =====================================================
        // PUT: api/ScholarPayments/5
        // =====================================================
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, ScholarPayment model)
        {
            if (id != model.SPID)
                return BadRequest("SPID mismatch.");

            var exists = await _context.ScholarPayments
                .AnyAsync(p => p.SPID == id);

            if (!exists)
                return NotFound("Payment record not found.");

            model.Modified = DateTime.Now;

            _context.Entry(model).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(model);
        }

        // =====================================================
        // PATCH: api/ScholarPayments/status/5
        // =====================================================
        [HttpPatch("status/{id:int}")]
        public async Task<IActionResult> UpdateStatus(
            int id,
            [FromQuery] PaymentStatus status,
            [FromQuery] string? remark)
        {
            var payment = await _context.ScholarPayments.FindAsync(id);

            if (payment == null)
                return NotFound("Payment record not found.");

            payment.PaymentStatus = status;
            payment.Remark = remark;
            payment.Modified = DateTime.Now;

            await _context.SaveChangesAsync();

            // 🚀 Trigger Workflow if Registration Payment is successful
            if (status == PaymentStatus.Successful && (payment.PaymentCategory == PaymentCategory.RETPayment))
            {
                await _workflowService.StartWorkflowAsync("ScholarRegistration", payment.SID, "Scholar");
            }

            return Ok("Payment status updated.");
        }


        [HttpGet("ScholarPaymentRecord/{sid}")]
        public async Task<IActionResult> CreateCourseworkPayment(int sid)
        {
            if (sid <= 0)
                return BadRequest("Invalid SID.");

            bool courseworkCreated = false;
            bool synopsisCreated = false;
            bool plagCreated = false;
            bool thesisCreated = false;

            // 1️⃣ Coursework approval
            var coursework = await _context.CourseWorks
                .AsNoTracking()
                .FirstOrDefaultAsync(c =>
                    c.SID == sid &&
                    c.CourseWorkResult == CourseWorkDecisions.CourseworkApproved);

            if (coursework == null)
                return BadRequest("Coursework is not approved for this scholar.");

            // 2️⃣ Scholar category
            var categoryRaw = await _context.ScholarPersonalDetails
                .AsNoTracking()
                .Where(s => s.SID == sid)
                .Select(s => s.Category)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(categoryRaw))
                return BadRequest("Scholar category not found.");

            var category = categoryRaw.Trim().ToLower();
            bool isUROBC = category == "general" || category == "obc";
            bool isSCST = category == "sc" || category == "st";

            if (!isUROBC && !isSCST)
                return BadRequest("Unsupported scholar category.");

            // 3️⃣ Coursework fee category
            string courseworkFeeName = isUROBC
                ? "Scholar Pre Ph.D Coursework Fee(UR/OBC)"
                : "Scholar Pre Ph.D Coursework Fee(SC/ST)";

            var courseworkFee = await _context.FeeCategories
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.CategoryName == courseworkFeeName);

            if (courseworkFee == null)
                return StatusCode(500, "Coursework fee category not configured.");

            // 4️⃣ Coursework payment
            var courseworkPayment = await _context.ScholarPayments
                .FirstOrDefaultAsync(p =>
                    p.SID == sid &&
                    p.PaymentCategory == (PaymentCategory)courseworkFee.FCID);

            if (courseworkPayment == null)
            {
                courseworkPayment = new ScholarPayment
                {
                    SID = sid,
                    PaymentCategory = (PaymentCategory)courseworkFee.FCID,
                    PaymentStatus = PaymentStatus.Pending,
                    Created = DateTime.UtcNow,
                    Category = courseworkFee.CategoryName,
                    Remark = "Coursework fee generated after approval"
                };

                _context.ScholarPayments.Add(courseworkPayment);
                await _context.SaveChangesAsync();
                courseworkCreated = true;
            }

            // 5️⃣ Synopsis Fee
            if (courseworkPayment.PaymentStatus == PaymentStatus.Successful)
            {
                bool synopsisFileExists = await _context.SynopsisRDCs
                    .AsNoTracking()
                    .AnyAsync(s =>
                        s.SID == sid &&
                        !string.IsNullOrWhiteSpace(s.Synopsis1FilePath));

                if (synopsisFileExists)
                {
                   

                    bool synopsisExists = await _context.ScholarPayments
                        .AnyAsync(p =>
                            p.SID == sid &&
                            p.PaymentCategory == PaymentCategory.SynopsisFee);

                    if (!synopsisExists)
                    {
                        _context.ScholarPayments.Add(new ScholarPayment
                        {
                            SID = sid,
                            PaymentCategory = PaymentCategory.SynopsisFee,
                            PaymentStatus = PaymentStatus.Pending,
                            Created = DateTime.UtcNow,
                            Category = "Synopsis Fee",
                            Remark = "Synopsis fee generated after coursework success"
                        });

                        await _context.SaveChangesAsync();
                        synopsisCreated = true;
                    }
                }
            }

            // 6️⃣ Thesis → Plag + Thesis fee (parallel)
            var thesis = await _context.Thesis
                .AsNoTracking()
                .FirstOrDefaultAsync(t =>
                    t.SID == sid &&
                    !string.IsNullOrWhiteSpace(t.Thesis_File));

            if (thesis != null)
            {
                // Plag fee
                const int PlagFeeFCID = 13;

                if (!await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == sid &&
                    p.PaymentCategory == (PaymentCategory)PlagFeeFCID))
                {
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = sid,
                        PaymentCategory = (PaymentCategory)PlagFeeFCID,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = "Plag Fee",
                        Remark = "Plag fee generated after thesis upload"
                    });

                    await _context.SaveChangesAsync();
                    plagCreated = true;
                }

                // Thesis fee
                int thesisFCID = isUROBC ? 6 : 7;
                string thesisCategory = isUROBC
                    ? "Scholar Thesis Fee"
                    : "Scholar Thesis Fee (Special)";

                if (!await _context.ScholarPayments.AnyAsync(p =>
                    p.SID == sid &&
                    p.PaymentCategory == (PaymentCategory)thesisFCID))
                {
                    _context.ScholarPayments.Add(new ScholarPayment
                    {
                        SID = sid,
                        PaymentCategory = (PaymentCategory)thesisFCID,
                        PaymentStatus = PaymentStatus.Pending,
                        Created = DateTime.UtcNow,
                        Category = thesisCategory,
                        Remark = "Thesis fee generated after thesis upload"
                    });

                    await _context.SaveChangesAsync();
                    thesisCreated = true;
                }
            }

            // 7️⃣ Response
            string message =
                thesisCreated ? "Thesis and plagiarism fees generated successfully."
              : plagCreated ? "Plagiarism fee generated successfully."
              : synopsisCreated ? "Synopsis fee generated successfully."
              : courseworkCreated ? "Coursework payment entry created successfully."
              : "Payment records already created.";

            return Ok(new
            {
                success = true,
                message,
                data = new
                {
                    sid,
                    category = isUROBC ? "UR/OBC" : "SC/ST",
                    courseworkCreated,
                    synopsisCreated,
                    plagCreated,
                    thesisCreated
                }
            });
        }


        // =====================================================
        // DELETE: api/ScholarPayments/5
        // =====================================================
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var payment = await _context.ScholarPayments.FindAsync(id);

            if (payment == null)
                return NotFound("Payment record not found.");

            _context.ScholarPayments.Remove(payment);
            await _context.SaveChangesAsync();

            return Ok("Payment deleted successfully.");
        }
    }
}
