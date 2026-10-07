namespace API.Application.Recruitment;

/// <summary>
/// A PI may only clone from the system default or their own templates, and may
/// only edit, delete, or resolve their own. Follows
/// <see cref="PrefillNotOwnedException"/>'s ownership-violation convention of
/// deriving from <see cref="InvalidOperationException"/>.
/// </summary>
public class TemplateNotOwnedException(Guid templateId)
    : InvalidOperationException(
        $"Advertisement template '{templateId}' is not owned by this user.");
