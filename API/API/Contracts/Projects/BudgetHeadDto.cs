using API.Domain.Enums;

namespace API.Contracts.Projects;

public record BudgetHeadDto(
    Guid? Id, BudgetHeadName HeadName, decimal Year1Amount, decimal Year2Amount, decimal Year3Amount,
    decimal Total, decimal Year4Amount = 0m, decimal Year5Amount = 0m, string? CustomLabel = null);
