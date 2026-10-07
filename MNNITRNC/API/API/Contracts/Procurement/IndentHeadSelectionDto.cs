using API.Domain.Enums;

namespace API.Contracts.Procurement;

public record IndentHeadSelectionDto(
    Guid BudgetHeadId,
    OverheadSubHead? SubHead,
    decimal? ManualAmount);
