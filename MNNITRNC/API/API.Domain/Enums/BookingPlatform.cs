namespace API.Domain.Enums;

/// <summary>
/// The platform a journey leg was booked through. The BRD names IRCTC, Ashoka
/// Travel and Balmer Lawrie as the eligible platforms and requires the
/// corresponding disclaimer to be shown at claim time.
/// </summary>
/// <remarks>
/// Legacy recorded no platform at all. Storing it per leg makes the eligibility
/// rule auditable after the fact rather than a disclaimer nobody can check.
/// <see cref="Other"/> exists because the BRD lists the eligible platforms
/// without declaring bookings made elsewhere void -- rejecting them outright
/// would invent a rule the source document does not state.
/// </remarks>
public enum BookingPlatform
{
    IRCTC,
    AshokaTravel,
    BalmerLawrie,
    Other
}
