using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One row of an application's academic-record table (10th, 12th, diploma,
/// UG, PG). Child of <see cref="Candidate"/> and meaningless without it, so it
/// cascades on delete.
/// </summary>
public class CandidateEducation
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }

    public EducationLevel Level { get; set; }
    public string? OtherLevelName { get; set; }
    public string? Subject { get; set; }
    public string? BoardInstituteUniv { get; set; }
    public int? Year { get; set; }

    /// <summary>
    /// Free text, not a number: applicants report percentages, CGPA on
    /// different scales, or grades, and the committee reads what was written.
    /// </summary>
    public string? MarksOrCgpa { get; set; }

    public string? Division { get; set; }

    /// <summary>The uploaded <see cref="Document"/> backing this row, if any.</summary>
    public Guid? CertificateDocumentId { get; set; }

    public Candidate? Candidate { get; set; }
}
