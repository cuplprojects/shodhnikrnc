namespace API.Application.Recruitment;

/// <summary>
/// Mirrors <see cref="RecruitmentRequestNotFoundException"/>: a missing entity
/// derives from plain <see cref="Exception"/>, not
/// <see cref="InvalidOperationException"/>, so the middleware can map
/// not-found separately from a rule violation.
/// </summary>
public class AdvertisementTemplateNotFoundException(Guid templateId)
    : Exception($"Advertisement template '{templateId}' was not found.");
