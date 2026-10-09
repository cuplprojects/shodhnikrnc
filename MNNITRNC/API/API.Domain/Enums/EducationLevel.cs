namespace API.Domain.Enums;

/// <summary>
/// One row of the application form's academic-record table. Persisted as an
/// int, so members are appended, never reordered.
/// </summary>
public enum EducationLevel
{
    Tenth,
    Twelfth,
    Diploma,
    Undergraduate,
    Postgraduate,
    Doctorate,
    PostDoctoral,
    Other
}
