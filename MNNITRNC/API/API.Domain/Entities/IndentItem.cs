namespace API.Domain.Entities;

/// <summary>
/// One line item within a <see cref="Indent"/>. The PI can add multiple
/// items to a single indent using the "Add More Item" button on the form.
/// </summary>
public class IndentItem
{
    public Guid Id { get; set; }
    public Guid IndentId { get; set; }

    /// <summary>1-based display order assigned automatically at creation.</summary>
    public int SerialNumber { get; set; }

    public required string Name { get; set; }

    /// <summary>True = Consumable. False = Non-Consumable (Equipment).</summary>
    public bool IsConsumable { get; set; }

    public required string TechnicalSpecs { get; set; }
    public required string UnitOfMeasurement { get; set; }
    public int Quantity { get; set; }

    /// <summary>Estimated cost including all taxes, for this line item.</summary>
    public decimal EstimatedCostInclTax { get; set; }

    // ── Navigation ────────────────────────────────────────────────────────
    public Indent? Indent { get; set; }
}
