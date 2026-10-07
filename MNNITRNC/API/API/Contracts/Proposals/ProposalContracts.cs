using System.ComponentModel.DataAnnotations;
using API.Domain.Enums;

namespace API.Contracts.Proposals;

public record ProposalBudgetLineRequest(
    BudgetHeadName HeadName,
    [Required][MinLength(1)] IReadOnlyList<decimal> YearAmounts,
    bool IncludeInOverhead = true,
    string? CustomLabel = null);

public record ProposalEquipmentRequest(
    [Required] string Name, [Required] string Unit, [Range(0, double.MaxValue)] decimal Amount);

public record ProposalManpowerPositionRequest(
    [Required] string Designation, [Range(0, int.MaxValue)] int Positions,
    [Range(0, 100)] decimal HraPercent,
    [Required][MinLength(1)] IReadOnlyList<decimal> StipendByYear);

public record ProposalCoPiRequest(
    [Required] string Name, [Required] string Department, [Required] string Designation,
    bool IsInsideInstitute = false, string? InstituteName = null);

public record CreateProposalDraftRequestBody(
    [Required] string Title,
    ProposalType ProposalType,
    [Required] string Agency,
    string? AdvertisementReference,
    [Range(1, 60)] int DurationMonths,
    [Range(0, 100)] decimal OverheadPercent,
    [Required][MinLength(1)] IReadOnlyList<ProposalBudgetLineRequest> BudgetLines,
    IReadOnlyList<ProposalEquipmentRequest>? Equipment = null,
    IReadOnlyList<ProposalManpowerPositionRequest>? Manpower = null,
    IReadOnlyList<ProposalCoPiRequest>? CoPis = null);

/// <summary>Same shape as create -- editing replaces every field wholesale.</summary>
public record UpdateProposalRequestBody(
    [Required] string Title,
    ProposalType ProposalType,
    [Required] string Agency,
    string? AdvertisementReference,
    [Range(1, 60)] int DurationMonths,
    [Range(0, 100)] decimal OverheadPercent,
    [Required][MinLength(1)] IReadOnlyList<ProposalBudgetLineRequest> BudgetLines,
    IReadOnlyList<ProposalEquipmentRequest>? Equipment = null,
    IReadOnlyList<ProposalManpowerPositionRequest>? Manpower = null,
    IReadOnlyList<ProposalCoPiRequest>? CoPis = null);

public record ProposalBudgetLineResponse(
    BudgetHeadName HeadName, IReadOnlyList<decimal> YearAmounts, bool IncludeInOverhead, string? CustomLabel);

public record ProposalEquipmentResponse(string Name, string Unit, decimal Amount);
public record ProposalManpowerPositionResponse(
    string Designation, int Positions, decimal HraPercent,
    IReadOnlyList<decimal> StipendByYear, IReadOnlyList<decimal> HraByYear);

public record ProposalCoPiResponse(string Name, string Department, string Designation, bool IsInsideInstitute, string? InstituteName);

/// <summary>
/// Remarks travel on every action that moves the proposal, matching
/// WorkflowActionRequest's shape for the workflow-driven actions this
/// forwards to.
/// </summary>
public record ProposalActionRequestBody(string? Remarks);

public record AssignToDealingAssistantRequestBody([Required] Guid AssigneeUserId, string? Remarks);

public record RecordAgencySubmissionRequestBody([Required] DateOnly SubmittedOn);

/// <summary>A candidate to assign as Dealing Assistant.</summary>
public record DealingAssistantOptionResponse(Guid UserId, string FullName, string UserName);

/// <summary>What the funding agency's sanction letter carries.</summary>
public record RecordSanctionRequestBody(
    [Required] string SanctionNo,
    [Required] DateOnly SanctionDate,
    [Required] DateOnly ProjectStartDate,
    [Range(0, double.MaxValue)] decimal TotalSanctioned);

public record ProposalResponse(
    Guid Id,
    Guid OwnerUserId,
    Guid DepartmentId,
    string Title,
    ProposalType ProposalType,
    string Agency,
    decimal ProposedAmount,
    decimal OverheadAmount,
    decimal OverheadPercent,
    int DurationMonths,
    ProposalStatus Status,
    Guid? WorkflowInstanceId,
    WorkflowStage? CurrentStage,
    DateTimeOffset? ExpiresAt,
    DateOnly? SubmittedToAgencyOn,
    DateOnly? AgencyDecisionOn,
    Guid? ProjectId,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ProposalBudgetLineResponse> BudgetLines,
    IReadOnlyList<ProposalEquipmentResponse> Equipment,
    IReadOnlyList<ProposalManpowerPositionResponse> Manpower,
    decimal TotalAmount,
    IReadOnlyList<ProposalCoPiResponse> CoPis);

