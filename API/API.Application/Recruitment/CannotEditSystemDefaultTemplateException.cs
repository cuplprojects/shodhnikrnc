namespace API.Application.Recruitment;

/// <summary>
/// The single seeded system-default template is shared by every PI, so it is
/// never edited or deleted in place -- it is cloned first. A rule violation, so
/// it derives from <see cref="InvalidOperationException"/> like the other
/// recruitment rule exceptions.
/// </summary>
public class CannotEditSystemDefaultTemplateException(Guid templateId)
    : InvalidOperationException(
        $"The system default template '{templateId}' cannot be edited directly. " +
        "Clone it first.");
