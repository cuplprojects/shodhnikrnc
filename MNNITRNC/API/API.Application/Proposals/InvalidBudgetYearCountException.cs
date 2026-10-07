using API.Domain.Enums;

namespace API.Application.Proposals;

/// <summary>
/// Every budget line must carry exactly ceil(DurationMonths / 12) year
/// amounts -- a line with too few or too many silently misrepresents the
/// proposal's total, since ProposedAmount is computed as the sum of every
/// line's every year.
/// </summary>
public class InvalidBudgetYearCountException(BudgetHeadName headName, int expectedYears, int actualYears)
    : ArgumentException(
        $"Budget line '{headName}' must carry exactly {expectedYears} year amount(s) " +
        $"(the proposal's duration implies {expectedYears}), but {actualYears} were supplied.");
