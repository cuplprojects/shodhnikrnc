namespace API.Application.Recruitment;

/// <summary>
/// Mirrors <see cref="AdvertisementTemplateNotFoundException"/>: a missing
/// entity derives from plain <see cref="Exception"/>, not
/// <see cref="InvalidOperationException"/>, so the middleware can map
/// not-found separately from a rule violation.
/// </summary>
public class AdvertisementBodyTemplateNotFoundException(Guid templateId)
    : Exception($"Advertisement body template '{templateId}' was not found.");
