namespace RMS.Services
{
    public class FileStorageService : IFileStorageService
    {
        private readonly IConfiguration _configuration;

        public FileStorageService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> SaveAsync(
            IFormFile file,
            string subFolder,
            string filePrefix)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Invalid file");

            var rootFolder = _configuration["FilePath"]
                ?? throw new InvalidOperationException("FileSettings:BasePath not configured");

            var basePath = Path.Combine(
                Directory.GetCurrentDirectory(),
                rootFolder,
                "uploads",
                subFolder
            );

            if (!Directory.Exists(basePath))
                Directory.CreateDirectory(basePath);

            var fileName = $"{filePrefix}_{Path.GetFileName(file.FileName)}";
            var fullPath = Path.Combine(basePath, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return relative path for DB
            return Path.Combine("uploads", subFolder, fileName)
                        .Replace("\\", "/");
        }

        public async Task OverwriteAsync(IFormFile file, string relativePath)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Invalid file");

            var rootFolder = _configuration["FilePath"]
                ?? throw new InvalidOperationException("FilePath not configured");

            var fullPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                rootFolder,
                relativePath.Replace("/", Path.DirectorySeparatorChar.ToString())
            );

            var directory = Path.GetDirectoryName(fullPath);
            if (!Directory.Exists(directory))
                Directory.CreateDirectory(directory!);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
        }

        public async Task<byte[]> GetFileAsync(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
                throw new ArgumentException("Invalid file path");

            var rootFolder = _configuration["FilePath"]
                ?? throw new InvalidOperationException("FilePath not configured");

            var fullPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                rootFolder,
                relativePath.Replace("/", Path.DirectorySeparatorChar.ToString())
            );

            if (!File.Exists(fullPath))
                throw new FileNotFoundException($"File not found: {fullPath}");

            return await File.ReadAllBytesAsync(fullPath);
        }

        public async Task DeleteAsync(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
                return;

            var rootFolder = _configuration["FilePath"]
                ?? throw new InvalidOperationException("FilePath not configured");

            var fullPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                rootFolder,
                relativePath.Replace("/", Path.DirectorySeparatorChar.ToString())
            );

            if (File.Exists(fullPath))
            {
                await Task.Run(() => File.Delete(fullPath));
            }
        }
    }
}
