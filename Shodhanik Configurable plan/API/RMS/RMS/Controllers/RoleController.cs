using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class RoleController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public RoleController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/roles
        [HttpGet("roles")]
        public async Task<ActionResult<IEnumerable<object>>> GetRoles()
        {
            var roles = await _context.Roles
                .Select(r => new
                {
                    id = r.RoleID,
                    roleName = r.RoleName,
                    name = r.RoleName,
                    description = r.Description,
                    permissions = r.Permissions,
                    userCount = _context.Admins.Count(a => a.RoleId == r.RoleID),
                    createdAt = DateTime.Now // You may want to add CreatedAt to the Role model
                })
                .ToListAsync();

            return Ok(roles);
        }

        // GET: api/admin/roles/5
        [HttpGet("roles/{id}")]
        public async Task<ActionResult<object>> GetRole(int id)
        {
            var role = await _context.Roles
                .Where(r => r.RoleID == id)
                .Select(r => new
                {
                    id = r.RoleID,
                    roleName = r.RoleName,
                    name = r.RoleName,
                    description = r.Description,
                    permissions = r.Permissions,
                    userCount = _context.Admins.Count(a => a.RoleId == r.RoleID)
                })
                .FirstOrDefaultAsync();

            if (role == null)
            {
                return NotFound();
            }

            return Ok(role);
        }

        // POST: api/admin/roles
        [HttpPost("roles")]
        public async Task<ActionResult<Role>> CreateRole(CreateRoleRequest request)
        {
            var role = new Role
            {
                RoleName = request.RoleName,
                Description = request.Description,
                Permissions = request.PermissionsList ?? new List<string>()
            };

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRole), new { id = role.RoleID }, role);
        }

        // PUT: api/admin/roles/5
        [HttpPut("roles/{id}")]
        public async Task<IActionResult> UpdateRole(int id, UpdateRoleRequest request)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleID == id);
            if (role == null)
            {
                return NotFound();
            }

            role.RoleName = request.RoleName;
            role.Description = request.Description;
            role.Permissions = request.PermissionsList ?? new List<string>();

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RoleExists(id))
                {
                    return NotFound();
                }
                throw;
            }

            return NoContent();
        }

        // DELETE: api/admin/roles/5
        [HttpDelete("roles/{id}")]
        public async Task<IActionResult> DeleteRole(int id)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleID == id);
            if (role == null)
            {
                return NotFound();
            }

            // Check if role is being used by any admins
            var adminCount = await _context.Admins.CountAsync(a => a.RoleId == id);
            if (adminCount > 0)
            {
                return BadRequest(new { message = $"Cannot delete role. It is assigned to {adminCount} admin(s)." });
            }

            _context.Roles.Remove(role);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/admin/roles/5/permissions
        [HttpGet("roles/{id}/permissions")]
        public async Task<ActionResult<object>> GetRolePermissions(int id)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleID == id);
            if (role == null)
            {
                return NotFound();
            }

            return Ok(new { permissions = role.Permissions ?? new List<string>() });
        }

        // PUT: api/admin/roles/5/permissions
        [HttpPut("roles/{id}/permissions")]
        public async Task<IActionResult> UpdateRolePermissions(int id, UpdatePermissionsRequest request)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleID == id);
            if (role == null)
            {
                return NotFound();
            }

            role.Permissions = request.PermissionsList ?? new List<string>();

            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool RoleExists(int id)
        {
            return _context.Roles.Any(e => e.RoleID == id);
        }
    }

    // Request DTOs
    public class CreateRoleRequest
    {
        public string RoleName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<string>? PermissionsList { get; set; }
    }

    public class UpdateRoleRequest
    {
        public string RoleName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<string>? PermissionsList { get; set; }
    }

    public class UpdatePermissionsRequest
    {
        public List<string>? PermissionsList { get; set; }
    }
}