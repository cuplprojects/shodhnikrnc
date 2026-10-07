using System.ComponentModel.DataAnnotations;

namespace RMS.Models.NonDbModels
{
    public class MActivation
    {
        [Required]
        public string Email { get; set; }

        [Required]
        public string Phone { get; set; }

        [Required]
        public string EmailOtp { get; set; }

        [Required]
        public string PhoneOtp { get; set; }
    }


    public class MSendOtp
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string MobileNo { get; set; } = string.Empty; // "Scholar" or "Supervisor"

        public string? Name { get; set; }
    }
}