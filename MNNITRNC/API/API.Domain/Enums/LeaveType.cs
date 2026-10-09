namespace API.Domain.Enums;

/// <summary>
/// BRD A6's leave table. The entitlements (30 and 15 days) live in the leave
/// service rather than here, since they are policy that may change without the
/// types themselves changing.
/// </summary>
public enum LeaveType
{
    /// <summary>30 days per project year.</summary>
    Annual,

    /// <summary>15 days per project year, for conference participation.</summary>
    Special
}
