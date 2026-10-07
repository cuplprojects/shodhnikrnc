using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class VerificationRequest
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string Email { get; set; }
        public string MobileNo { get; set; }
        public string? Otp_hashPhone { get; set; }
        public string? Otp_hashEmail { get; set; }
        public DateTime? Expires_At { get; set; }
        public int? Attempt {  get; set; }
        public bool IsVerified { get; set; } = false;
    }
}
