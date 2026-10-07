using System.Security.Cryptography;

namespace RMS.Services
{
    public class SecurityService : ISecurityService
    {
        private readonly IConfiguration _configuration;

        public SecurityService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string Decrypt(string cipherText)
        {
            string[] parts = cipherText.Split(":");
            string keyHex = _configuration["AES_Key"];
            byte[] keyBytes = ConvertHexToBytes(keyHex);

            byte[] cipherBytes = Convert.FromBase64String(parts[1]);
            byte[] initVector = Convert.FromBase64String(parts[0]);

            return PerformDecryption(keyBytes, cipherBytes, initVector);
        }

        private string PerformDecryption(byte[] keyBytes, byte[] cipherBytes, byte[] initVector)
        {
            using (Aes algorithm = Aes.Create())
            {
                algorithm.Key = keyBytes;
                algorithm.IV = initVector;
                algorithm.Mode = CipherMode.CBC;
                algorithm.Padding = PaddingMode.PKCS7;

                ICryptoTransform transform = algorithm.CreateDecryptor(algorithm.Key, algorithm.IV);

                using (MemoryStream stream = new MemoryStream(cipherBytes))
                {
                    using (CryptoStream cryptoStream = new CryptoStream(stream, transform, CryptoStreamMode.Read))
                    {
                        using (StreamReader reader = new StreamReader(cryptoStream))
                        {
                            return reader.ReadToEnd();
                        }
                    }
                }
            }
        }

        public string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText))
            {
                throw new ArgumentException("Text to encrypt is required.", nameof(plainText));
            }

            string keyHex = _configuration["AES_Key"];
            byte[] keyBytes = ConvertHexToBytes(keyHex);

            return PerformEncryption(plainText, keyBytes);
        }

        private string PerformEncryption(string plainText, byte[] keyBytes)
        {
            byte[] initVector;
            byte[] cipherBytes;

            using (Aes algorithm = Aes.Create())
            {
                algorithm.Key = keyBytes;
                algorithm.GenerateIV();
                initVector = algorithm.IV;

                using (var encryptor = algorithm.CreateEncryptor(algorithm.Key, algorithm.IV))
                using (var stream = new System.IO.MemoryStream())
                {
                    using (var cryptoStream = new CryptoStream(stream, encryptor, CryptoStreamMode.Write))
                    using (var writer = new System.IO.StreamWriter(cryptoStream))
                    {
                        writer.Write(plainText);
                    }
                    cipherBytes = stream.ToArray();
                }
            }

            string initVectorBase64 = Convert.ToBase64String(initVector);
            string cipherBase64 = Convert.ToBase64String(cipherBytes);

            return $"{initVectorBase64}:{cipherBase64}";
        }

        private byte[] ConvertHexToBytes(string hexString)
        {
            return Enumerable.Range(0, hexString.Length / 2)
                            .Select(x => Convert.ToByte(hexString.Substring(x * 2, 2), 16))
                            .ToArray();
        }
    }
}
