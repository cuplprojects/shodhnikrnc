namespace API.Domain.Entities;

public class FacultyProfile
{
    public required string UserId { get; set; }
    public string? Name { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
    public string? Gender { get; set; }
    public string? Qualification { get; set; }
    public DateOnly? JoiningDate { get; set; }
    public string? ResearchArea { get; set; }
    public string? Photo { get; set; }
    public string? Email { get; set; }

    /// <summary>
    /// The real link to the account that owns this profile, set only once the
    /// account holder completes their own profile (or via the one-time
    /// backfill for legacy rows whose free-text UserId happens to match a
    /// real account id). Null for every profile the admin's CreateFacultyUser
    /// flow creates -- that flow is unrelated to this field.
    /// </summary>
    public Guid? ApplicationUserId { get; set; }

    public string? PrimaryBankName { get; set; }
    public string? PrimaryBankAccountNo { get; set; }
    public string? PrimaryBankIfsc { get; set; }
    
    public string? SecondaryBankName { get; set; }
    public string? SecondaryBankAccountNo { get; set; }
    public string? SecondaryBankIfsc { get; set; }
}
