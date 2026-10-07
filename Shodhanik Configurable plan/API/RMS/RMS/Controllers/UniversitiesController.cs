using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UniversitiesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public UniversitiesController(RMSDbContext context)
        {
            _context = context;
        }

        [HttpGet("Universities")]
        public async Task<ActionResult<IEnumerable<University>>> GetUniversity()
        {
            return await _context.Universities.ToListAsync();
        }

        [HttpGet("Colleges")]
        public async Task<ActionResult<IEnumerable<CollegeList>>> GetCollege(int UniId)
        {
            return await _context.CollegeLists.Where(s=>s.UniversityId == UniId).ToListAsync();
        }
    }
}
