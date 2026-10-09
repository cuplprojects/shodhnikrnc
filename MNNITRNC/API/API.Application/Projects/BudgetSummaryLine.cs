using API.Domain.Enums;

namespace API.Application.Projects;

public record BudgetSummaryLine(
    BudgetHeadName HeadName, int ProjectYear, decimal Sanctioned, decimal GrantReceived,
    decimal Spent, decimal Available, string? CustomLabel);

public record BudgetHeadReappropriationSummary(
    BudgetHeadName HeadName, decimal NetReappropriated, decimal EffectiveTotalReceived, string? CustomLabel = null);
