namespace API.Domain.Entities;

/// <summary>
/// One row of an application's work-experience table. Child of
/// <see cref="Candidate"/> and meaningless without it, so it cascades on delete.
/// </summary>
public class CandidateExperience
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }

    /// <summary>Preserves the order the applicant entered the rows in.</summary>
    public int SortOrder { get; set; }

    public string? Organization { get; set; }
    public string? Position { get; set; }
    public string? SalaryEmoluments { get; set; }
    public string? NatureOfDuties { get; set; }
    public string? NatureOfAppointment { get; set; }

    // The printed form asks for the period as years/months/days rather than as
    // a date range, and the committee totals those columns, so they are stored
    // as entered instead of being derived from dates that were never captured.
    public int PeriodYears { get; set; }
    public int PeriodMonths { get; set; }
    public int PeriodDays { get; set; }

    /// <summary>The uploaded <see cref="Document"/> backing this row, if any.</summary>
    public Guid? CertificateDocumentId { get; set; }

    public Candidate? Candidate { get; set; }
}
