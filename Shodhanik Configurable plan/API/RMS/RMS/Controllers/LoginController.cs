using DocumentFormat.OpenXml.Presentation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Tokens.Experimental;
using Mysqlx.Datatypes;
using Newtonsoft.Json;
using NuGet.Common;
using NuGet.Protocol.Plugins;
using RMS.Data;
using RMS.Models;
using RMS.Models.Enums;
using RMS.Models.NonDbModels;
using RMS.Services;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security;
using System.Security.Claims;
using System.Text;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoginController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly RMSDbContext _context;
        private readonly OtpService _otpService = new OtpService();
        private readonly ISecurityService _securityService;
        private readonly IEmailTemplateService _emailTemplateService;
        private readonly IEmailService _emailService;
        public LoginController(IConfiguration configuration, RMSDbContext context, OtpService otpService, ISecurityService securityService, IEmailTemplateService emailTemplateService, IEmailService emailService)
        {
            _configuration = configuration;
            _context = context;
            _otpService = otpService;
            _securityService = securityService;
            _emailTemplateService = emailTemplateService;
            _emailService = emailService;
        }
        private string GenerateToken(ScholarAuth user)
        {
            var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.SID.ToString()),
            new Claim("TempAutogen", user.isTempAutoGen.ToString()),// Assuming UserID is the unique identifier
            new Claim("PermAutogen", user.isPermAutoGen.ToString())// Assuming UserID is the unique identifier
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Carries the extra claims RNC (and any other external module) needs to
        /// federate this login -- a stable external id, display fields, which
        /// system issued the token, department, and role, none of which the
        /// token previously carried. See the Shodhanik-x-RNC integration plan,
        /// Phase 1.
        /// </summary>
        private string GenerateTokenSupervisor(SupervisorAuth user, SupervisorRegistration registration, string? departmentCode)
        {
            var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.SupId.ToString()), // Assuming UserID is the unique identifier
             new Claim("TempAutogen", user.isTempAutoGen.ToString()),// Add temp autogen flag
            new Claim("PermAutogen", user.isPermAutoGen.ToString()),// Add perm autogen flag
            new Claim(ClaimTypes.NameIdentifier, registration.SupId.ToString()),
            new Claim(ClaimTypes.Email, registration.Email ?? string.Empty),
            new Claim("full_name", registration.FullName ?? string.Empty),
            new Claim("source_system", "Shodhanik"),
            new Claim("department_code", departmentCode ?? string.Empty),
            new Claim(ClaimTypes.Role, "Supervisor"),
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateTokenAdminAuth(AdminAuth adminauth, Admin admin)
        {
            var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, admin.AID.ToString()), // Assuming UserID is the unique identifier
             new Claim("isAutoGen", adminauth.isAutoGen.ToString()),
             new Claim("RoleId", admin.RoleId.ToString())
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateTokenSuperAdmin(SuperAdmin superAdmin)
        {
            var securitykey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securitykey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, superAdmin.SAID.ToString()),
            new Claim("UserType", "SuperAdmin"),
            new Claim("Role", superAdmin.Role)
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(120),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

     
        [AllowAnonymous]
        [HttpPost("Scholar")]
        public IActionResult Login([FromBody] MLoginRequest model)
        {
            if (string.IsNullOrWhiteSpace(model.Password))
                return BadRequest("Password is required.");

            Scholar? scholar = null;
            ScholarAuth? auth = null;

            // -------------------------------
            // Resolve Scholar
            // -------------------------------
            if (!string.IsNullOrWhiteSpace(model.ApplicationNumber))
            {
                scholar = _context.Scholars
                    .FirstOrDefault(s => s.ApplicationNo == model.ApplicationNumber);
            }
            else if (!string.IsNullOrWhiteSpace(model.Username))
            {
                auth = _context.ScholarAuths
                    .FirstOrDefault(a => a.PermUserName == model.Username);

                if (auth != null)
                    scholar = _context.Scholars.FirstOrDefault(s => s.SID == auth.SID);
            }

            if (scholar == null)
                return NotFound("Invalid credentials.");

            auth ??= _context.ScholarAuths.FirstOrDefault(a => a.SID == scholar.SID);
            if (auth == null)
                return NotFound("Invalid credentials.");

            // -------------------------------
            // Block all rejected states
            // -------------------------------
            if (scholar.DecisionStatus.ToString().Contains("Rejected"))
                return Unauthorized("Your application has been rejected.");

            // -------------------------------
            // Permanent login only after Counselling approval
            // -------------------------------
            if (scholar.DecisionStatus >= DecisionStatus.CounsellingApprovedFinal)
            {
                if (string.IsNullOrEmpty(auth.PermPassword) ||
                    auth.PermPassword != model.Password)
                    return Unauthorized("Invalid password.");

                return Ok(BuildLoginResponse(auth));
            }

            // -------------------------------
            // Temp login for all other states
            // -------------------------------
            if (string.IsNullOrEmpty(auth.TempPassword) ||
                auth.TempPassword != model.Password)
                return Unauthorized("Invalid password.");

            return Ok(BuildLoginResponse(auth));
        }



        private object BuildLoginResponse(ScholarAuth auth)
        {
            var token = GenerateToken(auth);

            return new
            {
                token,
                SID = auth.SID,
                auth.isTempAutoGen,
                auth.isPermAutoGen
            };
        }



        [AllowAnonymous]
        [HttpPut("Forgotpassword/Scholar")]
        public async Task<IActionResult> ResetPassword([FromBody] ForgetPasswordEmailRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var users = await _context.Scholars
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (users == null)
                return NotFound("User not found");

            var userauth = await _context.ScholarAuths
                .FirstOrDefaultAsync(i => i.SID == users.SID);

            if (userauth == null)
                return NotFound("User Authentication Data Not Found");

            string password = Passwordgen.GeneratePassword();

            userauth.TempPassword = password;
            userauth.isTempAutoGen = true;
            await _context.SaveChangesAsync();

            var tokens = new Dictionary<string, string>
    {
        { "name", users.Name ?? "Applicant" },
        { "regno", users.Email },
        { "pwd", password },
        { "link", "<a href='https://xxxx/login'>Click here</a>" }
    };

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1009,
                tokens: tokens
            );

            _emailService.SendEmail(users.Email, subject, body);

            return Ok(new { message = "Password reset email sent successfully." });
        }


        [AllowAnonymous]
        [HttpPut("Forgotpassword/SelectedScholar")]
        public async Task<IActionResult> SelectedResetPassword([FromBody] ForgetPasswordEmailRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var users = await _context.Scholars.FirstOrDefaultAsync(u => u.Email == request.Email && u.DecisionStatus >= DecisionStatus.CounsellingApprovedFinal);

            if (users == null)
            {
                return NotFound("User not found");
            }

            var userauth = await _context.ScholarAuths.FirstOrDefaultAsync(i => i.SID == users.SID);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }

            string password = Passwordgen.GeneratePassword();


            userauth.PermPassword = password;

            userauth.isPermAutoGen = true;

            _context.SaveChanges();

            var tokens = new Dictionary<string, string>
    {
        { "name", users.Name ?? "Applicant" },
        { "regno", users.Email },
        { "pwd", password },
        { "link", "<a href='https://xxxx/login'>Click here</a>" }
    };

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1009,
                tokens: tokens
            );

            _emailService.SendEmail(users.Email, subject, body);
            return Ok(new { message = "Password reset email sent successfully." });
        }

        [HttpPut("Changepassword/Scholar/{id}")]
        public IActionResult ChangePassword(int id, MChangePassword cred)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = _context.Scholars.FirstOrDefault(u => u.SID == id);
            var userauth = _context.ScholarAuths.FirstOrDefault(i => i.SID == user.SID);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }
            if (userauth.TempPassword != cred.OldPassword)
            {
                return BadRequest("Existing Password Invalid");
            }


            userauth.TempPassword = cred.NewPassword;
            userauth.isTempAutoGen = false;

            _context.SaveChanges();
            //var userIdClaim = HttpContext.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name);
            //if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
            //{
            //    // Now you have the user ID
            //    _logger.LogEvent("Password-Changed", "Login", userId);
            //}

            return Ok();
        }

        [HttpPut("Changepassword/SelectedScholar/{id}")]
        public IActionResult SelectedChangePassword(int id, MChangePassword cred)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user =  _context.Scholars.FirstOrDefault(u => u.SID == id && u.DecisionStatus >= DecisionStatus.CounsellingApprovedFinal);
            var userauth = _context.ScholarAuths.FirstOrDefault(i => i.SID == user.SID);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }
            if (userauth.TempPassword != cred.OldPassword)
            {
                return BadRequest("Existing Password Invalid");
            }


            userauth.PermPassword = cred.NewPassword;
            userauth.isPermAutoGen = false;

            _context.SaveChanges();
            //var userIdClaim = HttpContext.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name);
            //if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
            //{
            //    // Now you have the user ID
            //    _logger.LogEvent("Password-Changed", "Login", userId);
            //}

            return Ok();
        }

        [AllowAnonymous]
        [HttpPost("Supervisor")]
        public IActionResult LoginSupervisor([FromBody] MLoginRequest model)
        {
            if (string.IsNullOrWhiteSpace(model.Password))
                return BadRequest("Password is required.");

            SupervisorRegistration? supervisorRegistration = null;
            SupervisorAuth? auth = null;

            // ---------------------------
            // Try to find the scholar by ApplicationNumber or Username
            // ---------------------------
            if (!string.IsNullOrWhiteSpace(model.ApplicationNumber))
            {
                supervisorRegistration = _context.SupervisorRegistrations.FirstOrDefault(s => s.ApplicationNumber == model.ApplicationNumber);
            }
            else if (!string.IsNullOrWhiteSpace(model.Username))
            {
                auth = _context.SupervisorAuths.FirstOrDefault(a => a.PermUserName == model.Username);
                if (auth != null)
                    supervisorRegistration = _context.SupervisorRegistrations.FirstOrDefault(s => s.SupId == auth.SupId);
            }

            if (supervisorRegistration == null)
                return NotFound("Invalid credentials.");

            // Fetch auth record if not already fetched
            auth ??= _context.SupervisorAuths.FirstOrDefault(a => a.SupId == supervisorRegistration.SupId);
            if (auth == null)
                return NotFound("Invalid credentials.");

            // Resolved once per login, not per token method: PrimarySuperviseSubject is the
            // only department-ish link SupervisorPersonal carries (see Models/SupervisorPersonal.cs),
            // an int? FK to Subject.SUBID -- Subject.Faculty is the closest existing equivalent to
            // RNC's Department.Code and is what the "department_code" claim carries.
            var supervisorPersonal = _context.SupervisorPersonal.FirstOrDefault(p => p.SupId == supervisorRegistration.SupId);
            string? departmentCode = null;
            if (supervisorPersonal?.PrimarySuperviseSubject is int subjectId)
            {
                departmentCode = _context.Subjects.FirstOrDefault(s => s.SUBID == subjectId)?.Faculty;
            }

            if (supervisorRegistration.IsAccepted == 1)
            {
                if (auth.PermPassword == model.Password)
                {
                    var token = GenerateTokenSupervisor(auth, supervisorRegistration, departmentCode);

                    return Ok(new {
                        token = token,
                        SupId = auth.SupId,
                        isTempAutoGen = auth.isTempAutoGen,
                        isPermAutoGen = auth.isPermAutoGen
                    });
                }
                else
                {
                    return Unauthorized("Invalid password");
                }
            }
            else
            {
                if (auth.TempPassword == model.Password)
                {
                    var token = GenerateTokenSupervisor(auth, supervisorRegistration, departmentCode);
                    return Ok(new {
                        token = token,
                        SupId = auth.SupId,
                        isTempAutoGen = auth.isTempAutoGen,
                        isPermAutoGen = auth.isPermAutoGen
                    });
                }
                else
                {
                    return Unauthorized("Invalid password");
                }
            }
        }

        [AllowAnonymous]
        [HttpPut("Forgotpassword/Supervisor")]
        public async Task<IActionResult> ResetSupervisorPassword([FromBody] ForgetPasswordEmailRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var users = await _context.SupervisorRegistrations.FirstOrDefaultAsync(u => u.Email == request.Email);

            if (users == null)
            {
                return NotFound("User not found");
            }

            var userauth = await _context.SupervisorAuths.FirstOrDefaultAsync(i => i.SupId == users.SupId);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }

            string password = Passwordgen.GeneratePassword();


            userauth.TempPassword = password;

            userauth.isTempAutoGen = true;

            _context.SaveChanges();

            var tokens = new Dictionary<string, string>
{
    { "name", users.FullName ?? "Applicant" },
    { "regno", users.Email },
    { "pwd", password },
    { "link", "<a href='https://xxxx/login'>Click here</a>" }
};

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1009,
                tokens: tokens
            );

            _emailService.SendEmail(users.Email, subject, body);
            return Ok(new { message = "Password reset email sent successfully." });
        }

        [AllowAnonymous]
        [HttpPut("Forgotpassword/SelectedSupervisor")]
        public async Task<IActionResult> SelectedSupervisorResetPassword([FromBody] ForgetPasswordEmailRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var users = await _context.SupervisorRegistrations.FirstOrDefaultAsync(u => u.Email == request.Email && u.IsAccepted == 1);

            if (users == null)
            {
                return NotFound("User not found");
            }

            var userauth = await _context.SupervisorAuths.FirstOrDefaultAsync(i => i.SupId == users.SupId);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }

            string password = Passwordgen.GeneratePassword();


            userauth.PermPassword = password;

            userauth.isPermAutoGen = true;

            _context.SaveChanges();

            var tokens = new Dictionary<string, string>
{
    { "name", users.FullName ?? "Applicant" },
    { "regno", users.Email },
    { "pwd", password },
    { "link", "<a href='https://xxxx/login'>Click here</a>" }
};

            var (subject, body) = await _emailTemplateService.RenderAsync(
                templateID: 1009,
                tokens: tokens
            );

            _emailService.SendEmail(users.Email, subject, body);
            return Ok(new { message = "Password reset email sent successfully." });

        }

        [HttpPut("Changepassword/Supervisor/{id}")]
        public IActionResult ChangeSupervisorPassword(int id, MChangePassword cred)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = _context.SupervisorRegistrations.FirstOrDefault(u => u.SupId == id);
            var userauth = _context.SupervisorAuths.FirstOrDefault(i => i.SupId == user.SupId);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }
            if (userauth.TempPassword != cred.OldPassword)
            {
                return BadRequest("Existing Password Invalid");
            }


            userauth.TempPassword = cred.NewPassword;
            userauth.isTempAutoGen = false;

            _context.SaveChanges();
            return Ok();
        }

        [HttpPut("Changepassword/SelectedSupervisor/{id}")]
        public IActionResult SelectedSupervisorChangePassword(int id, MChangePassword cred)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = _context.SupervisorRegistrations.FirstOrDefault(u => u.SupId == id && u.IsAccepted == 1);
            var userauth = _context.SupervisorAuths.FirstOrDefault(i => i.SupId == user.SupId);

            if (userauth == null)
            {
                return NotFound("User Authentication Data Not Found");
            }
            if (userauth.PermPassword != cred.OldPassword)
            {
                return BadRequest("Existing Password Invalid");
            }


            userauth.PermPassword = cred.NewPassword;
            userauth.isPermAutoGen = false;

            _context.SaveChanges();

            return Ok();
        }

        [HttpPost("Admin")]
        public IActionResult LoginAdmin([FromBody] AdminLoginRequest model)
        {
            // First check SuperAdmin table
            var superAdmin = _context.SuperAdmins.FirstOrDefault(sa => sa.Email == model.Username && sa.IsActive);
            if (superAdmin != null)
            {
                if (superAdmin.Password == model.Password)
                {
                    var superAdminToken = GenerateTokenSuperAdmin(superAdmin);
                    
                    return Ok(new {
                        success = true,
                        message = "Login successful",
                        token = superAdminToken,
                        user = new {
                            id = superAdmin.SAID,
                            username = superAdmin.Email,
                            email = superAdmin.Email,
                            name = superAdmin.Name,
                            phone = superAdmin.PhoneNumber,
                            roleId = (int?)null,
                            role = new {
                                RoleID = (int?)null,
                                RoleName = superAdmin.Role,
                                Description = (string?)null,
                                Permissions = superAdmin.Permissions
                            },
                            tokenExp = ((DateTimeOffset)DateTime.Now.AddMinutes(120)).ToUnixTimeSeconds(),
                            userType = "SuperAdmin",
                            isSuperAdmin = true
                        },
                        permissions = superAdmin.Permissions
                    });
                }
                else
                {
                    return Unauthorized("Invalid Username or Password");
                }
            }

            // If not found in SuperAdmin, check Admin table
            var adminauth = _context.AdminAuths.FirstOrDefault(u => u.Username == model.Username);
            if(adminauth == null)
            {
                return NotFound("Invalid Username or Password");
            }
            var admin = _context.Admins.Find(adminauth.AID);
            if(admin == null)
            {
                return NotFound("Admin not Found");
            }
            if(adminauth.Password == model.Password)
            {
                var Token = GenerateTokenAdminAuth(adminauth, admin);
                
                // Get role by RoleId
                var role = _context.Roles.FirstOrDefault(r => r.RoleID == admin.RoleId);
                
                // Convert role to permissions
                var permissions = role?.Permissions ?? new List<string>();
                
                return Ok(new {
                    success = true,
                    message = "Login successful",
                    token = Token,
                    user = new {
                        id = admin.AID,
                        username = adminauth.Username,
                        email = admin.Email,
                        name = admin.Name,
                        phone = admin.Phone,
                        roleId = admin.RoleId,
                        role = role,
                        roleName = role?.RoleName,
                        tokenExp = ((DateTimeOffset)DateTime.Now.AddMinutes(120)).ToUnixTimeSeconds(),
                        userType = "Admin",
                        isSuperAdmin = false
                    },
                    permissions = permissions
                });
            }
            else
            {
                return Unauthorized("Invalid Username or Password");
            }
        }


        [HttpPost("Scholar/FetchByPhone/{phonenumber}")]
        public async Task<ActionResult<ExistsUser>> ScholarAlreadyExists(string phonenumber)
        {
            var exists = _context.Scholars.Any(u => u.PhoneNumber == phonenumber);
            ExistsUser eu = new ExistsUser()
            {
                UserExists = exists,
            };
            return Ok(eu);
        }

        [HttpPost("Scholar/FetchByEmail/{email}")]
        public async Task<ActionResult<ExistsUser>> ScholarAlreadyExistsbyemail(string email)
        {
            var exists = _context.Scholars.Any(u => u.Email == email);
            ExistsUser eu = new ExistsUser()
            {
                UserExists = exists,
            };
            return Ok(eu);
        }

        [HttpPost("Supervisor/FetchByPhone/{phonenumber}")]
        public async Task<ActionResult<ExistsUser>> SuperAlreadyExists(string phonenumber)
        {
            var exists = _context.SupervisorRegistrations.Any(u => u.MobileNo == phonenumber);
            ExistsUser eu = new ExistsUser()
            {
                UserExists = exists,
            };
            return Ok(eu);
        }

        [HttpPost("Supervisor/FetchByEmail/{email}")]
        public async Task<ActionResult<ExistsUser>> SuperAlreadyExistsbyemail(string email)
        {
            var exists = _context.SupervisorRegistrations.Any(u => u.Email == email);
            ExistsUser eu = new ExistsUser()
            {
                UserExists = exists,
            };
            return Ok(eu);
        }


    }

    public class PasswordDTO
    {
        public int UserId { get; set; }
        public string Password { get; set; }
    }

    public class OTPEmailRequest
    {
        [EmailAddress]
        public string Email { get; set; }
    }

    public class OTPPhoneRequest
    {
        [Phone]
        public string Phone { get; set; }
    }

    public class EmailOtps
    {
        public string EmailOTP { get; set; }
        public DateTime Expires { get; set; }
    }

    public class PhoneOtps
    {
        public string PhoneOTP { get; set; }
        public DateTime Expires { get; set; }
    }
    public class ForgetPasswordEmailRequest
    {
        public string Email { get; set; }
    }
    public class ForgetPasswordPhoneRequest
    {
        public string Phone { get; set; }
    }

    public class ExistsUser
    {
        public bool UserExists { get; set; }
    }

    public class MChangePassword
    {
        [PasswordPropertyText]
        public string OldPassword { get; set; }

        [PasswordPropertyText]
        public string NewPassword { get; set; }
    }

    public class AdminLoginRequest
    {
        public string Username { get; set; }

        public string Password { get; set; }

    }
}
