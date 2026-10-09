namespace API.Domain.Entities;

/// <summary>
/// Fellow Medical Facility request entity.
/// </summary>
public class MedicalFacilityRequest
{
    public Guid Id { get; set; }
    public Guid StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string EnrollmentNumber { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string ProjectTitle { get; set; } = string.Empty;
    public string ProjectNo { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public string TargetOrganization { get; set; } = string.Empty;
    public Guid WorkflowInstanceId { get; set; }
    public string Status { get; set; } = "Pending PI Approval";
    public string? CertificateNumber { get; set; }
    public string CertificateBody { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
}
