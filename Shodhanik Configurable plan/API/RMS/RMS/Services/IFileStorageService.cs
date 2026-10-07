namespace RMS.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveAsync(
            IFormFile file,
            string subFolder,
            string filePrefix);

        Task OverwriteAsync(
        IFormFile file,
        string relativePath);

        Task<byte[]> GetFileAsync(string relativePath);

        Task DeleteAsync(string relativePath);
    }
}
