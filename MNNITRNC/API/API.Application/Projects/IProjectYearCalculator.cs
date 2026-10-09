namespace API.Application.Projects;

public interface IProjectYearCalculator
{
    int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate);
}
