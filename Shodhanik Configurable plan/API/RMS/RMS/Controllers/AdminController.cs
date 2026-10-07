using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RMS.Data;
using RMS.Models;
using System.ComponentModel.DataAnnotations;

namespace RMS.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly RMSDbContext _context;

        public AdminController(RMSDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/users
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            try
            {
                var users = await _context.Admins
                    .Select(a => new
                    {
                        id = a.AID,
                        name = a.Name,
                        email = a.Email,
                        phone = a.Phone,
                        roleId = a.RoleId,
                        roleName = _context.Roles.Where(r => r.RoleID == a.RoleId).Select(r => r.RoleName).FirstOrDefault(),
                        permissions = _context.Roles.Where(r => r.RoleID == a.RoleId).Select(r => r.Permissions).FirstOrDefault()
                    })
                    .ToListAsync();

                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving users", error = ex.Message });
            }
        }

        // GET: api/admin/users/5
        [HttpGet("users/{id}")]
        public async Task<ActionResult<object>> GetUser(int id)
        {
            try
            {
                var user = await _context.Admins
                    .Where(a => a.AID == id)
                    .Select(a => new
                    {
                        id = a.AID,
                        name = a.Name,
                        email = a.Email,
                        phone = a.Phone,
                        roleId = a.RoleId,
                        roleName = _context.Roles.Where(r => r.RoleID == a.RoleId).Select(r => r.RoleName).FirstOrDefault(),
                        permissions = _context.Roles.Where(r => r.RoleID == a.RoleId).Select(r => r.Permissions).FirstOrDefault()
                    })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                return Ok(user);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving user", error = ex.Message });
            }
        }

        // POST: api/admin/users
        [HttpPost("users")]
        public async Task<ActionResult<Admin>> CreateUser(CreateUserRequest request)
        {
            try
            {
                // Validate role exists
                var roleExists = await _context.Roles.AnyAsync(r => r.RoleID == request.RoleId);
                if (!roleExists)
                {
                    return BadRequest(new { message = "Invalid role ID" });
                }

                // Check if email already exists
                var emailExists = await _context.Admins.AnyAsync(a => a.Email == request.Email);
                if (emailExists)
                {
                    return BadRequest(new { message = "Email already exists" });
                }

                var admin = new Admin
                {
                    Name = request.Name,
                    Email = request.Email,
                    Phone = request.Phone,
                    RoleId = request.RoleId
                };

                _context.Admins.Add(admin);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetUser), new { id = admin.AID }, admin);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating user", error = ex.Message });
            }
        }

        // PUT: api/admin/users/5
        [HttpPut("users/{id}")]
        public async Task<IActionResult> UpdateUser(int id, UpdateUserRequest request)
        {
            try
            {
                var admin = await _context.Admins.FindAsync(id);
                if (admin == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                // Validate role exists
                var roleExists = await _context.Roles.AnyAsync(r => r.RoleID == request.RoleId);
                if (!roleExists)
                {
                    return BadRequest(new { message = "Invalid role ID" });
                }

                // Check if email already exists for another user
                var emailExists = await _context.Admins.AnyAsync(a => a.Email == request.Email && a.AID != id);
                if (emailExists)
                {
                    return BadRequest(new { message = "Email already exists" });
                }

                admin.Name = request.Name;
                admin.Email = request.Email;
                admin.Phone = request.Phone;
                admin.RoleId = request.RoleId;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AdminExists(id))
                {
                    return NotFound(new { message = "User not found" });
                }
                throw;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating user", error = ex.Message });
            }
        }

        // PUT: api/admin/users/5/role
        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, UpdateUserRoleRequest request)
        {
            try
            {
                var admin = await _context.Admins.FindAsync(id);
                if (admin == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                // Validate role exists
                var roleExists = await _context.Roles.AnyAsync(r => r.RoleID == request.RoleId);
                if (!roleExists)
                {
                    return BadRequest(new { message = "Invalid role ID" });
                }

                admin.RoleId = request.RoleId;
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating user role", error = ex.Message });
            }
        }

        // DELETE: api/admin/users/5
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            try
            {
                var admin = await _context.Admins.FindAsync(id);
                if (admin == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                _context.Admins.Remove(admin);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting user", error = ex.Message });
            }
        }

        // GET: api/admin/users/5/permissions
        [HttpGet("users/{id}/permissions")]
        public async Task<ActionResult<object>> GetUserPermissions(int id)
        {
            try
            {
                var admin = await _context.Admins.FirstOrDefaultAsync(a => a.AID == id);
                if (admin == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleID == admin.RoleId);
                var permissions = role?.Permissions ?? new List<string>();

                return Ok(new { permissions });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving user permissions", error = ex.Message });
            }
        }

        private bool AdminExists(int id)
        {
            return _context.Admins.Any(e => e.AID == id);
        }
    }

    // Request DTOs
    public class CreateUserRequest
    {
        [Required(ErrorMessage = "Name is required")]
        [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(255, ErrorMessage = "Email cannot exceed 255 characters")]
        public string Email { get; set; } = string.Empty;

        [Phone(ErrorMessage = "Invalid phone number format")]
        [StringLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
        public string? Phone { get; set; }

        [Required(ErrorMessage = "Role ID is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Role ID must be greater than 0")]
        public int RoleId { get; set; }
    }

    public class UpdateUserRequest
    {
        [Required(ErrorMessage = "Name is required")]
        [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(255, ErrorMessage = "Email cannot exceed 255 characters")]
        public string Email { get; set; } = string.Empty;

        [Phone(ErrorMessage = "Invalid phone number format")]
        [StringLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
        public string? Phone { get; set; }

        [Required(ErrorMessage = "Role ID is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Role ID must be greater than 0")]
        public int RoleId { get; set; }
    }

    public class UpdateUserRoleRequest
    {
        [Required(ErrorMessage = "Role ID is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Role ID must be greater than 0")]
        public int RoleId { get; set; }
    }
}