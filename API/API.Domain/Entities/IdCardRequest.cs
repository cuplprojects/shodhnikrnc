namespace API.Domain.Entities;

/// <summary>
/// Student & Fellow Research ID Card request entity (BRD A4).
/// 4-Stage Approval Workflow: Library → PI → HOD → Dean.
/// </summary>
public class IdCardRequest
{
    public Guid Id { get; set; }
    
    /// <summary>User ID of the student / fellow who created the request.</summary>
    public Guid StudentUserId { get; set; }
    public Guid CreatedByUserId { get; set; }
    
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public Guid? ProjectId { get; set; }
    public string? ProjectNumber { get; set; }
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;

    // Extended Candidate Request Form fields
    public string? IdentityCode { get; set; }
    public string? LocalAddress { get; set; }
    public string? EmergencyPhone { get; set; }
    public string? MobilePhone { get; set; }
    public string? Email { get; set; }
    public string? PermanentAddress { get; set; }
    public string? PermanentDistrict { get; set; }
    public string? PermanentPin { get; set; }
    public string? Category { get; set; }
    public string? AdditionalCategory { get; set; }
    public string? PiName { get; set; }
    public string? BloodGroup { get; set; }
    public string? DateOfBirth { get; set; }
    public string? DateOfJoining { get; set; }
    public string? PeriodFrom { get; set; }
    public string? PeriodTo { get; set; }
    public string? Gender { get; set; }
    public string? AadharNumber { get; set; }
    public string? AppointmentLetterNo { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SignatureUrl { get; set; }
    public string? DocumentName { get; set; }

    /// <summary>
    /// Status values: "Pending PI Approval", "Pending HOD Approval", "Pending Dean Approval", "Issued", "Rejected"
    /// </summary>
    public string Status { get; set; } = "Pending PI Approval";

    public string? IdCardNumber { get; set; }
    public DateTimeOffset? IssuedAt { get; set; }
    
    public string? RejectionReason { get; set; }
    public string? Remarks { get; set; }
    
    /// <summary>User ID of the user who last updated/acted on this request.</summary>
    public Guid? UpdatedByUserId { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

