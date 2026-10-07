using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RMS.Services
{
    public class EncryptionService : IEncryptionService
    {
        private readonly IConfiguration _configuration;
        private readonly byte[] _key;
        private readonly JsonSerializerOptions _jsonOptions;

        public EncryptionService(IConfiguration configuration)
        {
            _configuration = configuration;

            string keyHex = _configuration["AES_Key"];
            _key = ConvertHexStringToByteArray(keyHex);

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            };
        }

        public string EncryptData(object data)
        {
            try
            {
                var jsonString = JsonSerializer.Serialize(data, _jsonOptions);
                return PerformEncryption(jsonString);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Encryption error: {ex.Message}");
                return null;
            }
        }

        public T DecryptData<T>(string encryptedData)
        {
            try
            {
                if (string.IsNullOrEmpty(encryptedData))
                    return default(T);

                var decryptedString = PerformDecryption(encryptedData);
                if (string.IsNullOrEmpty(decryptedString))
                    return default(T);

                return JsonSerializer.Deserialize<T>(decryptedString, _jsonOptions);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Decryption error: {ex.Message}");
                return default(T);
            }
        }

        public string DecryptString(string encryptedData)
        {
            try
            {
                if (string.IsNullOrEmpty(encryptedData))
                    return null;

                return PerformDecryption(encryptedData);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"String decryption error: {ex.Message}");
                return null;
            }
        }

        private string PerformDecryption(string encryptedData)
        {
            if (encryptedData.Contains(":"))
            {
                return HandleSeparatedFormat(encryptedData);
            }
            else
            {
                return HandleCombinedFormat(encryptedData);
            }
        }

        private string HandleSeparatedFormat(string encryptedData)
        {
            string[] parts = encryptedData.Split(":");
            byte[] cipherBytes = Convert.FromBase64String(parts[1]);
            byte[] initVector = Convert.FromBase64String(parts[0]);

            return ExecuteDecryption(cipherBytes, initVector);
        }

        private string HandleCombinedFormat(string encryptedData)
        {
            byte[] fullData = Convert.FromBase64String(encryptedData);
            byte[] initVector = new byte[16];
            byte[] cipherBytes = new byte[fullData.Length - 16];

            Buffer.BlockCopy(fullData, 0, initVector, 0, 16);
            Buffer.BlockCopy(fullData, 16, cipherBytes, 0, cipherBytes.Length);

            return ExecuteDecryption(cipherBytes, initVector);
        }

        private string ExecuteDecryption(byte[] cipherBytes, byte[] initVector)
        {
            using (var algorithm = Aes.Create())
            {
                algorithm.Key = _key;
                algorithm.IV = initVector;
                algorithm.Mode = CipherMode.CBC;
                algorithm.Padding = PaddingMode.PKCS7;

                using (var transform = algorithm.CreateDecryptor())
                using (var stream = new MemoryStream(cipherBytes))
                using (var cryptoStream = new CryptoStream(stream, transform, CryptoStreamMode.Read))
                using (var reader = new StreamReader(cryptoStream))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        private string PerformEncryption(string plainText)
        {
            try
            {
                using (var algorithm = Aes.Create())
                {
                    algorithm.Key = _key;
                    algorithm.Mode = CipherMode.CBC;
                    algorithm.Padding = PaddingMode.PKCS7;
                    algorithm.GenerateIV();

                    return ExecuteEncryption(plainText, algorithm);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"String encryption error: {ex.Message}");
                return null;
            }
        }

        private string ExecuteEncryption(string plainText, Aes algorithm)
        {
            using (var encryptor = algorithm.CreateEncryptor())
            using (var stream = new MemoryStream())
            {
                stream.Write(algorithm.IV, 0, algorithm.IV.Length);

                using (var cryptoStream = new CryptoStream(stream, encryptor, CryptoStreamMode.Write))
                using (var writer = new StreamWriter(cryptoStream))
                {
                    writer.Write(plainText);
                }

                return Convert.ToBase64String(stream.ToArray());
            }
        }

        public bool IsEncrypted(string data)
        {
            try
            {
                if (string.IsNullOrEmpty(data))
                    return false;

                var bytes = Convert.FromBase64String(data);
                return bytes.Length > 16;
            }
            catch
            {
                return false;
            }
        }

        private byte[] ConvertHexStringToByteArray(string hexString)
        {
            return Enumerable.Range(0, hexString.Length / 2)
                            .Select(x => Convert.ToByte(hexString.Substring(x * 2, 2), 16))
                            .ToArray();
        }
    }
}
