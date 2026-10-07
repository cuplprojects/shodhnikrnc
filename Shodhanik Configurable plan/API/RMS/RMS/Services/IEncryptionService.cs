using System.Text.Json;

namespace RMS.Services
{
    public interface IEncryptionService
    {
        string EncryptData(object data);
        T DecryptData<T>(string encryptedData);
        string DecryptString(string encryptedData);
        bool IsEncrypted(string data);
    }
}