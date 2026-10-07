//using Microsoft.AspNetCore.Mvc;
//using Microsoft.EntityFrameworkCore;
//using RMS.Data;
//using RMS.Models;

//namespace RMS.Controllers
//{
//    [Route("api/[controller]")]
//    [ApiController]
//    public class PartTimePositionController : ControllerBase
//    {
//        private readonly RMSDbContext _context;

//        public PartTimePositionController(RMSDbContext context)
//        {
//            _context = context;
//        }

//        // 🔹 GET: api/PartTimePosition
//        [HttpGet]
//        public async Task<ActionResult<IEnumerable<PartTimePosition>>> GetPartTimePositions()
//        {
//            return await _context.PartTimePositions
//                .OrderBy(x => x.PTPName)
//                .ToListAsync();
//        }

//        // 🔹 GET: api/PartTimePosition/5
//        [HttpGet("{id}")]
//        public async Task<ActionResult<PartTimePosition>> GetPartTimePosition(int id)
//        {
//            var data = await _context.PartTimePositions.FindAsync(id);

//            if (data == null)
//                return NotFound();

//            return Ok(data);
//        }

//        // 🔹 POST: api/PartTimePosition
//        [HttpPost]
//        public async Task<IActionResult> CreatePartTimePosition([FromBody] PartTimePosition model)
//        {
//            if (!ModelState.IsValid)
//                return BadRequest(ModelState);

//            // Prevent duplicate names
//            bool exists = await _context.PartTimePositions
//                .AnyAsync(x => x.PTPName == model.PTPName);

//            if (exists)
//                return Conflict("Part-time position already exists.");

//            _context.PartTimePositions.Add(model);
//            await _context.SaveChangesAsync();

//            return CreatedAtAction(nameof(GetPartTimePosition),
//                new { id = model.PTPID }, model);
//        }

//        // 🔹 PUT: api/PartTimePosition/5
//        [HttpPut("{id}")]
//        public async Task<IActionResult> UpdatePartTimePosition(int id, [FromBody] PartTimePosition model)
//        {
//            if (id != model.PTPID)
//                return BadRequest("ID mismatch.");

//            if (!ModelState.IsValid)
//                return BadRequest(ModelState);

//            var data = await _context.PartTimePositions.FindAsync(id);
//            if (data == null)
//                return NotFound();

//            data.PTPName = model.PTPName;

//            await _context.SaveChangesAsync();
//            return NoContent();
//        }

//        // 🔹 DELETE: api/PartTimePosition/5
//        [HttpDelete("{id}")]
//        public async Task<IActionResult> DeletePartTimePosition(int id)
//        {
//            var data = await _context.PartTimePositions.FindAsync(id);
//            if (data == null)
//                return NotFound();

//            _context.PartTimePositions.Remove(data);
//            await _context.SaveChangesAsync();

//            return NoContent();
//        }
//    }
//}
