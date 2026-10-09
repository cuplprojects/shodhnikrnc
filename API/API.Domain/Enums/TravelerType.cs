namespace API.Domain.Enums;

/// <summary>
/// Who is travelling. Legacy carried this as the <c>traveler_type</c> enum on
/// <c>travel_requests</c>, with the identity of a manpower or co-PI traveller
/// spread across nullable columns on the same row.
/// </summary>
public enum TravelerType
{
    /// <summary>The project's own PI. No further identity fields apply.</summary>
    Self,

    /// <summary>A sanctioned manpower position holder, identified by <c>ManpowerId</c>.</summary>
    Manpower,

    /// <summary>A co-PI, identified by free-text name and designation.</summary>
    CoPi,

    /// <summary>Other type of traveller, identified by free-text details.</summary>
    Other
}
