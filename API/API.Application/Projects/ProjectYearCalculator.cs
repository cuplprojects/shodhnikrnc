namespace API.Application.Projects;

public class ProjectYearCalculator : IProjectYearCalculator
{
    public int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate)
    {
        if (transactionDate < projectStartDate)
        {
            throw new ArgumentException(
                $"Transaction date {transactionDate} cannot be before project start date {projectStartDate}.",
                nameof(transactionDate));
        }

        var startFinancialYear = GetFinancialYearStart(projectStartDate);
        var transactionFinancialYear = GetFinancialYearStart(transactionDate);

        return transactionFinancialYear - startFinancialYear + 1;
    }

    private static int GetFinancialYearStart(DateOnly date)
    {
        return date.Month >= 4 ? date.Year : date.Year - 1;
    }
}
