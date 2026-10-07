using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StatesController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public StatesController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/States
        [HttpGet]
        public async Task<ActionResult<IEnumerable<State>>> GetStates()
        {
            return await _context.States.ToListAsync();
        }

        // GET: api/States/5
        [HttpGet("{id}")]
        public async Task<ActionResult<State>> GetState(int id)
        {
            var state = await _context.States.FindAsync(id);

            if (state == null)
            {
                return NotFound();
            }

            return state;
        }

        // PUT: api/States/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutState(int id, State state)
        {
            if (id != state.StateID)
            {
                return BadRequest();
            }

            _context.Entry(state).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!StateExists(id))
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

        // POST: api/States
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<State>> PostState(State state)
        {
            _context.States.Add(state);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetState", new { id = state.StateID }, state);
        }

        // DELETE: api/States/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteState(int id)
        {
            var state = await _context.States.FindAsync(id);
            if (state == null)
            {
                return NotFound();
            }

            _context.States.Remove(state);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("GetState")]
        public async Task<ActionResult<IEnumerable<string>>> GetStateName()
        {

            var states = await _context.States
                .Select(s => s.StateName)
                .Distinct() // removes duplicates
                .ToListAsync();

            if (states == null || states.Count == 0)
                return NotFound(new { Message = "No cities found for the provided state name" });

            return Ok(states);
        }
        // GET: api/States/GetCitiesByStateName?stateName=Gujarat
        [HttpGet("GetCitiesByStateName")]
        public async Task<ActionResult<IEnumerable<string>>> GetCitiesByStateName([FromQuery] string stateName)
        {
            if (string.IsNullOrWhiteSpace(stateName))
                return BadRequest(new { Message = "Please provide a valid state name" });

            var cities = await _context.States
                .Where(s => s.StateName.ToLower() == stateName.ToLower())
                .Select(s => s.City)
                .Distinct() // removes duplicates
                .ToListAsync();

            if (cities == null || cities.Count == 0)
                return NotFound(new { Message = "No cities found for the provided state name" });

            return Ok(cities);
        }

        private bool StateExists(int id)
        {
            return _context.States.Any(e => e.StateID == id);
        }
    }
}
