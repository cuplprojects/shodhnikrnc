namespace API.Application.Recruitment;

/// <summary>
/// A PI may only delete their own saved advertisement body templates.
/// Follows <see cref="TemplateNotOwnedException"/>'s ownership-violation
/// convention of deriving from <see cref="InvalidOperationException"/>.
/// </summary>
public class AdvertisementBodyTemplateNotOwnedException(Guid templateId)
    : InvalidOperationException(
        $"Advertisement body template '{templateId}' is not owned by this user.");
