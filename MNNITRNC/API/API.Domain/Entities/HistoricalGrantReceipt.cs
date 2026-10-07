namespace API.Domain.Entities;

/// <summary>
/// A grant receipt entered directly by RnC office staff for a pre-existing
/// project's real-world receipt history, from before the project was
/// digitized -- not routed through <see cref="GrantReceipt"/>'s PI -> HOD
/// -> RnC Office -> Dean approval workflow, which makes no sense for money
/// received years ago. A sibling table, not a tagged row on
/// <see cref="GrantReceipt"/>: that entity's Status/WorkflowInstanceId/Type/
/// ParentReceiptId machinery has no meaning for a row that was never
/// raised through a workflow.
/// </summary>
public class HistoricalGrantReceipt
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public string? Remarks { get; set; }

    /// <summary>The RnC office staff member who recorded this -- not
    /// necessarily the project's owner, since this is the office acting on
    /// the PI's behalf to backfill history, not a self-service action.</summary>
    public Guid RecordedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
