using System.Text.Json.Serialization;

namespace API.Domain.Entities;

/// <summary>
/// Maps a travel request to one or more budget heads, with the specific amount 
/// drawn from each head based on the overflow rules. 
/// Allows travel requests to draw from multiple budget heads if the primary head lacks sufficient funds.
/// </summary>
public class TravelRequestBudgetHeadAllocation
{
    public Guid TravelRequestId { get; set; }
    public Guid BudgetHeadId { get; set; }

    /// <summary>
    /// The specific amount committed to be drawn from this budget head.
    /// Calculated at raise time (expected cost) and updated at bill processing (actual cost).
    /// </summary>
    public decimal CommittedAmount { get; set; }

    /// <summary>
    /// The order in which the budget heads were selected to be drained.
    /// 0 is the primary head.
    /// </summary>
    public int OrderIndex { get; set; }

    [JsonIgnore]
    public TravelRequest TravelRequest { get; set; } = null!;
}
