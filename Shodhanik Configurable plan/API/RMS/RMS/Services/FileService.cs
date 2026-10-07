using Microsoft.Extensions.Configuration;

namespace RMS.Services
{
    public interface IFileService
    {
        string GetUploadPath(string folderName);
    }

    public class FileService : IFileService
    {
        private readonly IConfiguration _configuration;

        public FileService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GetUploadPath(string folderName)
        {
            string basePath = _configuration["FilePath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            return Path.Combine(basePath, folderName);
        }
    }
}