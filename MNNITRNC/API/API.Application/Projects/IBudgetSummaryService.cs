namespace API.Application.Projects;

public interface IBudgetSummaryService
{
    Task<BudgetSummaryResult> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default);
}

public record BudgetSummaryResult(
    IReadOnlyList<BudgetSummaryLine> Lines,
    IReadOnlyList<BudgetHeadReappropriationSummary> Reappropriations);
