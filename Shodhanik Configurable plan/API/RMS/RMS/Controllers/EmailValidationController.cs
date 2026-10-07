using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mysqlx.Datatypes;
using NLUSONEPATAPI.Services;
using RMS.Data;
using RMS.Models;
using RMS.Models.NonDbModels;
using RMS.Services;

namespace RMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmailValidationController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly RMSDbContext _context;
        private readonly ILogger<EmailValidationController> _logger;
        private readonly OtpService _otpService;
        private readonly IEmailService _emailService;
        private readonly IEmailTemplateService _emailTemplateService;


        public EmailValidationController(
            IConfiguration configuration, 
            RMSDbContext context, 
            ILogger<EmailValidationController> logger,
            OtpService otpService,
            IEmailService emailService, IEmailTemplateService emailTemplateService)
        {
            _configuration = configuration;
            _context = context;
            _logger = logger;
            _otpService = otpService;
            _emailService = emailService;
            _emailTemplateService = emailTemplateService;
        }

        [HttpPost("send-otp")]
        public async Task<IActionResult> SendOtp([FromBody] MSendOtp request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                _logger.LogInformation("Sending Email & Phone OTP for {Email}, {Phone}",
                    request.Email, request.MobileNo);
                var oldVerifications = await _context.VerificationRequests
                .Where(v =>
                 v.Email == request.Email &&
                 v.MobileNo == request.MobileNo)
                .ToListAsync();

                if (oldVerifications.Any())
                {
                    _context.VerificationRequests.RemoveRange(oldVerifications);
                    await _context.SaveChangesAsync();
                }
                // Generate OTPs (same expiry)
                var (emailOtp, expiryTime) = _otpService.GenerateOtp();
                var (phoneOtp, _) = _otpService.GenerateOtp();

                var hashedEmailOtp = Sha256.ComputeSHA256Hash(emailOtp);
                var hashedPhoneOtp = Sha256.ComputeSHA256Hash(phoneOtp);

                // Create or update verification request
                var verification = await _context.VerificationRequests
                    .Where(v =>
                        v.Email == request.Email &&
                        v.MobileNo == request.MobileNo &&
                        v.Expires_At > DateTime.UtcNow)
                    .FirstOrDefaultAsync();

                if (verification == null)
                {
                    verification = new VerificationRequest
                    {
                        Email = request.Email,
                        MobileNo = request.MobileNo,
                        Otp_hashEmail = hashedEmailOtp,
                        Otp_hashPhone = hashedPhoneOtp,
                        Expires_At = expiryTime,
                        Attempt = 0
                    };

                    _context.VerificationRequests.Add(verification);
                }
                else
                {
                    // Resend case
                    verification.Otp_hashEmail = hashedEmailOtp;
                    verification.Otp_hashPhone = hashedPhoneOtp;
                    verification.Expires_At = expiryTime;
                    verification.Attempt = 0;
                    verification.IsVerified = false; ;
                }

                await _context.SaveChangesAsync();

                // Determine recipient name for the template
                string recipientName = !string.IsNullOrWhiteSpace(request.Name) ? request.Name.Trim() : null;

                if (string.IsNullOrWhiteSpace(recipientName))
                {
                    recipientName = await _context.Scholars
                        .Where(s => s.Email == request.Email || s.PhoneNumber == request.MobileNo)
                        .Select(s => s.Name)
                        .FirstOrDefaultAsync();

                    if (string.IsNullOrWhiteSpace(recipientName))
                    {
                        recipientName = await _context.SupervisorRegistrations
                            .Where(s => s.Email == request.Email || s.MobileNo == request.MobileNo)
                            .Select(s => s.FullName)
                            .FirstOrDefaultAsync();
                    }
                }

                if (string.IsNullOrWhiteSpace(recipientName))
                {
                    recipientName = "Applicant";
                }

                // Send Email OTP
                var tokens = new Dictionary<string, string>
                {
                    { "otp_code", emailOtp },
                    { "expiry_time", "2 minutes" },
                    { "name", recipientName },
                    { "Name", recipientName },
                    { "applicant_name", recipientName },
                    { "candidate_name", recipientName }
                };

                var (subject, body) = await _emailTemplateService.RenderAsync(1001, tokens);
                _emailService.SendEmail(
                    request.Email,
                    string.IsNullOrWhiteSpace(subject)
                                ? "Email Verification OTP"
                                : subject,
                    body
                );

                // Send Phone OTP (SMS)
                string smsMessage = $"{phoneOtp} is OTP for CCSU registration REGNOW";
                string templateId = "1207161207955867884";
                var smsService = new SmsService(
           "https://www.smsgateway.center/SMSApi/rest/send", // API URL
           "6042614833445292185",                            // API Key
           "diversified",
           "REGNOW", // Sender ID
           "23Dbspl74@"
       );
                smsService.SendSms(request.MobileNo, smsMessage, templateId);

                return Ok(new
                {
                    success = true,
                    message = "OTP sent to email and phone",
                    expiresAt = expiryTime
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending OTP");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        [HttpPost("validate")]
        public async Task<IActionResult> ValidateOtp([FromBody] MActivation request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var verification = await _context.VerificationRequests
                    .FirstOrDefaultAsync(v =>
                        v.Email == request.Email &&
                        v.MobileNo == request.Phone);

                if (verification == null)
                    return BadRequest("Verification request not found");

                // Check expiry
                if (verification.Expires_At < DateTime.UtcNow)
                    return BadRequest("OTP has expired");

                // Check attempt limit
                if (verification.Attempt >= 5)
                    return BadRequest("Too many failed attempts");

                // Hash entered OTPs
                var hashedEmailOtp = Sha256.ComputeSHA256Hash(request.EmailOtp);
                var hashedPhoneOtp = Sha256.ComputeSHA256Hash(request.PhoneOtp);

                // Validate OTPs
                if (verification.Otp_hashEmail != hashedEmailOtp ||
            verification.Otp_hashPhone != hashedPhoneOtp)
                {
                    verification.Attempt++;
                    await _context.SaveChangesAsync();
                    return BadRequest("Invalid OTP");
                }

                // OTPs valid → create user later
              verification.IsVerified = true;
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "OTP verified successfully for Email: {Email}, Phone: {Phone}",
                    request.Email, request.Phone);

                return Ok(new
                {
                    success = true,
                    message = "OTP verified successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OTP validation failed for email: {Email}", request.Email);
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

    }
}