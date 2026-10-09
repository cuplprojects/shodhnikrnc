using API.Domain.Enums;

namespace API.Contracts.Projects;

public record BudgetSummaryResponse(
    IReadOnlyList<BudgetSummaryLineDto> Lines,
    IReadOnlyList<BudgetHeadReappropriationSummaryDto> Reappropriations);

public record BudgetSummaryLineDto(BudgetHeadName HeadName, int ProjectYear, decimal Sanctioned, decimal GrantReceived, decimal Spent, decimal Available, string? CustomLabel);

public record BudgetHeadReappropriationSummaryDto(BudgetHeadName HeadName, decimal NetReappropriated, decimal EffectiveTotalReceived, string? CustomLabel = null);
