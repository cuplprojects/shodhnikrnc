using System.ComponentModel;

namespace RMS.Models.NonDbModels
{
    public class MLoginRequest
    {
        public string? ApplicationNumber { get; set; }

        public string? Username { get; set; }
        [PasswordPropertyText]
        public string Password { get; set; }

    }
}
