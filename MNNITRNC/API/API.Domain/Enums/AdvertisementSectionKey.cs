namespace API.Domain.Enums;

/// <summary>
/// Named sections of an advertisement template, matching the reference
/// institutional application form's row groupings. Structural rows that
/// are always entity-bound (project file no., project title, position
/// count) are not sections here -- they are never part of the editable
/// template, only auto-filled at render time.
/// </summary>
public enum AdvertisementSectionKey
{
    EssentialQualifications,
    Salary,
    OtherBenefits,
    AgeLimit,
    TenureOfAppointment,
    DesirableQualifications,
    HowToApply,
    Notes,
}
