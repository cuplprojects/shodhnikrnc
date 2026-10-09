using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A travel reimbursement request drawn against a project's RecurringTravel
/// budget head. One traveller per request, matching legacy's
/// <c>travel_requests</c> table.
/// </summary>
public class TravelRequest
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public Guid WorkflowInstanceId { get; set; }

    public TravelerType TravelerType { get; set; }
    public string? TravelerTypes { get; set; }
    public string? OtherTravelerDetails { get; set; }

    /// <summary>Set only when <see cref="TravelerType"/> is Manpower.</summary>
    public Guid? ManpowerId { get; set; }

    /// <summary>Both set only when <see cref="TravelerType"/> is CoPi.</summary>
    public string? CoPiName { get; set; }
    public string? CoPiDesignation { get; set; }

    public required string Place { get; set; }
    public required string Purpose { get; set; }
    public DateOnly OnwardDate { get; set; }
    public DateOnly ReturnDate { get; set; }
    public TravelMode PrimaryMode { get; set; }
    public string? PrimaryModes { get; set; }
    public string? OtherPrimaryModeDetails { get; set; }

    /// <summary>
    /// The BRD's hard rule: taxi reimbursement is available only if selected at
    /// submission. Written once at raise and never updated -- bill processing
    /// rejects a taxi cost when this is false.
    /// </summary>
    public bool TaxiReimbursementOptedIn { get; set; }
    public string? TaxiReason { get; set; }

    public string? AccommodationDetails { get; set; }
    public decimal AccommodationCost { get; set; }
    public string? OtherExpensesDetails { get; set; }
    public decimal OtherExpensesCost { get; set; }

    /// <summary>
    /// Both derived server-side from the journey legs and the two cost fields,
    /// then persisted. Never accepted from the client.
    /// </summary>
    public decimal JourneyTotalCost { get; set; }
    public decimal ExpectedCost { get; set; }

    public string? OriginalBillReference { get; set; }
    public decimal? TaxiCost { get; set; }
    public decimal? ActualCost { get; set; }
    public string? BillNo { get; set; }
    public DateOnly? GenerationDate { get; set; }
    public string? Kilometer { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? BillFileUrl { get; set; }
    public string? BillProcessStatus { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public List<TravelJourneyLeg> Journeys { get; set; } = [];
    public List<TravelRequestBudgetHeadAllocation> Allocations { get; set; } = [];
}
