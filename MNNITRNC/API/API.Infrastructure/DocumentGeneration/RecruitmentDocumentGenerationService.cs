using API.Application.Documents;
using API.Application.Recruitment;
using API.Infrastructure.DocumentGeneration.Templates;
using Microsoft.AspNetCore.Http;

namespace API.Infrastructure.DocumentGeneration;

public class RecruitmentDocumentGenerationService(IHtmlPdfRenderer renderer, IHttpContextAccessor httpContextAccessor)
    : IRecruitmentDocumentGenerationService
{
    public Task<byte[]> GenerateAdvertisementAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.Advertisement(model, BaseUrl()), ct);

    public Task<string> RenderAdvertisementHtmlAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Task.FromResult(IndentHtmlShell.Wrap(RecruitmentTemplates.Advertisement(model, BaseUrl())));

    /// <summary>
    /// This service is always constructed within a request scope (triggered
    /// from a controller action via RecruitmentService), so HttpContext is
    /// normally present -- but falls back to null (leaving any uploaded
    /// image's src as the stored relative path) rather than throwing, in
    /// case a future caller ever generates a document outside an HTTP
    /// request.
    /// </summary>
    private string? BaseUrl()
    {
        var request = httpContextAccessor.HttpContext?.Request;
        return request is null ? null : $"{request.Scheme}://{request.Host}";
    }

    public Task<byte[]> GenerateScreeningProformaAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.ScreeningProforma(model), ct);

    public Task<byte[]> GenerateSelectionProformaAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.SelectionProforma(model), ct);

    public Task<byte[]> GenerateMinutesOfSelectionAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.MinutesOfSelection(model), ct);

    public Task<byte[]> GenerateMeritListAsync(
        RecruitmentDocumentModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.MeritList(model), ct);

    public Task<byte[]> GenerateOfferLetterAsync(
        OfferLetterModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.OfferLetter(model), ct);

    public Task<byte[]> GenerateJoiningLetterAsync(
        OfferLetterModel model, CancellationToken ct = default) =>
        Render(RecruitmentTemplates.JoiningLetter(model), ct);

    private Task<byte[]> Render(string body, CancellationToken ct) =>
        renderer.RenderAsync(IndentHtmlShell.Wrap(body), ct);
}
