namespace API.Application.Fellowship;

/// <summary>
/// Flat view of everything the stipend form prints, assembled by
/// <see cref="FellowshipDocumentModelFactory"/> so the template never touches
/// entities or the database.
/// </summary>
public record StipendFormModel(
    // Fellow
    string FellowName,
    string? BankAccountNo,
    string? IfscCode,
    string? Mobile,
    string? Email,
    DateOnly JoinedOn,
    string Designation,

    // Project
    string ProjectTitle,
    string SanctionNo,
    decimal TotalSanctioned,
    DateOnly ProjectStartDate,
    DateOnly ProjectEndDate,
    string PiName,
    string PiDepartment,
    decimal TotalFundReceived,
    decimal ManpowerHeadFund,

    // The claim
    DateOnly PeriodFrom,
    DateOnly PeriodTo,
    decimal FellowshipAmount,
    decimal HraAmount,
    decimal TotalAmount,

    /// <summary>
    /// True when a Dean or Director set the HRA. The form says so, and gives the
    /// reason, so a figure differing from the computed 20% is explained on the
    /// printed page rather than only in the database.
    /// </summary>
    bool HraIsOverridden,
    string? HraOverrideReason,

    // Reported, never used to reduce the amount (spec D2).
    int YearlyLeaveEntitlement,
    int TotalLeavesTaken,
    int LeaveTakenThisMonth,
    int UnauthorisedAbsenceDays,

    /// <summary>
    /// The PI's figure. Null until they enter one -- the form then prints a
    /// ruled blank, as legacy did, rather than pre-filling the computed total
    /// and implying a decision nobody made.
    /// </summary>
    decimal? RecommendedAmount);
