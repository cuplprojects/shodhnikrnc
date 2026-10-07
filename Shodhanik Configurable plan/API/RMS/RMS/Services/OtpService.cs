using System.Security.Cryptography;

namespace RMS.Services
{
    public class OtpService
    {
        private readonly int _otpLength;
        private readonly TimeSpan _expiryDuration;

        public OtpService(int otpLength = 6, TimeSpan? expiryDuration = null)
        {
            _otpLength = otpLength;
            _expiryDuration = expiryDuration ?? TimeSpan.FromMinutes(2);
        }

        public (string otp, DateTime expiryTime) GenerateOtp()
        {
            var otp = GenerateRandomOtp();
            var expiryTime = DateTime.UtcNow.Add(_expiryDuration);
            return (otp, expiryTime);
        }

        private string GenerateRandomOtp()
        {
            using var rng = new RNGCryptoServiceProvider();
            var data = new byte[4];
            rng.GetBytes(data);
            var generatedValue = BitConverter.ToUInt32(data, 0) % (uint)Math.Pow(10, _otpLength);
            return generatedValue.ToString($"D{_otpLength}");
        }
    }
}
