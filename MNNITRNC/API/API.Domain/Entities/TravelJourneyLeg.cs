using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One leg of a journey. Legacy stored these in <c>travel_journey_details</c>,
/// cascade-deleted with their parent request.
/// </summary>
public class TravelJourneyLeg
{
    public Guid Id { get; set; }
    public Guid TravelRequestId { get; set; }

    public required string JourneyFrom { get; set; }
    public required string JourneyTo { get; set; }
    public DateOnly JourneyDate { get; set; }
    public DateOnly? ArrivalDate { get; set; }
    public DateOnly? ActualArrivalDate { get; set; }
    public string? ActualArrivalTime { get; set; }
    public string? ActualArrivalKm { get; set; }
    public TravelMode Mode { get; set; }
    public BookingPlatform BookingPlatform { get; set; }
    public decimal Amount { get; set; }
    public string? Remarks { get; set; }

    /// <summary>Preserves submission order; legacy relied on insertion order.</summary>
    public int SequenceOrder { get; set; }

    public TravelRequest? TravelRequest { get; set; }
}
