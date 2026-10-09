namespace API.Domain.Enums;

/// <summary>
/// Mode of a journey. Mirrors legacy's <c>travel_by</c> enum on
/// <c>travel_requests</c> (Dump20260806.sql).
/// </summary>
/// <remarks>
/// <see cref="RoadPrivateTaxi"/> describes how a leg was travelled and is
/// deliberately independent of whether taxi reimbursement was claimed --
/// that is <c>TravelRequest.TaxiReimbursementOptedIn</c>, which the BRD
/// requires to be chosen at submission. A traveller may take a taxi to the
/// station without claiming it.
/// </remarks>
public enum TravelMode
{
    Air,
    Rail,
    RoadPrivateTaxi,
    RoadPersonalCar,
    RoadCommonTransport,
    Other
}
