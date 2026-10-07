namespace RMS.Services
{
    public interface IEmailTemplateService
    {
        Task<(string Subject, string Body)> RenderAsync(
        int templateID,
        Dictionary<string, string> tokens);
    }
}
