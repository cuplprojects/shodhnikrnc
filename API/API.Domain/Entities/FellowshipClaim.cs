namespace API.Domain.Entities;

/// <summary>
/// A fellow's monthly fellowship claim. Equivalent to legacy's
/// <c>stipend_recommendations</c> row.
/// </summary>
public class FellowshipClaim
{
    public Guid Id { get; set; }

    /// <summary>The fellow's appointment (Phase 5's ManpowerSelection).</summary>
    public Guid FellowAppointmentId { get; set; }

    public Guid WorkflowInstanceId { get; set; }

    /// <summary>
    /// The calendar month claimed. Unique per appointment -- a fellow cannot
    /// claim the same month twice.
    /// </summary>
    public int ClaimYear { get; set; }
    public int ClaimMonth { get; set; }
    public string ClaimPeriod { get; set; } = "21st-20th";
    public string ClaimType { get; set; } = "Claim for Month";


    /// <summary>Copied from the appointment's RecommendedStipend at raise time.</summary>
    public decimal FellowshipAmount { get; set; }

    /// <summary>
    /// 20% of <see cref="FellowshipAmount"/> by default, or
    /// <see cref="HraOverrideAmount"/> when a Dean or Director has set one.
    /// </summary>
    public decimal HraAmount { get; set; }

    /// <summary>When true, an HRA slip must have been uploaded.</summary>
    public bool HraClaimed { get; set; }

    public decimal TotalAmount { get; set; }

    // --- HRA override (spec D1) ---
    // Set only by a Dean or Director. The reason and actor are recorded because
    // an unexplained change to someone's pay is not auditable.

    public decimal? HraOverrideAmount { get; set; }
    public string? HraOverrideReason { get; set; }
    public Guid? HraOverriddenByUserId { get; set; }
    public DateTimeOffset? HraOverriddenAt { get; set; }

    /// <summary>
    /// Reported on the claim and printed on the stipend form, exactly as legacy
    /// did. Neither figure reduces any amount -- the deduction, if any, is the
    /// approver's decision, reflected in <see cref="RecommendedAmount"/>.
    /// </summary>
    public int LeaveDaysTakenThisMonth { get; set; }
    public int UnauthorisedAbsenceDays { get; set; }

    public string? Remarks { get; set; }

    /// <summary>The PI's figure, entered rather than computed.</summary>
    public decimal? RecommendedAmount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// The voucher line item that paid this claim, once one exists. Null
    /// means not yet vouchered -- the gate that stops a claim being selected
    /// into a second voucher.
    /// </summary>
    public Guid? PaymentVoucherItemId { get; set; }
}
